from ibutsu_server import maybe_sql_url
from ibutsu_server.test import BaseTestCase


class TestIbutsuServer(BaseTestCase):
    def test_maybe_sql_url(self):
        """Test that the maybe_sql_url generates a correct URL"""
        conf = {
            "host": "postgres",
            "port": "5432",
            "user": "ibutsu-user",
            "password": "wofQYRmw1zSWIK_8WCq_R-HvESBJ84GcyfZm_BjMOYrSoP3mxWu58M9m-MRzU4ky",
            "database": "ibutsu",
            "sslmode": "required",
        }

        sql_url = maybe_sql_url(conf)

        assert str(sql_url) == (
            "postgresql://ibutsu-user:wofQYRmw1zSWIK_8WCq_R-HvESBJ84GcyfZm_BjMOYrSoP3mxWu58M9m"
            "-MRzU4ky@postgres:5432/ibutsu?sslmode=required"
        )

    def test_maybe_sql_url_empty_sslmode(self):
        """Test that the maybe_sql_url generates a correct URL"""
        conf = {
            "host": "postgres",
            "port": "5432",
            "user": "ibutsu-user",
            "password": "wofQYRmw1zSWIK_8WCq_R-HvESBJ84GcyfZm_BjMOYrSoP3mxWu58M9m-MRzU4ky",
            "database": "ibutsu",
            "sslmode": "",
        }

        sql_url = maybe_sql_url(conf)

        assert str(sql_url) == (
            "postgresql://ibutsu-user:wofQYRmw1zSWIK_8WCq_R-HvESBJ84GcyfZm_BjMOYrSoP3mxWu58M9m"
            "-MRzU4ky@postgres:5432/ibutsu"
        )
