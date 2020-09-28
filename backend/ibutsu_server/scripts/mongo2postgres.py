#!/bin/env python3
"""
Convert a Ibutsu's MongoDB to PSQL

python3 mongo2postgres.py
    mongodb://localhost/test_artifacts postgresql://ibutsu:ibutsu@localhost:5432/ibutsu -v
"""
from argparse import ArgumentParser
from datetime import datetime
from datetime import timedelta
from datetime import timezone
from uuid import UUID

from bson import ObjectId
from gridfs import GridFSBucket
from ibutsu_server.db.models import Artifact
from ibutsu_server.db.models import Group
from ibutsu_server.db.models import Project
from ibutsu_server.db.models import Result
from ibutsu_server.db.models import Run
from ibutsu_server.db.models import WidgetConfig
from pymongo import MongoClient
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker


UUID_1_EPOCH = datetime(1582, 10, 15, tzinfo=timezone.utc)
UUID_TICKS = 10000000
UUID_VARIANT_1 = 0b1000000000000000
ROWS_TO_COMMIT_AT_ONCE = 10000
MONTHS_TO_KEEP = 1
# To avoid foreign key constraints, just shift the range of artifacts to keep a bit
ARTIFACT_MONTHS_TO_KEEP = 0.75 * MONTHS_TO_KEEP
MIGRATION_LIMIT = 10000000000  # mostly for testing purposes

Base = declarative_base()
session = None


TABLE_MAP = [
    ("groups", Group),
    ("projects", Project),
    ("widgetConfig", WidgetConfig),
    ("runs", Run),
    ("results", Result),
]
FILE_MAP = [
    # only convert artifacts, the reports in the existing DB aren't particularly useful
    ("fs", Artifact),
]

# metadata fields that are their own column now
FIELDS_TO_PROMOTE = [
    "component",
    "env",
]
# ID fields that must be converted
ID_FIELDS = [
    "result_id",
    "resultId",
    "run_id",
    "runId",
    "project",
    "run",
]
# fields that need to be typecast
FIELDS_TO_TYPECAST = ["navigable", "weight"]

# json indexes for the tables
INDEXES = {
    # "results": [
    # ],
    # "runs": [
    # ],
}


def is_uuid(candidate):
    """Determine if this is a uuid"""
    try:
        UUID(candidate)
        return True
    except ValueError:
        return False


def convert_objectid_to_uuid(object_id):
    """Convert an ObjectId to a UUID"""
    if isinstance(object_id, str) and not is_uuid(object_id) and ObjectId.is_valid(object_id):
        object_id = ObjectId(object_id)
    if not isinstance(object_id, ObjectId):
        return object_id
    unix_time = object_id.generation_time.astimezone(timezone.utc)
    hex_string = str(object_id)
    counter = int(hex_string[18:], 16)

    uuid_time = "1{:015x}".format(
        int((unix_time + (unix_time - UUID_1_EPOCH)).timestamp() * UUID_TICKS)
    )
    uuid_clock = "{:04x}".format(UUID_VARIANT_1 | (counter & 0x3FFF))
    uuid_node = "1" + hex_string[8:18].rjust(11, "0")
    string_uuid = "{}-{}-{}-{}-{}".format(
        uuid_time[-8:], uuid_time[4:8], uuid_time[:4], uuid_clock, uuid_node
    )
    converted_uuid = UUID(string_uuid)
    return str(converted_uuid)


def get_mongo(mongo_url, mongo_db):
    """Create a MongoDB client"""
    client = MongoClient(mongo_url)
    return client[mongo_db]


def setup_postgres(postgres_url):
    """Connect to PostgreSQL"""
    global session
    engine = create_engine(postgres_url)
    Base.metadata.bind = engine
    Base.metadata.create_all()
    # create a Session
    Session = sessionmaker(bind=engine)
    session = Session()


