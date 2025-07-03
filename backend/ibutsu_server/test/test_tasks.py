import time
import uuid
from datetime import datetime
from unittest.mock import MagicMock, patch

from ibutsu_server.test import BaseTestCase

MOCK_RUN_ID = str(uuid.uuid4())
MOCK_RUN = MagicMock(
    **{
        "id": MOCK_RUN_ID,
        "duration": 1.532734345,
        "data": {},
        "summary": {
            "collected": 1,
            "errors": 0,
            "failures": 0,
            "skips": 0,
            "xfailures": 0,
            "xpasses": 0,
            "tests": 1,
        },
    }
)
MOCK_PROJECT = str(uuid.uuid4())
MOCK_TIME = time.time()
MOCK_RESULTS = [
    MagicMock(
        **{
            "result": "passed",
            "duration": 1.532734345,
            "data": {"component": "login", "env": "qa", "project": MOCK_PROJECT},
            "start_time": MOCK_TIME,
        }
    )
]
UPDATED_RUN = MagicMock(
    **{
        "id": MOCK_RUN_ID,
        "duration": 1.532734345,
        "summary": {
            "collected": 1,
            "errors": 0,
            "failures": 0,
            "skips": 0,
            "xfailures": 0,
            "xpasses": 0,
            "tests": 1,
        },
        "data": {"component": "login", "env": "qa", "project": MOCK_PROJECT},
        "start_time": MOCK_TIME,
        "created": datetime.fromtimestamp(MOCK_TIME).isoformat(),
    }
)


class TestRunTasks(BaseTestCase):
    @patch("ibutsu_server.tasks.runs.Result")
    @patch("ibutsu_server.tasks.runs.Run")
    @patch("ibutsu_server.tasks.runs.session")
    @patch("ibutsu_server.tasks.runs.lock")
    @patch("ibutsu_server.tasks.runs.is_locked")
    def test_update_run(
        self, mocked_is_locked, mocked_lock, mocked_session, mocked_run, mocked_result
    ):
        """Test updating the run"""

        from ibutsu_server.tasks.runs import update_run  # noqa: PLC0415

        mocked_is_locked.return_value = False
        mocked_lock.return_value.__enter__.return_value = None
        mocked_run.query.get.return_value = MOCK_RUN
        # TODO how to mock into the db.session.execute that's necessary
        # for the query.scalers.all chain?
        mocked_result.query.return_value.filter.return_value.all.return_value = MOCK_RESULTS

        update_run = update_run._orig_func
        update_run(MOCK_RUN_ID)

        mocked_lock.assert_called_once()
        mocked_run.query.get.assert_called_once_with(MOCK_RUN_ID)
        mocked_result.query.filter.assert_called_once()
        mocked_result.query.filter.return_value.order_by.return_value.all.assert_called_once()
        mocked_session.add.assert_called_once()
        mocked_session.commit.assert_called_once()
