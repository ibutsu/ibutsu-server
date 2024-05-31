from setuptools import find_packages, setup

NAME = "ibutsu_server"
VERSION = "2.5.8"
REQUIRES = [
    "alembic",
    "celery",
    "connexion[swagger-ui]==2.14.2",
    "flask_bcrypt",
    "flask_cors",
    "flask_mail",
    "Flask>=2,<2.3.0",
    "Flask-SQLAlchemy<3.0",
    "flatdict",
    "google-api-python-client",
    "google-auth",
    "google-auth-httplib2",
    "google-auth-oauthlib",
    "gunicorn",
    "kombu",
    "lxml",
    "psycopg2",
    "pymongo",
    "python-jose[cryptography]",
    "python-magic",
    "python_dateutil",
    "PyYAML",
    "redis",
    "setuptools",
    "sqlalchemy-json",
    "sqlalchemy<1.4",
    "swagger-ui-bundle==0.0.9",
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
