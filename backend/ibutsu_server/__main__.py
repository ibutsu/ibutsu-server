#!/usr/bin/env python3
from ibutsu_server import get_app

if __name__ == "__main__":
    get_app().run(port=8080, debug=True)
