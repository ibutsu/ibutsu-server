#!/usr/bin/env python3
import sys
from pathlib import Path


def main():
    """Main entrypoint for running the Ibutsu server with uvicorn."""
    import uvicorn

    from ibutsu_server import get_app

    SSL_CERT = Path("../certs/dev.ibutsu.org+2.pem")
    SSL_KEY = Path("../certs/dev.ibutsu.org+2-key.pem")

    # Parse command-line arguments
    host = "127.0.0.1"
    port = 8080
    use_ssl = False
    debug = True

    if "--ssl" in sys.argv:
        if not SSL_CERT.exists() or not SSL_KEY.exists():
            print(
                "SSL certificate and/or key files not found. Please download and install mkcert "
                "and run the following command to generate these files:"
            )
            print("")
            print("  mkcert dev.ibutsu.org devapi.ibutsu.org localhost")
            print("")
            print(
                "Then place these two files in a `certs` directory in the top level directory of "
                "the project (the same directory containing `backend` and `frontend`)."
            )
            sys.exit(1)
        use_ssl = True

    if "--host" in sys.argv:
        host = sys.argv[sys.argv.index("--host") + 1]

    if "--port" in sys.argv:
        port = int(sys.argv[sys.argv.index("--port") + 1])

    # Get the Connexion app (ASGI app)
    app = get_app()

    # Configure uvicorn
    uvicorn_kwargs = {
        "app": app,
        "host": host,
        "port": port,
        "reload": debug,
        "log_level": "debug" if debug else "info",
    }

    if use_ssl:
        uvicorn_kwargs.update(
            {
                "ssl_keyfile": str(SSL_KEY),
                "ssl_certfile": str(SSL_CERT),
            }
        )

    print(f"Starting Ibutsu server on {'https' if use_ssl else 'http'}://{host}:{port}")
    print("Available command-line options:")
    print("  --ssl     Enable SSL/HTTPS using mkcert certificates")
    print("  --host    Set the host address (default: 127.0.0.1)")
    print("  --port    Set the port number (default: 8080)")

    # Run with uvicorn
    uvicorn.run(**uvicorn_kwargs)


if __name__ == "__main__":
    main()
