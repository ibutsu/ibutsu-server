import time
import uuid
from datetime import datetime

from bson import ObjectId
from ibutsu_server.tasks.runs import update_run

MOCK_RUN_ID = "5d9cab5602dee4231390e36a"
MOCK_RUN = {"_id": ObjectId(MOCK_RUN_ID), "id": MOCK_RUN_ID}
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
    "_id": ObjectId(MOCK_RUN_ID),
    "id": MOCK_RUN_ID,
    "duration": 1.532734345,
    "summary": {"errors": 0, "failures": 0, "skips": 0, "xfailures": 0, "xpasses": 0, "tests": 1},
    "metadata": {"component": "login", "env": "qa", "project": MOCK_PROJECT},
    "start_time": MOCK_TIME,
    "created": datetime.fromtimestamp(MOCK_TIME).isoformat(),
}


def test_update_run(mocker):
    """Test updating the run"""
    mocked_mongo = mocker.patch("ibutsu_server.tasks.runs.mongo")
    mocked_mongo.runs.find_one.return_value = MOCK_RUN
    mocked_mongo.results.find.return_value = MOCK_RESULTS
    mocker.patch("ibutsu_server.tasks.runs.Redis")
    mocker.patch("ibutsu_server.tasks.runs.settings")

    update_run(MOCK_RUN_ID)

    mocked_mongo.runs.find_one.assert_called_once_with({"_id": ObjectId(MOCK_RUN_ID)})
    # TODO: update this to start_time after !203 is merged
    mocked_mongo.results.find.assert_called_once_with(
        {"metadata.run": MOCK_RUN_ID}, sort=[("start_time", 1)]
    )
    mocked_mongo.runs.replace_one.assert_called_once_with(
        {"_id": ObjectId(MOCK_RUN_ID)}, UPDATED_RUN
    )
