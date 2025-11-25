"""Tests for ibutsu_server.models.base_model_ module"""

import pytest

from ibutsu_server.models.base_model_ import Model


class SimpleModel(Model):
    """Simple mock model for testing"""

    openapi_types = {
        "id": str,
        "name": str,
        "value": int,
    }

    attribute_map = {
        "id": "id",
        "name": "name",
        "value": "value",
    }

    def __init__(self, id=None, name=None, value=None):
        self.id = id
        self.name = name
        self.value = value


class NestedModel(Model):
    """Model with nested objects for testing"""

    openapi_types = {
        "id": str,
        "nested": object,
        "items": list,
    }

    attribute_map = {
        "id": "id",
        "nested": "nested",
        "items": "items",
    }

    def __init__(self, id=None, nested=None, items=None):
        self.id = id
        self.nested = nested
        self.items = items


class MappedAttributeModel(Model):
    """Model with different attribute mapping for testing"""

    openapi_types = {
        "internal_id": str,
        "internal_name": str,
    }

    attribute_map = {
        "internal_id": "externalId",
        "internal_name": "externalName",
    }

    def __init__(self, internal_id=None, internal_name=None):
        self.internal_id = internal_id
        self.internal_name = internal_name


class TestModelFromDict:
    """Tests for Model.from_dict class method"""

    def test_from_dict_basic(self):
        """Test from_dict with simple data"""
        data = {"id": "123", "name": "test", "value": 42}
        model = SimpleModel.from_dict(data)

        assert model.id == "123"
        assert model.name == "test"
        assert model.value == 42

    def test_from_dict_with_none_values(self):
        """Test from_dict with None values"""
        data = {"id": "123", "name": None, "value": None}
        model = SimpleModel.from_dict(data)

        assert model.id == "123"
        assert model.name is None
        assert model.value is None

    def test_from_dict_with_missing_fields(self):
        """Test from_dict with missing fields"""
        data = {"id": "123"}
        model = SimpleModel.from_dict(data)

        assert model.id == "123"
        assert model.name is None
        assert model.value is None

    def test_from_dict_with_extra_fields(self):
        """Test from_dict ignores extra fields not in openapi_types"""
        data = {"id": "123", "name": "test", "value": 42, "extra_field": "ignored"}
        model = SimpleModel.from_dict(data)

        assert model.id == "123"
        assert model.name == "test"
        assert model.value == 42
        assert not hasattr(model, "extra_field")

    def test_from_dict_with_mapped_attributes(self):
        """Test from_dict with attribute_map different from attribute names"""
        data = {"externalId": "ext-123", "externalName": "External Name"}
        model = MappedAttributeModel.from_dict(data)

        assert model.internal_id == "ext-123"
        assert model.internal_name == "External Name"

    def test_from_dict_with_empty_dict(self):
        """Test from_dict with empty dictionary"""
        data = {}
        model = SimpleModel.from_dict(data)

        assert model.id is None
        assert model.name is None
        assert model.value is None

    def test_from_dict_returns_correct_type(self):
        """Test from_dict returns instance of correct class"""
        data = {"id": "123", "name": "test", "value": 42}
        model = SimpleModel.from_dict(data)

        assert isinstance(model, SimpleModel)
        assert isinstance(model, Model)


