from uuid import UUID

from sqlalchemy.dialects.postgresql import JSONB, UUID as POSTGRES_UUID
from sqlalchemy.types import CHAR, JSON, Text, TypeDecorator


class PortableUUID(TypeDecorator):
    """Platform-independent UUID type.

    Uses PostgreSQL's UUID type, otherwise uses CHAR(32), storing as stringified hex values.

    Based on https://docs.sqlalchemy.org/en/13/core/custom_types.html#backend-agnostic-guid-type
    """

    impl = CHAR
    cache_ok = True  # Indicate this type is safe to use in a cache key

    def __init__(self, *args, **kwargs):
        if "as_uuid" in kwargs:
            self.as_uuid = kwargs.pop("as_uuid")
        else:
            self.as_uuid = False
        super().__init__(*args, **kwargs)

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(POSTGRES_UUID(as_uuid=self.as_uuid))
        return dialect.type_descriptor(CHAR(32))

    def process_bind_param(self, value, dialect):
        if value is None or dialect.name == "postgresql":
            return value
        if isinstance(value, UUID):
            return str(value)
        return value

    def process_result_value(self, value, _dialect):
        if value is None:
            return value
        if self.as_uuid and not isinstance(value, UUID):
            value = UUID(value)
        return value


class PortableJSON(TypeDecorator):
    """Platform-independent JSON type.

    Uses PostgreSQL's JSONB type, otherwise uses JSON.
    """

    impl = JSON
    cache_ok = True  # Indicate this type is safe to use in a cache key

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(JSONB(astext_type=Text))
        return dialect.type_descriptor(JSON())