def migrate_table(collection, Model, vprint, filter_=None):
    """Migrate a collection from MongoDB into a table in PostgreSQL"""
    # TODO: update indexes once we know them
    conn = Base.metadata.bind.connect()
    for sql_index in INDEXES.get(Model.__tablename__, []):
        vprint(".", end="")
        conn.execute(sql_index)

    if Model.__tablename__ == "runs":
        run_ids = []

    for idx, row in enumerate(collection.find(filter_, sort=[("_id", -1)])):
        if idx > MIGRATION_LIMIT:
            break
        vprint(".", end="")
        mongo_id = row.pop("_id")
        # overwrite id with PSQL uuid
        row["id"] = convert_objectid_to_uuid(mongo_id)

        # handle the time fields
        if row.get("starttime"):
            row["start_time"] = datetime.fromtimestamp(row.pop("starttime"))
        if row.get("start_time") and isinstance(row["start_time"], float):
            row["start_time"] = datetime.fromtimestamp(row["start_time"])
        if row.get("start_time") and isinstance(row["start_time"], str):
            row["start_time"] = datetime.fromtimestamp(float(row["start_time"]))
        if row.get("created"):
            if isinstance(row["created"], str):
                row["created"] = datetime.fromisoformat(row["created"])
            else:
                row.pop("created")

        # promote some metadata fields to the appropriate column
        for field in FIELDS_TO_PROMOTE:
            if row.get("metadata") and row["metadata"].get(field):
                row[field] = row["metadata"][field]
        # convert some ObjectId's to UUID's
        for field in ID_FIELDS:
            if row.get("metadata") and row["metadata"].get(field):
                if field == "project":
                    row["project_id"] = convert_objectid_to_uuid(row["metadata"][field])
                    # also update the metadata field
                    row["metadata"][field] = row["project_id"]
                elif field == "run":
                    row["run_id"] = convert_objectid_to_uuid(row["metadata"][field])
                    # also update the metadata field
                    row["metadata"][field] = row["run_id"]
                elif field in ["result_id", "resultId"]:
                    row["result_id"] = convert_objectid_to_uuid(row["metadata"][field])
                else:
                    row["metadata"][field] = convert_objectid_to_uuid(row["metadata"][field])
            if row.get(field):
                if field == "project":
                    row["project_id"] = convert_objectid_to_uuid(row.pop(field))

        # Table specific stuff
        if Model.__tablename__ == "projects":
            if row.get("group_id"):
                # one of the projects has a group_id assigned (but no group exists in the DB)
                row["group_id"] = None

        if Model.__tablename__ == "widget_configs":
            for field in FIELDS_TO_TYPECAST:
                if row.get(field):
                    if field == "navigable":
                        row[field] = row[field].lower()[0] in ["t", "y"]
                    if field == "weight":
                        row[field] = int(row[field])
                if row.get("params") and row["params"].get("sort_field"):
                    # we no longer use this field
                    row["params"].pop("sort_field")

        obj = Model.from_dict(**row)
        session.add(obj)
        if idx % ROWS_TO_COMMIT_AT_ONCE == 0:
            session.commit()
        # for each run migrate the result specific to the run
        if Model.__tablename__ == "runs":
            run_ids.append(str(mongo_id))

    session.commit()
    # at the end of the session do a little cleanup
    if Model.__tablename__ in ["runs", "results"]:
        conn = Base.metadata.bind.connect()
        # delete any results or runs without start_time
        sql_delete = f"DELETE FROM {Model.__tablename__} where start_time IS NULL;"
        conn.execute(sql_delete)
    vprint(" done")

    if Model.__tablename__ == "runs":
        # return run_ids for the results to use
        return run_ids