class TestModelToDict:
    """Tests for Model.to_dict instance method"""

    def test_to_dict_basic(self):
        """Test to_dict with simple model"""
        model = SimpleModel(id="123", name="test", value=42)
        result = model.to_dict()

        assert isinstance(result, dict)
        assert result["id"] == "123"
        assert result["name"] == "test"
        assert result["value"] == 42

    def test_to_dict_with_none_values(self):
        """Test to_dict includes None values"""
        model = SimpleModel(id="123", name=None, value=None)
        result = model.to_dict()

        assert isinstance(result, dict)
        assert result["id"] == "123"
        assert result["name"] is None
        assert result["value"] is None

    def test_to_dict_with_all_none(self):
        """Test to_dict with all None values"""
        model = SimpleModel(id=None, name=None, value=None)
        result = model.to_dict()

        assert isinstance(result, dict)
        assert result["id"] is None
        assert result["name"] is None
        assert result["value"] is None

    def test_to_dict_with_nested_model(self):
        """Test to_dict with nested model that has to_dict method"""
        nested = SimpleModel(id="nested-id", name="nested", value=99)
        model = NestedModel(id="parent-id", nested=nested, items=[])
        result = model.to_dict()

        assert result["id"] == "parent-id"
        assert isinstance(result["nested"], dict)
        assert result["nested"]["id"] == "nested-id"
        assert result["nested"]["name"] == "nested"
        assert result["nested"]["value"] == 99

    def test_to_dict_with_list_of_models(self):
        """Test to_dict with list containing models"""
        item1 = SimpleModel(id="1", name="first", value=1)
        item2 = SimpleModel(id="2", name="second", value=2)
        model = NestedModel(id="parent", nested=None, items=[item1, item2])
        result = model.to_dict()

        assert result["id"] == "parent"
        assert isinstance(result["items"], list)
        assert len(result["items"]) == 2
        assert result["items"][0]["id"] == "1"
        assert result["items"][1]["id"] == "2"

    def test_to_dict_with_list_of_primitives(self):
        """Test to_dict with list of primitive values"""
        model = NestedModel(id="parent", nested=None, items=["a", "b", "c"])
        result = model.to_dict()

        assert result["id"] == "parent"
        assert result["items"] == ["a", "b", "c"]

    def test_to_dict_with_dict_of_models(self):
        """Test to_dict with dict containing models"""
        nested_model = SimpleModel(id="nested", name="test", value=42)
        model = NestedModel(id="parent", nested={"key": nested_model}, items=[])
        result = model.to_dict()

        assert result["id"] == "parent"
        assert isinstance(result["nested"], dict)
        assert "key" in result["nested"]
        assert isinstance(result["nested"]["key"], dict)
        assert result["nested"]["key"]["id"] == "nested"

    def test_to_dict_with_dict_of_primitives(self):
        """Test to_dict with dict of primitive values"""
        model = NestedModel(id="parent", nested={"a": 1, "b": 2}, items=[])
        result = model.to_dict()

        assert result["id"] == "parent"
        assert result["nested"] == {"a": 1, "b": 2}

    def test_to_dict_with_empty_list(self):
        """Test to_dict with empty list"""
        model = NestedModel(id="parent", nested=None, items=[])
        result = model.to_dict()

        assert result["items"] == []

    def test_to_dict_with_empty_dict(self):
        """Test to_dict with empty dict"""
        model = NestedModel(id="parent", nested={}, items=[])
        result = model.to_dict()

        assert result["nested"] == {}

    def test_to_dict_preserves_zero_values(self):
        """Test to_dict preserves zero as distinct from None"""
        model = SimpleModel(id="123", name="zero-test", value=0)
        result = model.to_dict()

        assert "value" in result
        assert result["value"] == 0

    def test_to_dict_preserves_empty_string(self):
        """Test to_dict preserves empty string"""
        model = SimpleModel(id="", name="empty", value=42)
        result = model.to_dict()

        assert "id" in result
        assert result["id"] == ""

    def test_to_dict_preserves_false_boolean(self):
        """Test to_dict preserves False boolean"""

        class BoolModel(Model):
            openapi_types = {"active": bool}
            attribute_map = {"active": "active"}

            def __init__(self, active=None):
                self.active = active

        model = BoolModel(active=False)
        result = model.to_dict()

        assert "active" in result
        assert result["active"] is False


