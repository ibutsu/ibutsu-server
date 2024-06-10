from setuptools import find_packages
from setuptools import setup

NAME = "ibutsu_server"
VERSION = "2.5.8"
REQUIRES = [
    "alembic==1.13.1",
    "celery==5.4.0",
    "connexion[swagger-ui]==2.14.2",
    "flask_bcrypt==1.0.1",
    "flask_cors==4.0.0",
    "flask_mail==0.9.1",
    "Flask>=2,<2.3.0",
    "Flask-SQLAlchemy<3.0",
    "flatdict==4.0.1",
    "google-api-python-client==2.126.0",
    "google-auth==2.29.0",
    "google-auth-httplib2==0.2.0",
    "google-auth-oauthlib==1.2.0",
    "gunicorn==22.0.0",
    "kombu==5.3.7",
    "lxml==5.2.1",
    "psycopg2==2.9.9",
    "pymongo==4.6.3",
    "python-jose[cryptography]==3.3.0",
    "python-magic==0.4.27",
    "python_dateutil==2.9.0.post0",
    "PyYAML==6.0.1",
    "redis==5.0.3",
    "setuptools==50.3.2",
    "sqlalchemy-json==0.7.0",
    "sqlalchemy<1.4",
    "swagger-ui-bundle==0.0.9",
    "vine==5.1.0",
    "werkzeug==2.2.3",
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
