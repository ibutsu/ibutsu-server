"""This file provides an entry point for the Docker container"""
from ibutsu_server import get_app

app = get_app()