class TestModelToStr:
    """Tests for Model.to_str instance method"""

    def test_to_str_returns_string(self):
        """Test to_str returns a string"""
        model = SimpleModel(id="123", name="test", value=42)
        result = model.to_str()

        assert isinstance(result, str)

    def test_to_str_contains_values(self):
        """Test to_str contains model values"""
        model = SimpleModel(id="123", name="test", value=42)
        result = model.to_str()

        assert "123" in result
        assert "test" in result
        assert "42" in result

    def test_to_str_with_none_values(self):
        """Test to_str with None values"""
        model = SimpleModel(id=None, name=None, value=None)
        result = model.to_str()

        assert isinstance(result, str)
        assert "None" in result

    def test_to_str_uses_pformat(self):
        """Test to_str returns pretty-formatted string"""
        model = SimpleModel(id="123", name="test", value=42)
        result = model.to_str()

        # pprint.pformat typically includes curly braces and quotes
        assert "{" in result or "'" in result


class TestModelRepr:
    """Tests for Model.__repr__ method"""

    def test_repr_returns_string(self):
        """Test __repr__ returns a string"""
        model = SimpleModel(id="123", name="test", value=42)
        result = repr(model)

        assert isinstance(result, str)

    def test_repr_equals_to_str(self):
        """Test __repr__ returns same as to_str"""
        model = SimpleModel(id="123", name="test", value=42)

        assert repr(model) == model.to_str()

    def test_repr_contains_values(self):
        """Test repr contains model values"""
        model = SimpleModel(id="123", name="test", value=42)
        result = repr(model)

        assert "123" in result
        assert "test" in result
        assert "42" in result


class TestModelEquality:
    """Tests for Model.__eq__ and __ne__ methods"""

    def test_eq_same_values(self):
        """Test equality with same values"""
        model1 = SimpleModel(id="123", name="test", value=42)
        model2 = SimpleModel(id="123", name="test", value=42)

        assert model1 == model2

    def test_eq_different_values(self):
        """Test equality with different values"""
        model1 = SimpleModel(id="123", name="test", value=42)
        model2 = SimpleModel(id="456", name="other", value=99)

        assert model1 != model2

    def test_eq_partial_difference(self):
        """Test equality when only one attribute differs"""
        model1 = SimpleModel(id="123", name="test", value=42)
        model2 = SimpleModel(id="123", name="test", value=99)

        assert model1 != model2

    def test_eq_with_none_values(self):
        """Test equality with None values"""
        model1 = SimpleModel(id="123", name=None, value=None)
        model2 = SimpleModel(id="123", name=None, value=None)

        assert model1 == model2

    def test_eq_different_none_values(self):
        """Test equality when None differs"""
        model1 = SimpleModel(id="123", name="test", value=42)
        model2 = SimpleModel(id="123", name=None, value=42)

        assert model1 != model2

    def test_eq_same_object(self):
        """Test equality with same object reference"""
        model = SimpleModel(id="123", name="test", value=42)
        same_model = model  # Same reference

        assert model == same_model

    def test_eq_different_types(self):
        """Test equality with different types raises AttributeError"""
        model = SimpleModel(id="123", name="test", value=42)
        other = {"id": "123", "name": "test", "value": 42}

        # The current implementation raises AttributeError when comparing with non-Model objects
        # This tests the actual behavior
        with pytest.raises(AttributeError):
            _ = model == other

    def test_ne_different_values(self):
        """Test inequality with different values"""
        model1 = SimpleModel(id="123", name="test", value=42)
        model2 = SimpleModel(id="456", name="other", value=99)

        assert model1 != model2

    def test_ne_same_values(self):
        """Test inequality with same values"""
        model1 = SimpleModel(id="123", name="test", value=42)
        model2 = SimpleModel(id="123", name="test", value=42)

        assert model1 == model2

    def test_ne_same_object(self):
        """Test inequality with same object"""
        model = SimpleModel(id="123", name="test", value=42)
        same_model = model  # Same reference

        assert model == same_model


