#!/bin/bash
# shellcheck source=/dev/null
source /ibutsu_venv/bin/activate


print_help() {
    cat <<EOF
Supported container Commands:

  help: print this help
  web: start the webserver
  worker: start a worker
EOF

}

echo "$@"

case $1 in
    help) print_help;;
    legacy-ssl) python -m ibutsu_server --ssl;;
    devserver)
      FLASK_APP=ibutsu_server:get_app \
      FLASK_ENV=development \
      flask run  --host 0.0.0.0 --port 8080;;
    *) echo $0 unknown; print_help;;
esac
