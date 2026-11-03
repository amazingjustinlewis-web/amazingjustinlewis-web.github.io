"""Cave Cinema helper v01 - tiny local server on the Asus (port 8093, localhost only).
- /cinema/...       serves the manifest + posters from ./cinema (private: bound to 127.0.0.1)
- /api/...          forwards to the Cave Cinema server on 127.0.0.1:8090
- /dev-7q3x/...     optional local copy of the screen page (if ./web exists) so it works even offline
Adds CORS + Private-Network-Access headers so the GitHub Pages screen page can call it from Chrome/Edge."""
import http.server, os, urllib.request, sys
ROOT = os.path.dirname(os.path.abspath(__file__)); UP = "http://127.0.0.1:8090"; PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8093
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def end_headers(s):
        s.send_header("Access-Control-Allow-Origin", "*"); s.send_header("Access-Control-Allow-Headers", "Content-Type")
        s.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS"); s.send_header("Access-Control-Allow-Private-Network", "true")
        super().end_headers()
    def do_OPTIONS(s): s.send_response(204); s.end_headers()
    def proxy(s, body=None):
        req = urllib.request.Request(UP + s.path, data=body, method=s.command, headers={"Content-Type": s.headers.get("Content-Type", "application/json")})
        try:
            with urllib.request.urlopen(req, timeout=15) as r: d, c = r.read(), r.status
        except Exception as e: d, c = str(e).encode(), 502
        s.send_response(c); s.send_header("Content-Type", "application/json"); s.send_header("Content-Length", str(len(d))); s.end_headers(); s.wfile.write(d)
    def do_GET(s):
        if s.path.startswith("/api/"): return s.proxy()
        if not (s.path.startswith("/cinema/") or s.path.startswith("/web/")): s.send_error(404); return
        if s.path.startswith("/cinema/") and not (s.path.split("?")[0].endswith((".webp", ".json")) ): s.send_error(404); return  # originals stay off the wire
        super().do_GET()
    def do_POST(s):
        if not s.path.startswith("/api/"): s.send_error(404); return
        s.proxy(s.rfile.read(int(s.headers.get("Content-Length") or 0)))
    def log_message(s, *a): pass
print(f"Cave Cinema helper on http://127.0.0.1:{PORT}"); http.server.ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
