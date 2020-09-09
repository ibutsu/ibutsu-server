from uuid import uuid4

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
from ibutsu_server.db.base import Text
from ibutsu_server.db.types import PortableJSON
from ibutsu_server.db.types import PortableUUID
from ibutsu_server.util import merge_dicts
from sqlalchemy_json import mutable_json_type


def _gen_uuid():
    """Generate a UUID"""
    return str(uuid4())


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
    result_id = Column(PortableUUID(), ForeignKey("results.id"), nullable=False)
    filename = Column(Text)
    data = Column(mutable_json_type(dbtype=PortableJSON(), nested=True))


class Group(Model, ModelMixin):
    __tablename__ = "groups"
    name = Column(Text)
    projects = relationship("Project")
    data = Column(mutable_json_type(dbtype=PortableJSON(), nested=True))


class Import(Model, ModelMixin):
    __tablename__ = "imports"
    file = relationship("ImportFile")
    filename = Column(Text)
    format = Column(Text)
    data = Column(mutable_json_type(dbtype=PortableJSON(), nested=True))
    status = Column(Text)


class ImportFile(Model, FileMixin):
    __tablename__ = "import_files"
    import_id = Column(PortableUUID(), ForeignKey("imports.id"), nullable=False)


class Project(Model, ModelMixin):
    __tablename__ = "projects"
    name = Column(Text)
    title = Column(Text)
    owner_id = Column(Text)
    group_id = Column(PortableUUID(), ForeignKey("groups.id"))
    reports = relationship("Report")
    results = relationship("Result")
    runs = relationship("Run")
    widget_configs = relationship("WidgetConfig")


class Report(Model, ModelMixin):
    __tablename__ = "reports"
    created = Column(DateTime)
    download_url = Column(Text)
    filename = Column(Text)
    mimetype = Column(Text)
    name = Column(Text)
    params = Column(mutable_json_type(dbtype=PortableJSON()))
    project_id = Column(PortableUUID(), ForeignKey("projects.id"))
    file = relationship("ReportFile")
    status = Column(Text)
    url = Column(Text)
    view_url = Column(Text)


class ReportFile(Model, FileMixin):
    __tablename__ = "report_files"
    report_id = Column(PortableUUID(), ForeignKey("reports.id"), nullable=False)
    filename = Column(Text)
    data = Column(mutable_json_type(dbtype=PortableJSON(), nested=True))


class Result(Model, ModelMixin):
    __tablename__ = "results"
    artifacts = relationship("Artifact")
    component = Column(Text)
    # this is metadata but it is a reserved attr
    data = Column(mutable_json_type(dbtype=PortableJSON(), nested=True))
    duration = Column(Float)
    env = Column(Text)
    params = Column(mutable_json_type(dbtype=PortableJSON()))
    project_id = Column(PortableUUID(), ForeignKey("projects.id"))
    result = Column(Text)
    run_id = Column(PortableUUID(), ForeignKey("runs.id"))
    source = Column(Text)
    start_time = Column(DateTime)
    test_id = Column(Text)


class Run(Model, ModelMixin):
    __tablename__ = "runs"
    component = Column(Text)
    created = Column(DateTime)
    # this is metadata but it is a reserved attr
    data = Column(mutable_json_type(dbtype=PortableJSON(), nested=True))
    duration = Column(Float)
    env = Column(Text)
    project_id = Column(PortableUUID(), ForeignKey("projects.id"))
    results = relationship("Result")
    source = Column(Text)
    start_time = Column(DateTime)
    summary = Column(mutable_json_type(dbtype=PortableJSON()))


class WidgetConfig(Model, ModelMixin):
    __tablename__ = "widget_configs"
    navigable = Column(Boolean)
    params = Column(mutable_json_type(dbtype=PortableJSON()))
    project_id = Column(PortableUUID(), ForeignKey("projects.id"))
    title = Column(Text)
    type = Column(Text)
    weight = Column(Integer)
    widget = Column(Text)
