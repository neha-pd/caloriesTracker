"""Local SPA server for the exported PWA; no production backend/proxy."""
import argparse
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=5174);parser.add_argument('--directory',default='mobile/dist');args=parser.parse_args()
class SPA(SimpleHTTPRequestHandler):
 def __init__(self,*a,**kw):super().__init__(*a,directory=args.directory,**kw)
 def do_GET(self):
  if not Path(self.translate_path(self.path)).exists() and '.' not in self.path.rsplit('/',1)[-1]:self.path='/index.html'
  return super().do_GET()
 def log_message(self,*a):pass
ThreadingHTTPServer(('127.0.0.1',args.port),SPA).serve_forever()
