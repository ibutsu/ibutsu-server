from datetime import datetime, timezone
from uuid import UUID

from bson import ObjectId


UUID_1_EPOCH = datetime(1582, 10, 15, tzinfo=timezone.utc)
UUID_TICKS = 10000000
UUID_VARIANT_1 = 0b1000000000000000


def is_uuid(candidate):
    """Determine if this is a uuid"""
    try:
        UUID(candidate)
        return True
    except ValueError:
        return False


def convert_objectid_to_uuid(object_id):
    """Convert an ObjectId to a UUID"""
    if isinstance(object_id, str) and not is_uuid(object_id):
        object_id = ObjectId(object_id)
    if not isinstance(object_id, ObjectId):
        return object_id
    unix_time = object_id.generation_time.astimezone(timezone.utc)
    hex_string = str(object_id)
    counter = int(hex_string[18:], 16)

    uuid_time = "1{:015x}".format(int((unix_time + (unix_time - UUID_1_EPOCH)).timestamp() * UUID_TICKS))
    uuid_clock = "{:04x}".format(UUID_VARIANT_1 | (counter & 0x3fff))
    uuid_node = "1" + hex_string[8:18].rjust(11, "0")
    string_uuid = "{}-{}-{}-{}-{}".format(uuid_time[-8:], uuid_time[4:8], uuid_time[:4],
                                          uuid_clock, uuid_node)
    converted_uuid = UUID(string_uuid)
    return str(converted_uuid)
