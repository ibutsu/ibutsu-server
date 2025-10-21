import pytest

from ibutsu_server.controllers.security_controller_ import info_from_api_key


class TestSecurityController:
    """SecurityController unit test stubs"""

    @pytest.mark.parametrize(
        ("api_key", "required_scopes"),
        [
            ("valid_api_key", None),
            ("another_key", []),
            ("test_key_123", ["read", "write"]),
            ("", None),
            (None, None),
        ],
    )
    def test_info_from_api_key_returns_user_id(self, api_key, required_scopes):
        """Test case for info_from_api_key - always returns user_id"""
        result = info_from_api_key(api_key, required_scopes)

        # The function currently always returns the same structure
        expected_result = {"uid": "user_id"}
        assert result == expected_result

    def test_info_from_api_key_return_type(self):
        """Test case for info_from_api_key - verify return type is dict"""
        result = info_from_api_key("test_key", None)

        assert isinstance(result, dict)
        assert "uid" in result

    def test_info_from_api_key_uid_value(self):
        """Test case for info_from_api_key - verify uid value"""
        result = info_from_api_key("test_key", None)

        assert result["uid"] == "user_id"

    def test_info_from_api_key_with_various_scopes(self):
        """Test case for info_from_api_key - test with various scope types"""
        test_cases = [
            None,
            [],
            ["read"],
            ["read", "write"],
            ["admin", "user", "guest"],
        ]

        for scopes in test_cases:
            result = info_from_api_key("test_key", scopes)
            assert result == {"uid": "user_id"}

    def test_info_from_api_key_ignores_parameters(self):
        """Test case for info_from_api_key - function ignores input parameters"""
        # Test that different inputs produce the same output
        result1 = info_from_api_key("key1", None)
        result2 = info_from_api_key("completely_different_key", ["scope1", "scope2"])
        result3 = info_from_api_key("", [])

        assert result1 == result2 == result3 == {"uid": "user_id"}

    def test_info_from_api_key_docstring_compliance(self):
        """Test case for info_from_api_key - verify function behavior matches docstring"""
        # According to docstring, this should return info attached to api_key
        # or None if invalid. Currently it always returns the same dict.

        result = info_from_api_key("any_key", None)

        # Should return dict with uid (as per docstring mentioning 'sub' or 'uid')
        assert isinstance(result, dict)
        assert "uid" in result

        # The function doesn't currently validate the api_key, so it never returns None
        # This test documents the current behavior vs. the intended behavior
        assert result is not None
