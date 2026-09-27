#!/bin/sh
# Startet die App lokal. Module und Service Worker brauchen http, darum reicht ein Doppelklick auf index.html nicht.
# Eigener Server statt `python3 -m http.server`: dessen Warteschlange (5) verliert Verbindungen,
# wenn der Browser die vielen Module gleichzeitig lädt.
cd "$(dirname "$0")" || exit 1
PORT="${PORT:-8080}"
echo "App läuft auf http://localhost:$PORT  (Beenden mit Ctrl+C)"
exec python3 - "$PORT" <<'PY'
import sys
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

class Server(ThreadingHTTPServer):
    request_queue_size = 128
    daemon_threads = True

class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.js': 'text/javascript', '.webmanifest': 'application/manifest+json'}
    def log_message(self, *args):
        pass

Server(('127.0.0.1', int(sys.argv[1])), Handler).serve_forever()
PY
