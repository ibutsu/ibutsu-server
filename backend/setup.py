# coding: utf-8
from setuptools import find_packages
from setuptools import setup

NAME = "ibutsu_server"
VERSION = "1.9.0"
REQUIRES = [
    # Pin Celery to be compatible with Kombu
    "celery==4.3.0",
    # Pin Kombu to 4.6.3 to get around celery/kombu/issues/236
    "kombu==4.6.3",
    "connexion",
    "dynaconf",
    "flask_cors",
    "func-timeout",
    "gunicorn",
    "lxml",
    "pymongo",
    "python-magic",
    "python_dateutil==2.6.0",
    "PyYAML",
    "redis",
    "setuptools >= 21.0.0",
    "swagger-ui-bundle==0.0.2",
    # Pin this for now, once other libraries are updated, drop this pin
    "werkzeug==0.16.1",
]

setup(
    name=NAME,
    version=VERSION,
    description="Ibutsu",
    author_email="Raoul Snyman <rsnyman@redhat.com>",
    url="",
    keywords=["OpenAPI", "Ibutsu"],
    install_requires=REQUIRES,
    packages=find_packages(),
    package_data={"": ["openapi/openapi.yaml"]},
    include_package_data=True,
    long_description="""\
    A system to store and query test results and artifacts
    """,
)
