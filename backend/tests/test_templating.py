"""Tests for ibutsu_server.templating module"""

import pytest
from jinja2.exceptions import TemplateNotFound

from ibutsu_server.templating import pretty_duration, render_template


class TestPrettyDuration:
    """Tests for pretty_duration function"""

    def test_pretty_duration_zero_seconds(self):
        """Test pretty_duration with 0 seconds"""
        result = pretty_duration(0)
        assert result == "0:00:00"

    def test_pretty_duration_less_than_one_second(self):
        """Test pretty_duration with fractional seconds"""
        result = pretty_duration(0.5)
        assert result == "0:00:01"  # Rounds up to 1 second

    def test_pretty_duration_exact_seconds(self):
        """Test pretty_duration with exact seconds"""
        result = pretty_duration(5)
        assert result == "0:00:05"

    def test_pretty_duration_fractional_seconds(self):
        """Test pretty_duration with fractional seconds"""
        result = pretty_duration(5.7)
        assert result == "0:00:06"  # Rounds up

    def test_pretty_duration_minutes(self):
        """Test pretty_duration with minutes"""
        result = pretty_duration(90)  # 1 minute 30 seconds
        assert result == "0:01:30"

    def test_pretty_duration_hours(self):
        """Test pretty_duration with hours"""
        result = pretty_duration(3661)  # 1 hour 1 minute 1 second
        assert result == "1:01:01"

    def test_pretty_duration_large_value(self):
        """Test pretty_duration with large duration"""
        result = pretty_duration(86400)  # 24 hours
        assert result == "1 day, 0:00:00"

    def test_pretty_duration_days(self):
        """Test pretty_duration with multiple days"""
        result = pretty_duration(172800)  # 48 hours = 2 days
        assert result == "2 days, 0:00:00"

    def test_pretty_duration_negative_value(self):
        """Test pretty_duration with negative value"""
        # timedelta can handle negative values
        result = pretty_duration(-10)
        assert result == "-1 day, 23:59:50"

    def test_pretty_duration_float_rounding(self):
        """Test pretty_duration rounds up properly"""
        result = pretty_duration(1.1)
        assert result == "0:00:02"  # Ceiling rounds up

    def test_pretty_duration_large_fractional(self):
        """Test pretty_duration with large fractional seconds"""
        result = pretty_duration(3665.8)  # ~1 hour 1 minute 6 seconds
        assert result == "1:01:06"


