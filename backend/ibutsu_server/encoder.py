from flask.json.provider import DefaultJSONProvider

from ibutsu_server.models.base_model_ import Model


class IbutsuJSONProvider(DefaultJSONProvider):
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
        return DefaultJSONProvider.default(self, o)
