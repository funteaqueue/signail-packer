# yt-dlp HTTP downloader for the quiz editor's media importer.
# Python (for yt-dlp) + ffmpeg (for audio extraction / muxing). The server
# itself uses only the standard library, so there's nothing else to install.
FROM python:3.12-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# yt-dlp ships frequent fixes as sites change; pin loosely and rebuild to update.
RUN pip install --no-cache-dir "yt-dlp>=2024.0.0"

WORKDIR /app
COPY server.py /app/server.py

EXPOSE 9001
CMD ["python", "server.py"]
