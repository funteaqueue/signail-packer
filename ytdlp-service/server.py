"""Tiny HTTP wrapper around yt-dlp for the quiz editor's media importer.

The browser can't run yt-dlp (it's a Python CLI) and can't fetch most streaming
sites directly (CORS + signed URLs), so the app POSTs a link here, this service
downloads it with yt-dlp + ffmpeg, and streams the resulting bytes back with the
CORS headers the dev app needs. yt-dlp supports far more sites than cobalt and
extracts audio cleanly, so the app treats it as the primary downloader.

Endpoints:
  GET  /health               -> "ok"
  GET  /proxy?url=...         -> fetch an arbitrary http(s) resource (e.g. an
                                 image referenced by URL in a quiz) server-side
                                 and stream the bytes back with CORS headers, so
                                 the browser can inline it as base64 at download
                                 time without hitting the host's CORS wall.
  POST /download   {url,mode} -> the media bytes (mode: "audio" | "video")
  POST /soundcloud {url}      -> for DRM-locked tracks (Spotify/Deezer): resolve
                                 the title+artist, find it on SoundCloud, and
                                 stream the full audio back.
"""
import json
import mimetypes
import os
import re
import shutil
import subprocess
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("PORT", "9001"))
# yt-dlp can be slow on big files; cap so a stuck download can't hang forever.
DOWNLOAD_TIMEOUT_S = int(os.environ.get("YTDLP_TIMEOUT", "240"))
# Keep base64 payloads (the whole clip ends up embedded in the quiz JSON) sane.
MAX_HEIGHT = os.environ.get("YTDLP_MAX_HEIGHT", "720")
META_TIMEOUT_S = 12
# Cap proxied resources so a stray huge URL can't blow up memory (each one ends
# up base64-embedded in the quiz JSON anyway).
PROXY_MAX_BYTES = int(os.environ.get("PROXY_MAX_BYTES", str(64 * 1024 * 1024)))
PROXY_TIMEOUT_S = int(os.environ.get("PROXY_TIMEOUT", "30"))
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"