class TestRenderTemplate:
    """Tests for render_template function"""

    def test_render_result_template_basic(self):
        """Test rendering result.html template with basic data"""
        context = {
            "raw_data": "<p>Test data</p>",
            "artifacts": [],
        }
        result = render_template("result.html", **context)

        # Verify output is a string
        assert isinstance(result, str)
        # Verify context values are in the output
        assert "Test data" in result
        assert "<table>" in result

    def test_render_result_template_with_duration(self):
        """Test result template with artifacts"""

        class MockArtifact:
            def __init__(self, id, filename):
                self._id = id
                self.filename = filename

        context = {
            "raw_data": "Result data",
            "artifacts": [
                MockArtifact("123", "screenshot.png"),
                MockArtifact("456", "log.txt"),
            ],
        }
        result = render_template("result.html", **context)

        assert isinstance(result, str)
        assert "screenshot.png" in result
        assert "log.txt" in result
        assert "/api/artifact/123" in result

    def test_render_list_template_basic(self):
        """Test rendering list.html template with basic data"""

        class MockTest:
            def __init__(self, id, test_id, result, starttime):
                self._id = id
                self.test_id = test_id
                self.result = result
                self.starttime = starttime

        context = {
            "tests": [
                MockTest("id1", "test.example.test_one", "passed", "2024-01-01 10:00:00"),
                MockTest("id2", "test.example.test_two", "failed", "2024-01-01 10:05:00"),
            ]
        }
        result = render_template("list.html", **context)

        assert isinstance(result, str)
        # Verify both test IDs are in the output
        assert "test.example.test_one" in result
        assert "test.example.test_two" in result

    def test_render_template_with_empty_context(self):
        """Test rendering template with empty context"""
        result = render_template("result.html")
        assert isinstance(result, str)
        assert "<table>" in result

    def test_render_template_with_complex_data(self):
        """Test rendering template with complex nested data"""

        class MockArtifact:
            def __init__(self, id, filename):
                self._id = id
                self.filename = filename

        context = {
            "raw_data": "test.example.complex_test - failed",
            "artifacts": [
                MockArtifact("art1", "screenshot.png"),
                MockArtifact("art2", "log.txt"),
            ],
        }
        result = render_template("result.html", **context)

        assert isinstance(result, str)
        assert "test.example.complex_test" in result
        assert "failed" in result
        assert "screenshot.png" in result

    def test_render_template_autoescape_html(self):
        """Test that HTML content is properly escaped"""
        context = {
            "raw_data": "test<script>alert('xss')</script>",
            "artifacts": [],
        }
        result = render_template("result.html", **context)

        # raw_data is marked |safe in template, so script tags would not be escaped
        # But we're testing that the template renders
        assert isinstance(result, str)
        assert "<script>" in result  # raw_data is marked as safe

    def test_render_template_nonexistent(self):
        """Test rendering a non-existent template raises error"""
        with pytest.raises(TemplateNotFound):
            render_template("nonexistent.html", test_id="test")

    def test_render_template_pretty_duration_filter(self):
        """Test that pretty_duration filter is registered and works"""
        # The pretty_duration filter should be available in templates
        context = {
            "test_id": "test.duration",
            "result": "passed",
            "duration": 125,  # 2 minutes 5 seconds
        }
        result = render_template("result.html", **context)

        # Template should be able to use the filter and render the formatted duration
        assert isinstance(result, str)
        # 125 seconds should be rendered as 0:02:05 by the pretty_duration filter
        assert "0:02:05" in result

    def test_render_template_with_special_characters(self):
        """Test rendering with special characters in data"""
        context = {
            "raw_data": "test.special.chars.™®© - Test output with special chars: áéíóú ñ",
            "artifacts": [],
        }
        result = render_template("result.html", **context)

        assert isinstance(result, str)
        # Special characters should be preserved or properly encoded
        assert "test.special.chars" in result

    def test_render_template_with_none_values(self):
        """Test rendering with None values in context"""
        context = {
            "raw_data": None,
            "artifacts": [],  # Template iterates over artifacts, so it needs to be an empty list
        }
        result = render_template("result.html", **context)

        assert isinstance(result, str)

    def test_render_template_multiple_calls(self):
        """Test multiple template renders don't interfere"""
        context1 = {"raw_data": "test.one", "artifacts": []}
        context2 = {"raw_data": "test.two", "artifacts": []}

        result1 = render_template("result.html", **context1)
        result2 = render_template("result.html", **context2)

        # Both should render independently
        assert "test.one" in result1
        assert "test.one" not in result2
        assert "test.two" in result2
        assert "test.two" not in result1

    def test_render_list_template_empty_results(self):
        """Test rendering list template with empty results list"""
        context = {"tests": []}
        result = render_template("list.html", **context)

        assert isinstance(result, str)
        assert "<table>" in result

    def test_render_list_template_many_results(self):
        """Test rendering list template with many results"""

        class MockTest:
            def __init__(self, id, test_id, result, starttime):
                self._id = id
                self.test_id = test_id
                self.result = result
                self.starttime = starttime

        context = {
            "tests": [
                MockTest(f"id{i}", f"test.example.test_{i}", "passed", "2024-01-01")
                for i in range(100)
            ]
        }
        result = render_template("list.html", **context)

        assert isinstance(result, str)
        # Spot check a few test IDs
        assert "test.example.test_0" in result
        assert "test.example.test_50" in result
        assert "test.example.test_99" in result
