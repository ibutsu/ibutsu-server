from datetime import datetime
from uuid import uuid4

from ibutsu_server.auth import bcrypt
from ibutsu_server.db.base import Boolean
from ibutsu_server.db.base import Column
from ibutsu_server.db.base import DateTime
from ibutsu_server.db.base import Float
from ibutsu_server.db.base import ForeignKey
from ibutsu_server.db.base import inspect
from ibutsu_server.db.base import Integer
from ibutsu_server.db.base import LargeBinary
from ibutsu_server.db.base import Model
from ibutsu_server.db.base import relationship
from ibutsu_server.db.base import Table
from ibutsu_server.db.base import Text
from ibutsu_server.db.types import PortableJSON
from ibutsu_server.db.types import PortableUUID
from ibutsu_server.util import merge_dicts
from sqlalchemy.exc import DBAPIError
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy_json import mutable_json_type


def _gen_uuid():
    """Generate a UUID"""
    return str(uuid4())


users_projects = Table(
    "users_projects",
    Column("user_id", PortableUUID(), ForeignKey("users.id"), primary_key=True),
    Column("project_id", PortableUUID(), ForeignKey("projects.id"), primary_key=True),
)


class ModelMixin(object):
    id = Column(PortableUUID(), primary_key=True, default=_gen_uuid, unique=True, nullable=False)

    def to_dict(self):
        record_dict = {c.key: getattr(self, c.key) for c in inspect(self).mapper.column_attrs}
        # when outputting info, translate data to metadata
        if record_dict.get("data"):
            record_dict["metadata"] = record_dict.pop("data")
        return record_dict

    @classmethod
    def from_dict(cls, **record_dict):
        # because metadata is a reserved attr name, translate it to data
        if record_dict.get("metadata"):
            record_dict["data"] = record_dict.pop("metadata")
        return cls(**record_dict)

    def update(self, record_dict):
        if "id" in record_dict:
            record_dict.pop("id")
        group_dict = self.to_dict()
        merge_dicts(group_dict, record_dict)
        if group_dict.get("metadata"):
            group_dict["data"] = group_dict.pop("metadata")
        if record_dict.get("metadata"):
            record_dict["data"] = record_dict.get("metadata")
        for key, value in record_dict.items():
            setattr(self, key, value)


class FileMixin(ModelMixin):
    content = Column(LargeBinary)

    def to_dict(self):
        record_dict = {c.key: getattr(self, c.key) for c in inspect(self).mapper.column_attrs}
        record_dict.pop("content")
        if record_dict.get("data"):
            record_dict["additional_metadata"] = record_dict.pop("data")
        return record_dict


class Artifact(Model, FileMixin):
    __tablename__ = "artifacts"
    result_id = Column(PortableUUID(), ForeignKey("results.id"), nullable=False, index=True)
    filename = Column(Text, index=True)
    data = Column(mutable_json_type(dbtype=PortableJSON(), nested=True))
    upload_date = Column(DateTime, default=datetime.utcnow, index=True)


class Dashboard(Model, ModelMixin):
    __tablename__ = "dashboards"
    title = Column(Text, index=True)
    description = Column(Text, default="")
    filters = Column(Text, default="")
    project_id = Column(PortableUUID(), ForeignKey("projects.id"), index=True)
    user_id = Column(PortableUUID(), ForeignKey("users.id"), index=True)
    widgets = relationship("WidgetConfig")


class Group(Model, ModelMixin):
    __tablename__ = "groups"
    name = Column(Text, index=True)
    projects = relationship("Project")
    data = Column(mutable_json_type(dbtype=PortableJSON(), nested=True))


class Import(Model, ModelMixin):
    __tablename__ = "imports"
    file = relationship("ImportFile")
    filename = Column(Text, index=True)
    format = Column(Text, index=True)
    data = Column(mutable_json_type(dbtype=PortableJSON(), nested=True))
    status = Column(Text, index=True)


class ImportFile(Model, FileMixin):
    __tablename__ = "import_files"
    import_id = Column(PortableUUID(), ForeignKey("imports.id"), nullable=False, index=True)


class Project(Model, ModelMixin):
    __tablename__ = "projects"
    name = Column(Text, index=True)
    title = Column(Text, index=True)
    owner_id = Column(PortableUUID(), ForeignKey("users.id"), index=True)
    group_id = Column(PortableUUID(), ForeignKey("groups.id"), index=True)
    reports = relationship("Report")
    results = relationship("Result")
    runs = relationship("Run")
    dashboards = relationship("Dashboard")
    widget_configs = relationship("WidgetConfig")


