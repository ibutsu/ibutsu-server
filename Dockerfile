FROM tiangolo/uwsgi-nginx-flask:python3.8

RUN apt-get update && apt-get install -y build-essential libmagic-mgc libxml2-dev libxslt-dev python3-dev
COPY ./backend /app
COPY ./frontend/build /app/frontend
COPY ./frontend/build/static /app/static

RUN pip3 install --no-cache-dir -r requirements.txt
