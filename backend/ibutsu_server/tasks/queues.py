from ibutsu_server import get_app
from ibutsu_server.tasks import create_celery_app

app = create_celery_app(get_app().app)
