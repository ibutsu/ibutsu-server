from uuid import UUID

from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID
from sqlalchemy.types import CHAR, JSON, Text, TypeDecorator


class PortableUUID(TypeDecorator):
    """Platform-independent UUID type.

    Uses PostgreSQL's UUID type, otherwise uses CHAR(32), storing as stringified hex values.

    Based on https://docs.sqlalchemy.org/en/13/core/custom_types.html#backend-agnostic-guid-type
    """

    impl = CHAR

    def __init__(self, *args, **kwargs):
        if "as_uuid" in kwargs:
            self.as_uuid = kwargs.pop("as_uuid")
        else:
            self.as_uuid = False
        super().__init__(*args, **kwargs)

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PostgresUUID(as_uuid=self.as_uuid))
        else:
            return dialect.type_descriptor(CHAR(32))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        elif dialect.name == "postgresql":
            return value
        elif isinstance(value, UUID):
            return str(value)
        else:
            return value

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        else:
            if self.as_uuid and not isinstance(value, UUID):
                value = UUID(value)
            return value


class PortableJSON(TypeDecorator):
    """Platform-independent JSON type.

    Uses PostgreSQL's JSONB type, otherwise uses JSON.
    """

    impl = JSON

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(JSONB(astext_type=Text))
        else:
            return dialect.type_descriptor(JSON())
