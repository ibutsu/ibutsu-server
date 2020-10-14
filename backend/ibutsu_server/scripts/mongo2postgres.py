#!/bin/env python3
"""
Convert a Ibutsu's MongoDB to PSQL

python3 mongo2postgres.py
    mongodb://localhost/test_artifacts postgresql://ibutsu:ibutsu@localhost:5432/ibutsu -v
"""
import os
from argparse import ArgumentParser
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from datetime import timedelta
from datetime import timezone
from uuid import UUID

from bson import ObjectId
from gridfs import GridFSBucket
from ibutsu_server import get_app
from ibutsu_server.db.base import session
from ibutsu_server.db.models import Artifact
from ibutsu_server.db.models import Group
from ibutsu_server.db.models import Project
from ibutsu_server.db.models import Report
from ibutsu_server.db.models import ReportFile
from ibutsu_server.db.models import Result
from ibutsu_server.db.models import Run
from ibutsu_server.db.models import WidgetConfig
from iso8601 import parse_date
from pymongo import MongoClient


UUID_1_EPOCH = datetime(1582, 10, 15, tzinfo=timezone.utc)
UUID_TICKS = 10000000
UUID_VARIANT_1 = 0b1000000000000000
ROWS_TO_COMMIT_AT_ONCE = 1000
MONTHS_TO_KEEP = 2
# To avoid foreign key constraints, just shift the range of artifacts to keep a bit
ARTIFACT_MONTHS_TO_KEEP = 0.5 * MONTHS_TO_KEEP
MIGRATION_LIMIT = 10000000000  # mostly for testing purposes


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
INDEXES = [
    "CREATE INDEX IF NOT EXISTS ix_results_jenkins_job_name "
    "ON results((data->'jenkins'->>'job_name'));",
    "CREATE INDEX IF NOT EXISTS ix_results_jenkins_build_number "
    "ON results((data->'jenkins'->>'build_number'));",
    "CREATE INDEX IF NOT EXISTS ix_results_classification "
    "ON results((data->>'classification'));",
    "CREATE INDEX IF NOT EXISTS ix_results_assignee ON results((data->>'assignee'));",
    "CREATE INDEX IF NOT EXISTS ix_results_exception_name "
    "ON results((data->>'exception_name'));",
    "CREATE INDEX IF NOT EXISTS ix_runs_jenkins_job_name "
    "ON runs((data->'jenkins'->>'job_name'));",
    "CREATE INDEX IF NOT EXISTS ix_runs_jenkins_build_number "
    "ON runs((data->'jenkins'->>'build_number'));",
    "CREATE INDEX IF NOT EXISTS ix_runs_jjn_jbn "
    "ON runs((data->'jenkins'->>'build_number'), (data->'jenkins'->>'job_name'))",
    "CREATE INDEX IF NOT EXISTS ix_runs_summary ON runs USING gin (summary)",
]


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


def build_mongo_connection(url):
    """Create a MongoDB connection URL"""
    url_parts = url.split("/")
    database = url_parts[-1]
    connection_url = "/".join(url_parts[:-1]) + "/?authSource={}".format(database)
    return connection_url, database


def setup_objects(mongo_url, mongo_db, postgres_url, is_verbose):
    """Set up the objects needed"""
    app = get_app(extra_config={"SQLALCHEMY_DATABASE_URI": postgres_url})
    mongo = get_mongo(mongo_url, mongo_db)
    vprint = print if is_verbose else fake_print
    return mongo, app.app, vprint


def migrate_table(collection, Model, vprint, limit=None, filter_=None):
    """Migrate a collection from MongoDB into a table in PostgreSQL"""

    if Model.__tablename__ in ["runs", "results"]:
        ids = []

    for idx, row in enumerate(collection.find(filter_, sort=[("_id", -1)])):
        if limit and idx > limit:
            break
        vprint(".", end="", flush=True)
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
                row["created"] = parse_date(row["created"])
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
                    if not is_uuid(row["project_id"]):
                        row["project_id"] = None
                elif field == "run":
                    row["run_id"] = convert_objectid_to_uuid(row["metadata"][field])
                    # also update the metadata field
                    row["metadata"][field] = row["run_id"]
                    if not is_uuid(row["run_id"]):
                        row["run_id"] = None
                elif field in ["result_id", "resultId"]:
                    row["result_id"] = convert_objectid_to_uuid(row["metadata"][field])
                else:
                    row["metadata"][field] = convert_objectid_to_uuid(row["metadata"][field])
            if row.get(field):
                if field == "project":
                    row["project_id"] = convert_objectid_to_uuid(row.pop(field))
                    if not is_uuid(row["project_id"]):
                        row["project_id"] = None

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
                if row.get("params") and row["params"].get("group_field") == "metadata.component":
                    row["params"]["group_field"] = "component"

        if Model.__tablename__ == "reports" and "parameters" in row:
            row["params"] = row.pop("parameters")

        if is_uuid(row["id"]):
            obj = Model.from_dict(**row)
            session.add(obj)

        if idx % ROWS_TO_COMMIT_AT_ONCE == 0:
            session.commit()

        if Model.__tablename__ in ["runs", "results"]:
            ids.append(str(mongo_id))

    session.commit()
    # at the end of the session do a little cleanup
    if Model.__tablename__ in ["runs", "results"]:
        conn = session.get_bind().connect()
        # delete any results or runs without start_time
        sql_delete = f"DELETE FROM {Model.__tablename__} where start_time IS NULL;"
        conn.execute(sql_delete)
    vprint(" done")

    if Model.__tablename__ in ["runs", "results"]:
        # return run_ids for the results to use
        return ids