SPOTIFY_TRACK_RE = re.compile(r"(?:open\.spotify\.com/(?:[a-z-]+/)?track/|spotify:track:)([A-Za-z0-9]+)", re.I)
DEEZER_TRACK_RE = re.compile(r"deezer\.com/(?:[a-z]{2}/)?track/(\d+)", re.I)
NEXT_DATA_RE = re.compile(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', re.S)

# Extensions yt-dlp may emit -> the Content-Type the editor's <audio>/<video> needs.
CONTENT_TYPES = {
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".opus": "audio/ogg",
    ".ogg": "audio/ogg",
    ".wav": "audio/wav",
    ".flac": "audio/flac",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mkv": "video/x-matroska",
    ".mov": "video/quicktime",
}


def _cors(handler: BaseHTTPRequestHandler) -> None:
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")


def _http_text(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=META_TIMEOUT_S) as resp:
        return resp.read().decode("utf-8", "replace")


def _resolve_spotify(track_id: str) -> str | None:
    """Resolve a Spotify track id to an "artist title" search query.

    Spotify is DRM-locked (no audio), but the public embed page carries the
    metadata; oEmbed (title only) is the fallback if the page layout shifts.
    """
    try:
        html = _http_text(f"https://open.spotify.com/embed/track/{track_id}")
        m = NEXT_DATA_RE.search(html)
        if m:
            data = json.loads(m.group(1))
            entity = (data.get("props", {}).get("pageProps", {})
                      .get("state", {}).get("data", {}).get("entity", {}))
            title = entity.get("title") or entity.get("name")
            artists = [a.get("name") for a in entity.get("artists", []) if a.get("name")]
            if not artists and entity.get("subtitle"):
                artists = [entity["subtitle"]]
            if title:
                return " ".join(artists + [title]).strip()
    except Exception:  # noqa: BLE001
        pass
    try:
        url = f"https://open.spotify.com/track/{track_id}"
        oembed = json.loads(_http_text(
            "https://open.spotify.com/oembed?url=" + urllib.parse.quote(url, safe="")))
        if oembed.get("title"):
            return str(oembed["title"]).strip()
    except Exception:  # noqa: BLE001
        pass
    return None


def _resolve_deezer(track_id: str) -> str | None:
    try:
        data = json.loads(_http_text(f"https://api.deezer.com/track/{track_id}"))
        title = data.get("title")
        artist = (data.get("artist") or {}).get("name")
        if title:
            return " ".join(p for p in (artist, title) if p).strip()
    except Exception:  # noqa: BLE001
        pass
    return None


def _resolve_query(url: str) -> str | None:
    m = SPOTIFY_TRACK_RE.search(url)
    if m:
        return _resolve_spotify(m.group(1))
    m = DEEZER_TRACK_RE.search(url)
    if m:
        return _resolve_deezer(m.group(1))
    return None


def _run_ytdlp(target: str, mode: str, out_dir: str) -> str:
    """Download `target` (a URL or a `scsearch1:` query) into `out_dir`.

    Returns the resulting file path.
    """
    template = os.path.join(out_dir, "media.%(ext)s")
    cmd = [
        "yt-dlp",
        "--no-playlist",
        "--no-progress",
        "--restrict-filenames",
        "-o", template,
    ]
    if mode == "audio":
        cmd += ["-x", "--audio-format", "mp3", "--audio-quality", "0"]
    else:
        cmd += [
            "-f", f"bv*[height<={MAX_HEIGHT}]+ba/b[height<={MAX_HEIGHT}]/b",
            "--merge-output-format", "mp4",
        ]
    cmd.append(target)

    subprocess.run(
        cmd,
        check=True,
        timeout=DOWNLOAD_TIMEOUT_S,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    files = [os.path.join(out_dir, f) for f in os.listdir(out_dir)]
    files = [f for f in files if os.path.isfile(f) and os.path.getsize(f) > 0]
    if not files:
        raise FileNotFoundError("yt-dlp produced no output file")
    # Largest file is the muxed result (yt-dlp may leave fragments behind).
    return max(files, key=os.path.getsize)


class Handler(BaseHTTPRequestHandler):
    # Quieter logs; default logs every request line to stderr.
    def log_message(self, *args):  # noqa: ANN001
        pass

    def do_OPTIONS(self):  # noqa: N802
        self.send_response(204)
        _cors(self)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):  # noqa: N802
        parsed = urllib.parse.urlparse(self.path)
        route = parsed.path.rstrip("/")
        if route == "/health":
            body = b"ok"
            self.send_response(200)
            _cors(self)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        elif route == "/proxy":
            self._handle_proxy(parsed.query)
        else:
            self._error(404, "not found")

    def _handle_proxy(self, query_string: str) -> None:
        params = urllib.parse.parse_qs(query_string)
        url = (params.get("url") or [""])[0].strip()
        if not url.lower().startswith(("http://", "https://")):
            self._error(400, "url must start with http(s)")
            return
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
            with urllib.request.urlopen(req, timeout=PROXY_TIMEOUT_S) as resp:
                ctype = resp.headers.get("Content-Type") or "application/octet-stream"
                data = resp.read(PROXY_MAX_BYTES + 1)
            if len(data) > PROXY_MAX_BYTES:
                self._error(413, "resource exceeds proxy size limit")
                return
            self.send_response(200)
            _cors(self)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except urllib.error.HTTPError as exc:
            self._error(502, f"upstream returned {exc.code}")
        except Exception as exc:  # noqa: BLE001
            self._error(502, f"proxy fetch failed: {exc}")

    def do_POST(self):  # noqa: N802
        route = self.path.rstrip("/")
        if route == "/download":
            self._handle_download()
        elif route == "/soundcloud":
            self._handle_soundcloud()
        else:
            self._error(404, "not found")

    def _read_json(self) -> dict | None:
        try:
            length = int(self.headers.get("Content-Length", "0"))
            return json.loads(self.rfile.read(length) or b"{}")
        except (ValueError, json.JSONDecodeError):
            self._error(400, "invalid JSON body")
            return None

    def _handle_download(self) -> None:
        payload = self._read_json()
        if payload is None:
            return
        url = str(payload.get("url", "")).strip()
        mode = "audio" if payload.get("mode") == "audio" else "video"
        if not url.lower().startswith(("http://", "https://")):
            self._error(400, "url must start with http(s)")
            return
        self._download_and_send(url, mode)

    def _handle_soundcloud(self) -> None:
        payload = self._read_json()
        if payload is None:
            return
        url = str(payload.get("url", "")).strip()
        # The frontend may pass a ready-made query; otherwise resolve from the URL.
        query = str(payload.get("query", "")).strip() or _resolve_query(url)
        if not query:
            self._error(422, "could not resolve a track to search for")
            return
        self._download_and_send(f"scsearch1:{query}", "audio")

    def _download_and_send(self, target: str, mode: str) -> None:
        tmp = tempfile.mkdtemp(prefix="ytdlp-")
        try:
            path = _run_ytdlp(target, mode, tmp)
            ext = os.path.splitext(path)[1].lower()
            ctype = CONTENT_TYPES.get(ext) or mimetypes.guess_type(path)[0] \
                or ("audio/mpeg" if mode == "audio" else "video/mp4")
            size = os.path.getsize(path)

            self.send_response(200)
            _cors(self)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(size))
            self.end_headers()
            with open(path, "rb") as fh:
                shutil.copyfileobj(fh, self.wfile, length=64 * 1024)
        except subprocess.TimeoutExpired:
            self._error(504, "download timed out")
        except (subprocess.CalledProcessError, FileNotFoundError):
            self._error(502, "yt-dlp could not download this link")
        except Exception as exc:  # noqa: BLE001
            self._error(500, f"unexpected error: {exc}")
        finally:
            shutil.rmtree(tmp, ignore_errors=True)

    def _error(self, code: int, message: str) -> None:
        body = json.dumps({"error": message}).encode()
        try:
            self.send_response(code)
            _cors(self)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass


if __name__ == "__main__":
    print(f"yt-dlp service listening on :{PORT}", flush=True)
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
