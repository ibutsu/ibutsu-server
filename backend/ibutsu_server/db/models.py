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
from sqlalchemy.exc import DBAPIError
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import backref
from sqlalchemy_json import mutable_json_type


def _gen_uuid():
    """Generate a UUID"""
    return str(uuid4())


users_projects = Table(
    "users_projects",
    Column("user_id", PortableUUID(), ForeignKey("users.id"), primary_key=True),
    Column("project_id", PortableUUID(), ForeignKey("projects.id"), primary_key=True),
)


class ModelMixin:
    id = Column(PortableUUID(), primary_key=True, default=_gen_uuid, unique=True, nullable=False)

    def to_dict(self):
        record_dict = {c.key: getattr(self, c.key) for c in inspect(self).mapper.column_attrs}
        # when outputting info, translate data to metadata
        if "data" in record_dict:
            record_dict["metadata"] = record_dict.pop("data") or {}
        return record_dict

    @classmethod
    def from_dict(cls, **record_dict):
        # because metadata is a reserved attr name, translate it to data
        if "metadata" in record_dict:
            record_dict["data"] = record_dict.pop("metadata") or {}

        # remove empty keys
        for key in list(record_dict.keys()):
            if not key:
                del record_dict[key]
        return cls(**record_dict)

    def update(self, record_dict):
        if "id" in record_dict:
            record_dict.pop("id")
        values_dict = self.to_dict()
        values_dict.update(record_dict)
        if "metadata" in values_dict:
            values_dict["data"] = values_dict.pop("metadata")
        for key, value in values_dict.items():
            setattr(self, key, value)


class FileMixin(ModelMixin):
    content = Column(LargeBinary)

    def to_dict(self):
        record_dict = {c.key: getattr(self, c.key) for c in inspect(self).mapper.column_attrs}
        record_dict.pop("content")
        if "data" in record_dict:
            record_dict["additional_metadata"] = record_dict.pop("data") or {}
        return record_dict


class Artifact(Model, FileMixin):
    __tablename__ = "artifacts"
    result_id = Column(PortableUUID(), ForeignKey("results.id"), index=True)
    run_id = Column(PortableUUID(), ForeignKey("runs.id"), index=True)
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
    project = relationship("Project", back_populates="dashboards", foreign_keys=[project_id])


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
    default_dashboard_id = Column(PortableUUID(), ForeignKey("dashboards.id"))
    reports = relationship("Report")
    results = relationship("Result", backref="project")
    runs = relationship("Run", backref="project")
    default_dashboard = relationship("Dashboard", foreign_keys=[default_dashboard_id])
    dashboards = relationship(
        "Dashboard", back_populates="project", foreign_keys=[Dashboard.project_id]
    )
    widget_configs = relationship("WidgetConfig", back_populates="project")

    def to_dict(self, with_owner=False):
        """An overridden method to include the owner"""
        project_dict = super().to_dict()
        if with_owner and self.owner:
            project_dict["owner"] = self.owner.to_dict()
        if self.default_dashboard:
            project_dict["defaultDashboard"] = self.default_dashboard.to_dict()
        return project_dict


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
    artifacts = relationship("Artifact", backref="result")


class Run(Model, ModelMixin):
    __tablename__ = "runs"
    artifacts = relationship("Artifact")
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
    artifacts = relationship("Artifact", backref="run")


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

    project = relationship("Project", back_populates="widget_configs")


class User(Model, ModelMixin):
    __tablename__ = "users"
    email = Column(Text, index=True, nullable=False, unique=True)
    _password = Column(Text, nullable=True)
    name = Column(Text)
    activation_code = Column(Text, nullable=True)
    is_superadmin = Column(Boolean, default=False)
    is_active = Column(Boolean, default=False)
    group_id = Column(PortableUUID(), ForeignKey("groups.id"), index=True)
    dashboards = relationship("Dashboard")
    owned_projects = relationship("Project", backref="owner")
    tokens = relationship("Token", backref="user")
    projects = relationship(
        "Project", secondary=users_projects, backref=backref("users", lazy="subquery")
    )

    @hybrid_property
    def password(self):
        return self._password

    @password.setter
    def password(self, value):
        self._password = bcrypt.generate_password_hash(value).decode("utf8")

    def check_password(self, plaintext):
        return bcrypt.check_password_hash(self.password, plaintext)

    def set_password(self, value: str):
        """
        The password setter breaks with an AttributeError, so this is a temporary work-around
        until that can be resolved.
        """
        self._password = bcrypt.generate_password_hash(value).decode("utf8")

    def to_dict(self, with_projects=False):
        """An overridden method to include projects"""
        user_dict = super().to_dict()
        if with_projects:
            user_dict["projects"] = [project.to_dict() for project in self.projects]
        return user_dict


class Token(Model, ModelMixin):
    __tablename__ = "tokens"
    name = Column(Text, nullable=False)
    token = Column(Text, nullable=False)
    expires = Column(DateTime)
    user_id = Column(PortableUUID(), ForeignKey("users.id"), index=True)


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
            except (SQLAlchemyError, DBAPIError) as e:
                # Could not run the upgrade
                if "already exists" not in str(e):
                    print(e)
                    break
            # Update the version number AFTER a commit so that we are sure the previous
            # transaction happened
            meta_version.value = str(db_version)
            session.commit()
            db_version += 1
    except (SQLAlchemyError, DBAPIError):
        version_meta = Meta(key="version", value=int(upgrades.__version__))
        session.add(version_meta)
        session.commit()
    upgrade_version = upgrades.__version__
    db_version = int(meta_version.value)
    return db_version, upgrade_version
