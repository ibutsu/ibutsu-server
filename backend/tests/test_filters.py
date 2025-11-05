"""Tests for the filters module."""

from ibutsu_server.filters import has_project_filter


class TestHasProjectFilter:
    """Tests for the has_project_filter function."""

    def test_has_project_filter_with_project_id(self):
        """Test that project_id filter is detected."""
        filters = ["project_id=abc123"]
        assert has_project_filter(filters) is True

    def test_has_project_filter_with_data_project(self):
        """Test that data.project filter is detected."""
        filters = ["data.project=my-project"]
        assert has_project_filter(filters) is True

    def test_has_project_filter_with_metadata_project(self):
        """Test that metadata.project filter is detected."""
        filters = ["metadata.project=my-project"]
        assert has_project_filter(filters) is True

    def test_has_project_filter_with_multiple_filters(self):
        """Test that project filter is detected among multiple filters."""
        filters = ["result=passed", "project_id=abc123", "test_id~example"]
        assert has_project_filter(filters) is True

    def test_has_project_filter_without_project_filter(self):
        """Test that absence of project filter is detected."""
        filters = ["result=passed", "test_id~example"]
        assert has_project_filter(filters) is False

    def test_has_project_filter_with_empty_list(self):
        """Test that empty filter list returns False."""
        filters = []
        assert has_project_filter(filters) is False

    def test_has_project_filter_with_none(self):
        """Test that None filter list returns False."""
        filters = None
        assert has_project_filter(filters) is False

    def test_has_project_filter_with_different_operators(self):
        """Test that project filter with different operators is detected."""
        assert has_project_filter(["project_id=abc"]) is True
        assert has_project_filter(["project_id!abc"]) is True
        assert has_project_filter(["project_id~abc"]) is True
        assert has_project_filter(["project_id*abc;def"]) is True

    def test_has_project_filter_with_similar_field_names(self):
        """Test that only exact project field matches are detected."""
        # These should not match
        assert has_project_filter(["my_project_id=abc"]) is False
        assert has_project_filter(["data.myproject=abc"]) is False
        assert has_project_filter(["project=abc"]) is False
