#!/usr/bin/env python3
import sys
from pathlib import Path

from ibutsu_server import get_app

SSL_CERT = Path("../certs/dev.ibutsu.org+2.pem")
SSL_KEY = Path("../certs/dev.ibutsu.org+2-key.pem")


if __name__ == "__main__":
    kwargs = {}
    if "--ssl" in sys.argv:
        if not SSL_CERT.exists() or not SSL_CERT.exists():
            print(
                "SSL certificate and/or key files not found. Please download and install mkcert "
                "and run the following command to generate these files:"
            )
            print("")
            print("  mkcert dev.ibutsu.org devapi.ibutsu.org localhost")
            print("")
            print(
                "Then place these two files in a `certs` directory in the top level directory of "
                "the project (the same directory containing `backend` and `frontend`)."
            )
            sys.exit(1)
        else:
            kwargs["ssl_context"] = (SSL_CERT, SSL_KEY)
    if "--host" in sys.argv:
        kwargs["host"] = sys.argv[sys.argv.index("--host") + 1]
    get_app().run(port=8080, debug=True, **kwargs)
