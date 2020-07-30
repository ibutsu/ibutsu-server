from uuid import uuid4

from ibutsu_server.db.base import Column
from ibutsu_server.db.base import LargeBinary
from ibutsu_server.db.base import Model
from ibutsu_server.db.types import PortableJSON
from ibutsu_server.db.types import PortableUUID
from ibutsu_server.util import merge_dicts
from sqlalchemy_json import mutable_json_type


def _gen_uuid():
    """Generate a UUID"""
    return str(uuid4())


class ModelMixin(object):
    id = Column(PortableUUID(), primary_key=True, default=_gen_uuid, unique=True, nullable=False)
    data = Column(mutable_json_type(dbtype=PortableJSON(), nested=True))

    def to_dict(self):
        record_dict = self.data
        record_dict["id"] = self.id
        return record_dict

    @classmethod
    def from_dict(cls, record_dict):
        record = cls(data=record_dict)
        if "id" in record_dict:
            record.id = record_dict["id"]
        return record

    def update(self, record_dict):
        if "id" in record_dict:
            record_dict.pop("id")
        group_dict = self.to_dict()
        merge_dicts(group_dict, record_dict)
        self.data = record_dict

    def get(self, name, default=None):
        return self.data.get(name, default)

    def __getitem__(self, name):
        return self.data[name]

    def __setitem__(self, name, value):
        self.data[name] = value


class FileMixin(ModelMixin):
    content = Column(LargeBinary)


class Artifact(Model, FileMixin):
    __tablename__ = "artifacts"


class Group(Model, ModelMixin):
    __tablename__ = "groups"


class Import(Model, ModelMixin):
    __tablename__ = "imports"


class ImportFile(Model, FileMixin):
    __tablename__ = "import_files"


class Project(Model, ModelMixin):
    __tablename__ = "projects"


class Report(Model, ModelMixin):
    __tablename__ = "reports"


class ReportFile(Model, FileMixin):
    __tablename__ = "report_files"


class Result(Model, ModelMixin):
    __tablename__ = "results"


class Run(Model, ModelMixin):
    __tablename__ = "runs"


class WidgetConfig(Model, ModelMixin):
    __tablename__ = "widget_configs"
