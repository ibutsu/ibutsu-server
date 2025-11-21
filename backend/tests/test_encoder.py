"""Tests for ibutsu_server.encoder module"""

from ibutsu_server.encoder import IbutsuJSONProvider
from ibutsu_server.models.base_model_ import Model


class MockModel(Model):
    """Mock model class for testing IbutsuJSONProvider"""

    openapi_types = {
        "id": str,
        "name": str,
        "value": int,
        "optional": str,
    }

    attribute_map = {
        "id": "id",
        "name": "name",
        "value": "value",
        "optional": "optional",
    }

    def __init__(self, id=None, name=None, value=None, optional=None):
        self.id = id
        self.name = name
        self.value = value
        self.optional = optional


class TestIbutsuJSONProvider:
    """Tests for IbutsuJSONProvider class"""

    def test_provider_initialization(self, flask_app):
        """Test IbutsuJSONProvider can be initialized"""
        client, _ = flask_app

        with client.application.app_context():
            provider = IbutsuJSONProvider(client.application)
            assert provider is not None
            assert not provider.include_nulls

    def test_provider_include_nulls_default(self, flask_app):
        """Test default include_nulls is False"""
        client, _ = flask_app

        with client.application.app_context():
            provider = IbutsuJSONProvider(client.application)
            assert not provider.include_nulls

    def test_provider_include_nulls_can_be_modified(self, flask_app):
        """Test include_nulls can be set to True"""
        client, _ = flask_app

        with client.application.app_context():
            provider = IbutsuJSONProvider(client.application)
            provider.include_nulls = True
            assert provider.include_nulls

    def test_default_method_with_model_excludes_nulls(self, flask_app):
        """Test default method excludes null values from Model objects"""
        client, _ = flask_app

        with client.application.app_context():
            provider = IbutsuJSONProvider(client.application)
            provider.include_nulls = False

            # Create mock model with some null values
            model = MockModel(id="123", name="test", value=42, optional=None)

            result = provider.default(model)

            # Verify result is a dictionary
            assert isinstance(result, dict)
            # Verify non-null values are included
            assert result["id"] == "123"
            assert result["name"] == "test"
            assert result["value"] == 42
            # Verify null value is excluded
            assert "optional" not in result

    def test_default_method_with_model_includes_nulls(self, flask_app):
        """Test default method includes null values when include_nulls is True"""
        client, _ = flask_app

        with client.application.app_context():
            provider = IbutsuJSONProvider(client.application)
            provider.include_nulls = True

            # Create mock model with some null values
            model = MockModel(id="123", name="test", value=42, optional=None)

            result = provider.default(model)

            # Verify result is a dictionary
            assert isinstance(result, dict)
            # Verify all values are included, even None
            assert result["id"] == "123"
            assert result["name"] == "test"
            assert result["value"] == 42
            assert "optional" in result
            assert result["optional"] is None

    def test_default_method_with_all_null_values(self, flask_app):
        """Test default method with all attributes as None"""
        client, _ = flask_app

        with client.application.app_context():
            provider = IbutsuJSONProvider(client.application)
            provider.include_nulls = False

            # Create mock model with all null values
            model = MockModel(id=None, name=None, value=None, optional=None)

            result = provider.default(model)

            # Verify result is an empty dictionary when all values are None
            assert isinstance(result, dict)
            assert len(result) == 0

    def test_default_method_with_all_null_values_include_nulls(self, flask_app):
        """Test default method with all attributes as None and include_nulls=True"""
        client, _ = flask_app

        with client.application.app_context():
            provider = IbutsuJSONProvider(client.application)
            provider.include_nulls = True

            # Create mock model with all null values
            model = MockModel(id=None, name=None, value=None, optional=None)

            result = provider.default(model)

            # Verify all null values are included
            assert isinstance(result, dict)
            assert len(result) == 4
            assert result["id"] is None
            assert result["name"] is None
            assert result["value"] is None
            assert result["optional"] is None

    def test_default_method_with_no_null_values(self, flask_app):
        """Test default method with no null values"""
        client, _ = flask_app

        with client.application.app_context():
            provider = IbutsuJSONProvider(client.application)

            # Create mock model with no null values
            model = MockModel(id="456", name="another", value=99, optional="present")

            result = provider.default(model)

            # Verify all values are included
            assert isinstance(result, dict)
            assert len(result) == 4
            assert result["id"] == "456"
            assert result["name"] == "another"
            assert result["value"] == 99
            assert result["optional"] == "present"

    def test_default_method_uses_attribute_map(self, flask_app):
        """Test that default method uses attribute_map for key names"""
        client, _ = flask_app

        with client.application.app_context():
            provider = IbutsuJSONProvider(client.application)

            # Mock model where attribute_map differs from openapi_types
            class MappedModel(Model):
                openapi_types = {"internal_name": str}
                attribute_map = {"internal_name": "externalName"}

                def __init__(self):
                    self.internal_name = "value"

            model = MappedModel()
            result = provider.default(model)

            # Verify the mapped attribute name is used
            assert "externalName" in result
            assert result["externalName"] == "value"
            assert "internal_name" not in result

    def test_default_method_with_api_model(self, flask_app):
        """Test default method with Model subclass that would be used in API responses"""
        client, _ = flask_app

        with client.application.app_context():
            provider = IbutsuJSONProvider(client.application)

            # Create a mock API response model
            model = MockModel(id="test-id", name="test-name", value=42, optional="present")

            result = provider.default(model)

            # Verify result is a dictionary with expected fields
            assert isinstance(result, dict)
            assert result["id"] == "test-id"
            assert result["name"] == "test-name"
            assert result["value"] == 42
            assert result["optional"] == "present"

    def test_default_method_preserves_zero_values(self, flask_app):
        """Test that zero values are not treated as null"""
        client, _ = flask_app

        with client.application.app_context():
            provider = IbutsuJSONProvider(client.application)
            provider.include_nulls = False

            # Create mock model with zero value
            model = MockModel(id="789", name="zero-test", value=0, optional=None)

            result = provider.default(model)

            # Verify zero is included (not treated as null/falsy)
            assert "value" in result
            assert result["value"] == 0
            # Verify actual None is still excluded
            assert "optional" not in result

    def test_default_method_preserves_empty_string(self, flask_app):
        """Test that empty strings are preserved"""
        client, _ = flask_app

        with client.application.app_context():
            provider = IbutsuJSONProvider(client.application)
            provider.include_nulls = False

            # Create mock model with empty string
            model = MockModel(id="", name="empty", value=42, optional=None)

            result = provider.default(model)

            # Verify empty string is included (not treated as null)
            assert "id" in result
            assert result["id"] == ""
            # Verify actual None is excluded
            assert "optional" not in result

    def test_default_method_preserves_false_boolean(self, flask_app):
        """Test that False boolean values are preserved"""
        client, _ = flask_app

        with client.application.app_context():
            provider = IbutsuJSONProvider(client.application)
            provider.include_nulls = False

            # Mock model with boolean attribute
            class BoolModel(Model):
                openapi_types = {"active": bool, "optional": str}
                attribute_map = {"active": "active", "optional": "optional"}

                def __init__(self):
                    self.active = False
                    self.optional = None

            model = BoolModel()
            result = provider.default(model)

            # Verify False is included (not treated as null/falsy)
            assert "active" in result
            assert result["active"] is False
            # Verify actual None is excluded
            assert "optional" not in result

    def test_default_method_with_nested_models(self, flask_app):
        """Test default method doesn't recursively process nested models"""
        client, _ = flask_app

        with client.application.app_context():
            provider = IbutsuJSONProvider(client.application)

            # Model with nested model as attribute
            nested = MockModel(id="nested", name="inner", value=1, optional=None)

            class ContainerModel(Model):
                openapi_types = {"id": str, "nested": object}
                attribute_map = {"id": "id", "nested": "nested"}

                def __init__(self, nested_obj):
                    self.id = "container"
                    self.nested = nested_obj

            model = ContainerModel(nested)
            result = provider.default(model)

            # The nested model should be included as-is (not automatically serialized)
            assert isinstance(result, dict)
            assert result["id"] == "container"
            assert "nested" in result

    def test_default_method_with_non_model_delegates_to_parent(self, flask_app):
        """Test default method delegates to Flask's DefaultJSONProvider for non-Model objects"""
        import pytest

        client, _ = flask_app

        with client.application.app_context():
            provider = IbutsuJSONProvider(client.application)

            # Test with a standard dict (should pass through)
            standard_dict = {"key": "value"}
            result = provider.default(standard_dict)
            assert result == standard_dict

            # Test with a non-serializable object (should raise TypeError from parent)
            class NonSerializable:
                pass

            with pytest.raises(TypeError):
                provider.default(NonSerializable())
