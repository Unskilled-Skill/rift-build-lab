"""Windows entry point: local preview first, writes only after its Apply button."""
import argparse
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import os
from pathlib import Path
import secrets
import sys
import time
import webbrowser

try:
    from . import core
except ImportError:
    import core


ASSETS = Path(getattr(sys, '_MEIPASS', Path(__file__).resolve().parent))
# PyInstaller can bundle these resources at its root or under companion/.
if not (ASSETS / 'index.html').exists() and (ASSETS / 'companion' / 'index.html').exists():
    ASSETS = ASSETS / 'companion'


class PreviewServer(HTTPServer):
    allow_reuse_address = False


def make_server(bundle, catalog, data_dir, port=0, client_factory=None, initial_error=None):
    class Handler(BaseHTTPRequestHandler):
        protocol_version = 'HTTP/1.0'

        def setup(self):
            super().setup()
            self.connection.settimeout(8)

        def log_message(self, *_):
            pass  # No access logs, payloads or client authentication material.

        def send(self, status, body, content_type='application/json; charset=utf-8'):
            if not isinstance(body, bytes):
                body = json.dumps(body, ensure_ascii=False).encode()
            self.send_response(status)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Referrer-Policy', 'no-referrer')
            self.send_header('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'")
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            if self.headers.get('Host') != f'127.0.0.1:{self.server.server_port}':
                return self.send(403, {'error': 'Invalid local host.'})
            assets = {'/': ('index.html', 'text/html; charset=utf-8'), '/app.js': ('app.js', 'text/javascript; charset=utf-8'), '/style.css': ('style.css', 'text/css; charset=utf-8')}
            if self.path not in assets:
                return self.send(404, {'error': 'Not found.'})
            filename, content_type = assets[self.path]
            self.send(200, (ASSETS / filename).read_bytes(), content_type)

        def do_POST(self):
            if not core.authorized_request(self.headers.get('Host'), self.headers.get('Origin'), self.headers.get('X-Rift-Token'), self.server.server_port, self.server.token):
                return self.send(403, {'error': 'This request did not come from your local preview. Reopen the companion.'})
            if self.headers.get('Content-Type') != 'application/json' or self.headers.get('Transfer-Encoding'):
                return self.send(415, {'error': 'JSON required.'})
            try:
                size = int(self.headers.get('Content-Length', '0'))
                core.require(0 < size <= core.MAX_INPUT, 'The request is too large or empty.')
                body = core.strict_json(self.rfile.read(size).decode('utf-8'))
                core.require(isinstance(body, dict))
                self.server.last_activity = time.monotonic()
                if self.path == '/load':
                    core.keys(body, ['bundle'])
                    self.server.bundle = core.validate_bundle(body['bundle'], self.server.catalog)
                    self.server.initial_error = None
                    return self.send(200, {'ok': True, 'bundle': self.server.bundle})
                if self.path == '/status':
                    core.keys(body, [])
                    response = {'ok': True, 'ready': False, 'bundle': self.server.bundle, 'error': self.server.initial_error}
                    if self.server.bundle:
                        try:
                            client = self.server.client_factory()
                            phase = core.check_ready(client, self.server.bundle)
                            summoner = client.request('GET', '/lol-summoner/v1/current-summoner')
                            core.require(isinstance(summoner, dict) and type(summoner.get('summonerId')) is int and summoner['summonerId'] > 0, 'Sign in to League Client and retry.')
                            response.update(ready=True, phase=phase, error=None)
                        except core.CompanionError as error:
                            response['error'] = str(error)
                    return self.send(200, response)
                if self.path == '/apply':
                    core.keys(body, ['items', 'runes'])
                    core.require(self.server.bundle is not None, 'Load a build file first.')
                    result = core.apply_bundle(self.server.client_factory(), self.server.bundle, self.server.catalog, self.server.data_dir / 'backups', body['items'], body['runes'])
                    return self.send(200, dict(result, ok=True))
                if self.path == '/close':
                    core.keys(body, [])
                    self.server.closing = True
                    return self.send(200, {'ok': True})
                self.send(404, {'error': 'Not found.'})
            except core.CompanionError as error:
                self.send(400, {'error': str(error)})
            except (ValueError, UnicodeError, TypeError, KeyError, RecursionError):
                self.send(400, {'error': 'The import or client response has an unsupported format.'})
            except OSError:
                self.send(500, {'error': 'A local file or connection could not be accessed. Retry after checking League Client.'})

    server = PreviewServer(('127.0.0.1', port), Handler)
    server.token = secrets.token_urlsafe(32)
    server.bundle = core.validate_bundle(bundle, catalog) if bundle else None
    server.catalog = catalog
    server.data_dir = Path(data_dir)
    server.initial_error = initial_error
    server.client_factory = client_factory
    server.last_activity = time.monotonic()
    server.closing = False
    server.timeout = 1
    return server


def main():
    parser = argparse.ArgumentParser(description='Preview a Rift Build Lab build and explicitly apply it to League Client.')
    parser.add_argument('source', nargs='?', help='.riftbuild.json file or riftbuildlab://import link')
    parser.add_argument('--no-browser', action='store_true', help='Print the local preview URL without opening a browser')
    parser.add_argument('--port', type=int, default=0, help='Local preview port; default chooses a free ephemeral port')
    parser.add_argument('--league-dir', help='League install folder containing lockfile; saved locally without credentials')
    args = parser.parse_args()
    if not 0 <= args.port <= 65535:
        parser.error('port must be between 0 and 65535')
    data_dir = Path(os.environ.get('LOCALAPPDATA', Path.home() / 'AppData' / 'Local')) / 'RiftBuildLab'
    settings_path = data_dir / 'settings.json'
    league_dir = args.league_dir
    if league_dir:
        core.atomic_json(settings_path, {'leagueDir': str(Path(league_dir).resolve())})
    elif settings_path.exists():
        try:
            settings = core.strict_json(settings_path.read_text(encoding='utf-8'))
            league_dir = settings.get('leagueDir') if isinstance(settings, dict) else None
            if not isinstance(league_dir, str): league_dir = None
        except (core.CompanionError, OSError):
            pass
    catalog = core.strict_json((ASSETS / 'catalog.json').read_text(encoding='utf-8-sig'))
    bundle, initial_error = None, None
    if args.source:
        try:
            bundle = core.validate_bundle(core.load_input(args.source), catalog)
        except core.CompanionError as error:
            initial_error = str(error)
    def client_factory():
        return core.LCUClient(core.discover_client(league_dir), ASSETS / 'riotgames.pem')
    server = make_server(bundle, catalog, data_dir, args.port, client_factory, initial_error)
    url = f'http://127.0.0.1:{server.server_port}/#{server.token}'
    if args.no_browser:
        print(url, flush=True)
    else:
        webbrowser.open(url)
    try:
        while not server.closing and time.monotonic() - server.last_activity < 15 * 60:
            server.handle_request()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
