from datetime import datetime
from uuid import uuid4

# SQLAlchemy 2.0+ imports
from sqlalchemy import (
    Text as sa_text,  # noqa: N813
    cast as sa_cast,
    delete as sqlalchemy_delete,
    func,
    update as sqlalchemy_update,
)
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import backref
from sqlalchemy_json import mutable_json_type

from ibutsu_server.auth import bcrypt
from ibutsu_server.db.base import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    LargeBinary,
    Model,
    Table,
    Text,
    inspect,
    relationship,
)
from ibutsu_server.db.types import PortableJSON, PortableUUID
from ibutsu_server.util import merge_dicts


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

        # Parse datetime strings to datetime objects
        mapper = inspect(cls)
        for column in mapper.columns:
            if isinstance(column.type, DateTime) and column.key in record_dict:
                value = record_dict[column.key]
                if isinstance(value, str):
                    # Parse ISO format datetime strings
                    record_dict[column.key] = datetime.fromisoformat(value.replace("Z", "+00:00"))

        # remove empty keys
        for key in list(record_dict.keys()):
            if not key:
                del record_dict[key]
        return cls(**record_dict)

    def update(self, record_dict):
        if "id" in record_dict:
            record_dict.pop("id")
        values_dict = self.to_dict()
        # Deep merge metadata to preserve existing fields not in the update
        if "metadata" in values_dict and "metadata" in record_dict:
            merge_dicts(values_dict["metadata"], record_dict["metadata"])
            values_dict["metadata"] = record_dict.pop("metadata")
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
    upload_date = Column(DateTime, default=func.now(), nullable=False, index=True)


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
    created = Column(DateTime, default=func.now(), index=True)


class ImportFile(Model, FileMixin):
    __tablename__ = "import_files"
    import_id = Column(PortableUUID(), ForeignKey("imports.id"), nullable=False, index=True)


class Project(Model, ModelMixin):
    __tablename__ = "projects"
    name = Column(Text, index=True)
    title = Column(Text, index=True)
    owner_id = Column(PortableUUID(), ForeignKey("users.id"), index=True)
    group_id = Column(PortableUUID(), ForeignKey("groups.id"), index=True)
    # Use use_alter to break circular dependency with dashboards table
    default_dashboard_id = Column(
        PortableUUID(),
        ForeignKey("dashboards.id", use_alter=True, name="fk_project_default_dashboard"),
    )
    results = relationship("Result", backref="project")
    runs = relationship("Run", backref="project")
    default_dashboard = relationship("Dashboard", foreign_keys=[default_dashboard_id])
    dashboards = relationship(
        "Dashboard", back_populates="project", foreign_keys=[Dashboard.project_id]
    )
    widget_configs = relationship("WidgetConfig", back_populates="project")

    def to_dict(self, with_owner=False):
        """An overridden method to include the owner and users"""
        project_dict = super().to_dict()
        if with_owner and self.owner:
            project_dict["owner"] = self.owner.to_dict()
        if self.default_dashboard:
            project_dict["defaultDashboard"] = self.default_dashboard.to_dict()
        # Include the users relationship
        if hasattr(self, "users"):
            project_dict["users"] = [user.to_dict() for user in self.users]
        return project_dict

    def update(self, record_dict):
        """Override update to exclude relationship fields that shouldn't be set directly"""
        if "id" in record_dict:
            record_dict.pop("id")
        # Get current values but exclude relationships that are added in to_dict
        values_dict = super().to_dict()  # Call ModelMixin.to_dict, not Project.to_dict
        values_dict.update(record_dict)
        if "metadata" in values_dict:
            values_dict["data"] = values_dict.pop("metadata")
        # Remove relationship fields that shouldn't be set via setattr
        for key in ["users", "owner", "defaultDashboard"]:
            values_dict.pop(key, None)
        for key, value in values_dict.items():
            setattr(self, key, value)


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
    start_time = Column(DateTime, default=func.now(), nullable=False, index=True)
    test_id = Column(Text, index=True)
    artifacts = relationship("Artifact", backref="result")


class Run(Model, ModelMixin):
    __tablename__ = "runs"
    artifacts = relationship("Artifact")
    component = Column(Text, index=True)
    created = Column(DateTime, default=func.now(), nullable=False, index=True)
    # this is metadata but it is a reserved attr
    data = Column(mutable_json_type(dbtype=PortableJSON(), nested=True))
    duration = Column(Float, index=True)
    env = Column(Text, index=True)
    project_id = Column(PortableUUID(), ForeignKey("projects.id"), index=True)
    results = relationship("Result")
    source = Column(Text, index=True)
    start_time = Column(DateTime, default=func.now(), nullable=False, index=True)
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
    is_superadmin = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=False, nullable=False)
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

    def to_dict(self, with_projects=False):
        """An overridden method to include projects"""
        user_dict = super().to_dict()
        if with_projects:
            user_dict["projects"] = [project.to_dict() for project in self.projects]
        return user_dict

    def user_cleanup(self, new_owner, session):
        """
        Cleanup related records when a user is deleted

        Allow exceptions to raise
        SESSION COMMIT HAPPENS IN CALLER, NOT HERE
        The controller should handle exceptions and commit/rollback

        TODO: setup cascades to delete orphans automatically

        :param new_owner: The user who will take ownership of linked records
        :param session: The SQLAlchemy session to use for database operations
        :return: None
        """

        # 1. Clear the many-to-many relationship with projects
        self.projects.clear()

        # 2. Delete tokens associated with the user
        stmt = sqlalchemy_delete(Token).where(Token.user_id == self.id)
        session.execute(stmt)

        # 3. Reassign owned projects to the current user (admin performing deletion)
        stmt = (
            sqlalchemy_update(Project)
            .where(sa_cast(Project.owner_id, sa_text) == sa_cast(self.id, sa_text))
            .values(owner_id=new_owner.id)
        )
        session.execute(stmt)

        # 4. Reassign dashboards to the current user (admin performing deletion)
        # TODO: this field is null on every prod record, evaluate dropping the field
        # or changing to creator_id
        stmt = (
            sqlalchemy_update(Dashboard)
            .where(Dashboard.user_id == self.id)
            .values(user_id=new_owner.id)
        )
        session.execute(stmt)


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