def migrate_file(collection, Model, vprint, limit=None, filter_=None):
    """Migrate a GridFS collection from MongoDB into a table in PostgreSQL"""
    # for runs and results, sort by descending start_time
    if Model.__tablename__ == "artifacts":
        sort = [("_id", -1)]
        # only include most recent runs and results
        filter_ = filter_
    else:
        sort = None
        filter_ = None

    for idx, row in enumerate(collection.find(filter_, sort=sort)):
        if limit and idx > limit:
            break
        vprint(".", end="", flush=True)
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


def migrate_runs(app, mongo, run_ids, vprint):
    """Migrate all the data associated with a particular run id"""
    try:
        with app.app_context():
            # Migrate the actual run first
            vprint("Migrating runs ", end="", flush=True)
            migrate_table(
                mongo.runs,
                Run,
                vprint,
                filter_={"_id": {"$in": [ObjectId(run_id) for run_id in run_ids]}},
            )
            # Then migrate the results
            vprint("Migrating results ", end="", flush=True)
            result_ids = migrate_table(
                mongo.results, Result, vprint, filter_={"metadata.run": {"$in": run_ids}}
            )
            vprint("Migrating arficats ", end="", flush=True)
            for batch_num in range((len(result_ids) // 100) + 1):
                batch = result_ids[batch_num * 100 : 100]
                migrate_file(
                    GridFSBucket(mongo, "fs"),
                    Artifact,
                    vprint,
                    filter_={"metadata.resultId": {"$in": batch}},
                )
    except Exception as e:
        print(e)
        raise e


def migrate_reports(app, mongo, vprint, filter_=None):
    """Migrate all the reports"""
    with app.app_context():
        vprint("Migrating reports ", end="", flush=True)
        migrate_table(mongo.reports, Report, vprint)
        vprint("Migrating files for reports ", end="", flush=True)
        migrate_file(GridFSBucket(mongo, "reportFiles"), ReportFile, vprint, filter_=filter_)


def migrate_widgets(app, mongo, vprint):
    """Migrate all the widgets for the dashboards"""
    with app.app_context():
        vprint("Migrating widgets ", end="")
        migrate_table(mongo.widgetConfig, WidgetConfig, vprint)


def migrate_projects(mongo, vprint):
    """Migrate the projects"""
    vprint("Migrating projects ", end="")
    migrate_table(mongo.projects, Project, vprint)


def migrate_tables(app, mongo, vprint, pool_size, record_limit, month_limit):
    """Migrate all the tables"""
    # first get the time range
    sort = [("_id", -1)]
    most_recent_record = mongo["results"].find_one(sort=sort)
    most_recent_create_time = most_recent_record["_id"].generation_time
    # only include most recent runs and results
    if month_limit:
        table_filter = {
            "_id": {
                "$gt": ObjectId.from_datetime(
                    most_recent_create_time - timedelta(days=30 * month_limit)
                ),
                "$lt": ObjectId.from_datetime(most_recent_create_time),
            }
        }
    else:
        table_filter = {"_id": {"$lt": ObjectId.from_datetime(most_recent_create_time)}}

    # First, migrate the projects
    with app.app_context():
        migrate_projects(mongo, vprint)

    # Now create a multiprocessing pool (it automatically uses all processors available)
    with ThreadPoolExecutor(max_workers=pool_size, thread_name_prefix="ibutsu-") as pool:
        # Add the widet and reports migration functions to the pool
        pool.submit(migrate_widgets, app, mongo, vprint)
        pool.submit(migrate_reports, app, mongo, vprint, table_filter)
        # Get a list of all the runs, and add a migration job for each run to the pool
        offset = 0
        while True:
            runs = mongo.runs.find(table_filter, sort=sort, skip=offset, limit=100)
            run_ids = [str(run["_id"]) for run in runs]
            if not run_ids:
                break
            pool.submit(migrate_runs, app, mongo, run_ids, vprint)
            offset += 100

    # create indexes for some of the tables
    vprint("Creating indexes ", end="", flush=True)
    conn = session.get_bind().connect()
    for sql_index in INDEXES:
        vprint(".", end="", flush=True)
        conn.execute(sql_index)
    vprint(" done")


def fake_print(*args, **kwargs):
    pass


def parse_args():
    parser = ArgumentParser()
    parser.add_argument("mongo_url", help="URL to MongoDB database")
    parser.add_argument("postgres_url", help="URL to PostgreSQL database")
    parser.add_argument("-v", "--verbose", action="store_true", help="Say what I'm doing")
    parser.add_argument(
        "-p", "--pool-size", type=int, default=None, help="The number of processors to use"
    )
    parser.add_argument(
        "-l",
        "--limit",
        default=MIGRATION_LIMIT,
        help="Limit migration to the specified number of records",
    )
    parser.add_argument(
        "-m",
        "--months",
        default=MONTHS_TO_KEEP,
        help="Limit migration to the specified number of months",
    )
    return parser.parse_args()


def main():
    # Arguments
    args = parse_args()
    record_limit = int(args.limit) if args.limit not in ["none", "0"] else None
    month_limit = int(args.months) if args.months not in ["none", "0"] else None
    # Set up
    os.environ["SQLALCHEMY_DATABASE_URI"] = args.postgres_url
    mongo_url, mongo_db = build_mongo_connection(args.mongo_url)
    mongo, app, vprint = setup_objects(mongo_url, mongo_db, args.postgres_url, args.verbose)
    migrate_tables(app, mongo, vprint, args.pool_size, record_limit, month_limit)


if __name__ == "__main__":
    main()
