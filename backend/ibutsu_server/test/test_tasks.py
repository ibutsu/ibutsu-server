import time
import uuid
from datetime import datetime

import pytest
from ibutsu_server.test import BaseTestCase

MOCK_RUN_ID = str(uuid.uuid4())
MOCK_RUN = {"id": MOCK_RUN_ID}
MOCK_PROJECT = str(uuid.uuid4())
MOCK_TIME = time.time()
MOCK_RESULTS = [
    {
        "result": "passed",
        "duration": 1.532734345,
        "metadata": {"component": "login", "env": "qa", "project": MOCK_PROJECT},
        "starttime": MOCK_TIME,
    }
]
UPDATED_RUN = {
    "id": MOCK_RUN_ID,
    "duration": 1.532734345,
    "summary": {"errors": 0, "failures": 0, "skips": 0, "tests": 1},
    "metadata": {"component": "login", "env": "qa", "project": MOCK_PROJECT},
    "start_time": MOCK_TIME,
    "created": datetime.fromtimestamp(MOCK_TIME).isoformat(),
}


@pytest.mark.skip("Currently breaking collection")
class TestRunTasks(BaseTestCase):
    def test_update_run(self, mocker):
        """Test updating the run"""
        from ibutsu_server.tasks.runs import update_run

        mocker.patch("ibutsu_server.tasks.runs.lock")
        mocked_session = mocker.patch("ibutsu_server.tasks.runs.session")
        mocked_run = mocker.patch("ibutsu_server.tasks.runs.Run")
        mocked_run.query.get.return_value = MOCK_RUN
        mocked_result = mocker.patch("ibutsu_server.tasks.runs.Result")
        mocked_result.query.return_value.filter.return_value.all.return_value = MOCK_RESULTS

        update_run(MOCK_RUN_ID)

        mocked_run.query.get.assert_called_once_with(MOCK_RUN_ID)
        mocked_result.query.return_value.filter.assert_called_once()
        mocked_result.query.return_value.filter.return_value.all.assert_called_once()
        mocked_session.add.assert_called_once()
        mocked_session.commit.assert_called_once()
