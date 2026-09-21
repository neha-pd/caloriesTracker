"""Local-only SPA server for CI; never a production server."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, unquote
root = Path(__file__).resolve().parents[1] / 'mobile' / 'dist'
class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(root), **kwargs)
    def do_GET(self):
        requested = (root / unquote(urlparse(self.path).path).lstrip('/')).resolve()
        if not requested.is_relative_to(root):
            self.send_error(403); return
        if not requested.is_file(): self.path = '/index.html'
        super().do_GET()
ThreadingHTTPServer(('127.0.0.1', 8084), Handler).serve_forever()
