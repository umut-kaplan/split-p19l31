#!/bin/sh
# Startet die App lokal. Module und Service Worker brauchen http, darum reicht ein Doppelklick auf index.html nicht.
cd "$(dirname "$0")" || exit 1
PORT="${PORT:-8080}"
echo "App läuft auf http://localhost:$PORT  (Beenden mit Ctrl+C)"
exec python3 -m http.server "$PORT" --bind 127.0.0.1
