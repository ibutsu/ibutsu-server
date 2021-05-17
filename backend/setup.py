# coding: utf-8
from setuptools import find_packages
from setuptools import setup

NAME = "ibutsu_server"
VERSION = "1.13.4"
REQUIRES = [
    "alembic",
    # Pin Celery to be compatible with Kombu
    "celery==4.3.0",
    # Pin Kombu to 4.6.3 to get around celery/kombu/issues/236
    "connexion",
    "flask_bcrypt",
    "flask_cors",
    "flask_mail",
    "Flask-SQLAlchemy",
    "google-api-python-client",
    "google-auth",
    "google-auth-httplib2",
    "google-auth-oauthlib",
    "gunicorn",
    "kombu==4.6.3",
    "lxml",
    "psycopg2-binary",
    "pymongo",
    "python-jose[cryptography]",
    "python-magic",
    "python_dateutil==2.6.0",
    "PyYAML",
    "redis",
    "setuptools >= 21.0.0",
    "sqlalchemy-json",
    "sqlalchemy==1.3.23",
    "swagger-ui-bundle==0.0.2",
    "vine<5.0.0a1",
    "werkzeug",
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