def migrate_file(collection, Model, vprint, filter_=None):
    """Migrate a GridFS collection from MongoDB into a table in PostgreSQL"""
    # Access the underlying collection object
    # TODO: update indexes once we know them
    conn = Base.metadata.bind.connect()
    for sql_index in INDEXES.get(Model.__tablename__, []):
        vprint(".", end="")
        conn.execute(sql_index)

    # for runs and results, sort by descending start_time
    if Model.__tablename__ == "artifacts":
        sort = [("_id", -1)]
        # only include most recent runs and results
        filter_ = filter_
    else:
        sort = None
        filter_ = None

    for idx, row in enumerate(collection.find(filter_, sort=sort)):
        if idx > MIGRATION_LIMIT:
            break
        vprint(".", end="")
        pg_id = convert_objectid_to_uuid(row._id)
        data = dict()
        data["metadata"] = row.metadata
        data["id"] = pg_id
        data["filename"] = row.filename
        data["content"] = row.read()
        data["upload_date"] = row.upload_date
        for field in ID_FIELDS:
            if field == "resultId":
                data["result_id"] = convert_objectid_to_uuid(row.metadata[field])
                data["metadata"][field] = data["result_id"]
            else:
                pass
        obj = Model.from_dict(**data)
        session.add(obj)
        if idx % ROWS_TO_COMMIT_AT_ONCE == 0:
            session.commit()
    session.commit()
    vprint(" done")


def migrate_tables(mongo, vprint, migrate_files=False):
    """Migrate all the tables"""
    # first get the time range
    sort = [("_id", -1)]
    most_recent_record = mongo["runs"].find_one(sort=sort)
    most_recent_create_time = most_recent_record["_id"].generation_time
    # only include most recent runs and results
    filter_ = {
        "_id": {
            "$gt": ObjectId.from_datetime(
                most_recent_create_time - timedelta(days=30 * MONTHS_TO_KEEP)
            ),
            "$lt": ObjectId.from_datetime(most_recent_create_time),
        }
    }
    # for files, filter by _id
    file_filter = {
        "_id": {
            "$gt": ObjectId.from_datetime(
                most_recent_create_time - timedelta(days=30 * ARTIFACT_MONTHS_TO_KEEP)
            ),
            "$lt": ObjectId.from_datetime(most_recent_create_time),
        }
    }

    # loop over collections and migrate
    for collection, model in TABLE_MAP:
        vprint("Migrating {} ".format(collection), end="")
        if collection == "runs":
            run_ids = migrate_table(mongo[collection], model, vprint, filter_=filter_)
        elif collection == "results":
            # migrate in chunks of 100 runs at a time
            run_chunks = [run_ids[i : i + 100] for i in range(0, len(run_ids), 100)]
            for run_list in run_chunks:
                result_filter = {"metadata.run": {"$in": run_list}}  # filter on runs we know exist
                migrate_table(mongo[collection], model, vprint, filter_=result_filter)
        else:
            migrate_table(mongo[collection], model, vprint)
    if migrate_files:
        for collection, model in FILE_MAP:
            vprint("Migrating {} ".format(collection), end="")
            migrate_file(GridFSBucket(mongo, collection), model, vprint, filter_=file_filter)


def build_mongo_connection(url):
    """Create a MongoDB connection URL"""
    url_parts = url.split("/")
    database = url_parts[-1]
    connection_url = "/".join(url_parts[:-1]) + "/?authSource={}".format(database)
    return connection_url, database


def fake_print(*args, **kwargs):
    pass


def parse_args():
    parser = ArgumentParser()
    parser.add_argument("mongo_url", help="URL to MongoDB database")
    parser.add_argument("postgres_url", help="URL to PostgreSQL database")
    parser.add_argument("-v", "--verbose", action="store_true", help="Say what I'm doing")
    parser.add_argument("-f", "--files", action="store_true", help="Migrate artifact files")
    return parser.parse_args()


def main():
    args = parse_args()
    vprint = print if args.verbose else fake_print
    mongo_url, database = build_mongo_connection(args.mongo_url)
    mongo = get_mongo(mongo_url, database)
    setup_postgres(args.postgres_url)
    migrate_tables(mongo, vprint, args.files)


if __name__ == "__main__":
    main()
