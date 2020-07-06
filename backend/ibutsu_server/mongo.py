from urllib.parse import quote_plus

from dynaconf import settings
from gridfs import GridFSBucket
from pymongo import MongoClient


class MongoAccessor(object):
    _mongo = None
    _files = {}

    def _build_uri(self):
        if settings.get("USERNAME") and settings.get("PASSWORD"):
            uri = "mongodb://{username}:{password}@{host}:{port}/?authSource={database}".format(
                username=quote_plus(settings.USERNAME),
                password=quote_plus(settings.PASSWORD),
                host=settings.HOST,
                port=settings.PORT,
                database=settings.get("DATABASE", "test_artifacts"),
            )
        else:
            uri = "mongodb://{host}:{port}".format(host=settings.HOST, port=settings.PORT)
        return uri

    @property
    def mongo(self):
        if not self._mongo:
            uri = self._build_uri()
            self._mongo = MongoClient(uri)[settings.get("DATABASE", "test_artifacts")]
        return self._mongo

    def __getattr__(self, name):
        """A wrapper to return the underlying collections"""
        mongo_name = "".join(name.split("_")[0:1] + [word.title() for word in name.split("_")[1:]])
        if name == "fs" or name.endswith("_files"):
            if name not in self._files:
                bucket = GridFSBucket(self.mongo, mongo_name)
                self._files[name] = bucket
            return self._files[name]
        else:
            return self.mongo[mongo_name]


mongo = MongoAccessor()