class TestModelHash:
    """Tests for Model.__hash__ method"""

    def test_hash_returns_int(self):
        """Test __hash__ returns an integer"""
        model = SimpleModel(id="123", name="test", value=42)
        result = hash(model)

        assert isinstance(result, int)

    def test_hash_same_values(self):
        """Test hash is same for models with same values"""
        model1 = SimpleModel(id="123", name="test", value=42)
        model2 = SimpleModel(id="123", name="test", value=42)

        assert hash(model1) == hash(model2)

    def test_hash_different_values(self):
        """Test hash differs for models with different values"""
        model1 = SimpleModel(id="123", name="test", value=42)
        model2 = SimpleModel(id="456", name="other", value=99)

        # Note: hash collisions are possible but unlikely for different values
        assert hash(model1) != hash(model2)

    def test_hash_usable_in_set(self):
        """Test models can be used in a set"""
        model1 = SimpleModel(id="123", name="test", value=42)
        model2 = SimpleModel(id="456", name="other", value=99)
        model3 = SimpleModel(id="123", name="test", value=42)  # Duplicate of model1

        model_set = {model1, model2, model3}

        # Set should contain 2 unique models (model1 and model3 are equal)
        assert len(model_set) == 2

    def test_hash_usable_as_dict_key(self):
        """Test models can be used as dictionary keys"""
        model1 = SimpleModel(id="123", name="test", value=42)
        model2 = SimpleModel(id="456", name="other", value=99)

        model_dict = {model1: "first", model2: "second"}

        assert model_dict[model1] == "first"
        assert model_dict[model2] == "second"

    def test_hash_with_none_values(self):
        """Test hash with None values"""
        model = SimpleModel(id=None, name=None, value=None)
        result = hash(model)

        assert isinstance(result, int)

    def test_hash_consistency(self):
        """Test hash is consistent across multiple calls"""
        model = SimpleModel(id="123", name="test", value=42)
        hash1 = hash(model)
        hash2 = hash(model)

        assert hash1 == hash2


@pytest.mark.parametrize(
    ("id_val", "name_val", "value_val"),
    [
        ("test-id", "test-name", 100),
        ("", "empty-id", 0),
        (None, None, None),
        ("special-chars-!@#", "unicode-émoji-😀", -1),
    ],
)
def test_model_round_trip(id_val, name_val, value_val):
    """Test that from_dict and to_dict are inverse operations"""
    # Create model from dict
    data = {"id": id_val, "name": name_val, "value": value_val}
    model = SimpleModel.from_dict(data)

    # Convert back to dict
    result = model.to_dict()

    # Should match original data
    assert result["id"] == id_val
    assert result["name"] == name_val
    assert result["value"] == value_val


def test_model_equality_and_hash_contract():
    """Test that equal models have equal hashes (hash/eq contract)"""
    model1 = SimpleModel(id="123", name="test", value=42)
    model2 = SimpleModel(id="123", name="test", value=42)

    # If models are equal, their hashes must be equal
    if model1 == model2:
        assert hash(model1) == hash(model2)


def test_model_with_nested_complex_structure():
    """Test model with complex nested structure"""
    # Create nested structure
    simple1 = SimpleModel(id="s1", name="first", value=1)
    simple2 = SimpleModel(id="s2", name="second", value=2)

    nested = NestedModel(
        id="parent",
        nested={"key1": simple1, "key2": {"nested": simple2}},
        items=[simple1, simple2, "plain-string"],
    )

    # Convert to dict
    result = nested.to_dict()

    # Verify structure
    assert result["id"] == "parent"
    assert isinstance(result["nested"], dict)
    assert "key1" in result["nested"]
    assert result["nested"]["key1"]["id"] == "s1"
    assert isinstance(result["items"], list)
    assert len(result["items"]) == 3
    assert result["items"][0]["id"] == "s1"
    assert result["items"][2] == "plain-string"
