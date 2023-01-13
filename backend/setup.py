from setuptools import find_packages
from setuptools import setup

NAME = "ibutsu_server"
VERSION = "2.4.3"
REQUIRES = [
    "alembic",
    "celery",
    "connexion",
    "flask_bcrypt",
    "flask_cors",
    "flask_mail",
    "Flask>=2",
    "Flask-SQLAlchemy",
    "google-api-python-client",
    "google-auth",
    "google-auth-httplib2",
    "google-auth-oauthlib",
    "gunicorn",
    "kombu",
    "lxml",
    "psycopg2-binary",
    "pymongo",
    "python-jose[cryptography]",
    "python-magic",
    "python_dateutil",
    "PyYAML",
    "redis",
    "setuptools",
    "sqlalchemy-json",
    "sqlalchemy==1.3.23",
    "swagger-ui-bundle",
    "vine",
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