class Report(Model, ModelMixin):
    __tablename__ = "reports"
    created = Column(DateTime, default=datetime.utcnow, index=True)
    download_url = Column(Text, index=True)
    filename = Column(Text, index=True)
    mimetype = Column(Text, index=True)
    name = Column(Text, index=True)
    params = Column(mutable_json_type(dbtype=PortableJSON()))
    project_id = Column(PortableUUID(), ForeignKey("projects.id"), index=True)
    file = relationship("ReportFile")
    status = Column(Text, index=True)
    url = Column(Text, index=True)
    view_url = Column(Text, index=True)


class ReportFile(Model, FileMixin):
    __tablename__ = "report_files"
    report_id = Column(PortableUUID(), ForeignKey("reports.id"), nullable=False, index=True)
    filename = Column(Text, index=True)
    data = Column(mutable_json_type(dbtype=PortableJSON(), nested=True))


class Result(Model, ModelMixin):
    __tablename__ = "results"
    artifacts = relationship("Artifact")
    component = Column(Text, index=True)
    # this is metadata but it is a reserved attr
    data = Column(mutable_json_type(dbtype=PortableJSON(), nested=True))
    duration = Column(Float, index=True)
    env = Column(Text, index=True)
    params = Column(mutable_json_type(dbtype=PortableJSON()))
    project_id = Column(PortableUUID(), ForeignKey("projects.id"), index=True)
    result = Column(Text, index=True)
    run_id = Column(PortableUUID(), ForeignKey("runs.id"), index=True)
    source = Column(Text, index=True)
    start_time = Column(DateTime, default=datetime.utcnow, index=True)
    test_id = Column(Text, index=True)


class Run(Model, ModelMixin):
    __tablename__ = "runs"
    component = Column(Text, index=True)
    created = Column(DateTime, default=datetime.utcnow, index=True)
    # this is metadata but it is a reserved attr
    data = Column(mutable_json_type(dbtype=PortableJSON(), nested=True))
    duration = Column(Float, index=True)
    env = Column(Text, index=True)
    project_id = Column(PortableUUID(), ForeignKey("projects.id"), index=True)
    results = relationship("Result")
    source = Column(Text, index=True)
    start_time = Column(DateTime, default=datetime.utcnow, index=True)
    summary = Column(mutable_json_type(dbtype=PortableJSON()))


class WidgetConfig(Model, ModelMixin):
    __tablename__ = "widget_configs"
    navigable = Column(Boolean, index=True)
    params = Column(mutable_json_type(dbtype=PortableJSON()))
    project_id = Column(PortableUUID(), ForeignKey("projects.id"), index=True)
    dashboard_id = Column(PortableUUID(), ForeignKey("dashboards.id"), index=True)
    title = Column(Text, index=True)
    type = Column(Text, index=True)
    weight = Column(Integer, index=True)
    widget = Column(Text, index=True)


class User(Model, ModelMixin):
    __tablename__ = "users"
    email = Column(Text, index=True, nullable=False, unique=True)
    _password = Column(Text, nullable=False)
    name = Column(Text)
    group_id = Column(PortableUUID(), ForeignKey("groups.id"), index=True)
    dashboards = relationship("Dashboard")
    projects = relationship("Project", secondary=users_projects, lazy="subquery")

    @hybrid_property
    def password(self):
        return self._password

    @password.setter
    def _set_password(self, plaintext):
        self._password = bcrypt.generate_password_hash(plaintext)


class Meta(Model):
    """Metadata about the table

    This is a simple table used for storing metadata about the database itself. This is mostly
    used for the database versioning, but expandable if we want to use it for other things.
    """

    __tablename__ = "meta"
    key = Column(Text, primary_key=True, nullable=False, index=True)
    value = Column(Text)


def upgrade_db(session, upgrades):
    """Upgrade the database using Alembic

    :param session: An SQLAlchemy Session object
    :param upgrades: The Python module containing the upgrades
    """
    # Query the metadata table in the DB for the version number
    db_version = 0
    meta_version = Meta.query.get("version")
    if meta_version:
        db_version = int(meta_version.value)
    else:
        meta_version = Meta(key="version", value="0")
        session.add(meta_version)
        session.commit()
    if db_version > upgrades.__version__:
        return db_version, upgrades.__version__
    db_version += 1
    try:
        while hasattr(upgrades, f"upgrade_{db_version:d}"):
            try:
                upgrade_func = getattr(upgrades, f"upgrade_{db_version:d}")
                upgrade_func(session)
                session.commit()
                # Update the version number AFTER a commit so that we are sure the previous
                # transaction happened
                meta_version.value = str(db_version)
                session.commit()
                db_version += 1
            except (SQLAlchemyError, DBAPIError):
                # Could not run the upgrade
                break
    except (SQLAlchemyError, DBAPIError):
        version_meta = Meta(key="version", value=int(upgrades.__version__))
        session.add(version_meta)
        session.commit()
    upgrade_version = upgrades.__version__
    db_version = int(meta_version.value)
    return db_version, upgrade_version
