from unittest.mock import MagicMock, Mock, patch

from ibutsu_server.db.models import Run
from ibutsu_server.widgets.result_summary import get_result_summary


@patch("ibutsu_server.widgets.result_summary.apply_filters")
@patch("ibutsu_server.widgets.result_summary.session")
def test_get_result_summary(mocked_session: Mock, mocked_apply_filters: Mock):
    """Test the get_result_summary() function"""
    # GIVEN: Some mocked objects and data
    mocked_apply_filters.side_effect = lambda query, _filters, _run: query
    mocked_query = MagicMock()
    # TODO how to mock into the db.session.execute that's necessary
    # for the query.scalers.all chain?
    mocked_query.all.return_value = [
        # errors, skips, failures, tests, xfailures, xpasses
        (0, 0, 0, 17, 0, 0),
        (None, 0, 0, 3, 0, 0),
        (0, 1, None, 7, 0, 0),
        (1, None, 0, 1, 0, 0),
        (2, 5, 3, 88, None, None),
        (0, 0, 0, None, 0, 0),
    ]
    mocked_session.query.return_value = mocked_query

    # Call get_result_summary()
    summary = get_result_summary(
        "prodTestSuite", "prod", "prodTestSuite", "d13d1301-a663-4b26-a9e5-77364e420c0c"
    )

    # THEN: We should get the correct summary back, and the correct calls should have been made
    expected_filters = [
        "source=prodTestSuite",
        "env=prod",
        "metadata.jenkins.job_name=prodTestSuite",
        "project_id=d13d1301-a663-4b26-a9e5-77364e420c0c",
    ]
    expected_summary = {
        "error": 3,
        "skipped": 6,
        "failed": 3,
        "passed": 104,
        "total": 116,
        "xfailed": 0,
        "xpassed": 0,
    }
    assert summary == expected_summary
    mocked_apply_filters.assert_called_once_with(mocked_query, expected_filters, Run)
