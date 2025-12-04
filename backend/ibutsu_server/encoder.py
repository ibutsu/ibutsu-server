from connexion.jsonifier import Jsonifier

from ibutsu_server.models.base_model_ import Model


class IbutsuJSONProvider(Jsonifier):
    include_nulls = False

    def default(self, o):
        if isinstance(o, Model):
            dikt = {}
            for attr, _ in o.openapi_types.items():
                value = getattr(o, attr)
                if value is None and not self.include_nulls:
                    continue
                mapped_attr = o.attribute_map[attr]
                dikt[mapped_attr] = value
            return dikt
        # For basic JSON-serializable types, return as-is
        if isinstance(o, (dict, list, str, int, float, bool, type(None))):
            return o
        # For non-serializable objects, raise TypeError
        raise TypeError(f"Object of type {type(o).__name__} is not JSON serializable")
