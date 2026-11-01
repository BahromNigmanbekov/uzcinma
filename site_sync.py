import argparse
import hashlib
import json
import logging
import os
import sqlite3
import threading
import time
import urllib.parse
import urllib.request
from pathlib import Path
from bot import ROOT, config

wake = threading.Event()
stop = threading.Event()
sync_lock = threading.Lock()
warned = set()

def settings():
    token, admin, api = config()
    site = os.environ.get('SITE_URL', '').rstrip('/')
    service = os.environ.get('SITE_SERVICE_TOKEN', '')
    key = os.environ.get('SITE_SYNC_KEY', '')
    if not site or not service or not key:
        raise RuntimeError('Site sync settings are missing')
    if not site.startswith('https://') or urllib.parse.urlparse(site).hostname != 'uzcinma-kino.chirpyjelly4.chatgpt.site':
        raise RuntimeError('Unexpected site origin')
    return token, api, site, service, key

def call(url, method='GET', data=None, headers=None, timeout=90):
    req = urllib.request.Request(url, method=method, data=data, headers=headers or {})
    # Never output exceptions containing credential-bearing URLs.
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return json.load(response)

def sync_once():
    if not sync_lock.acquire(blocking=False):
        return
    try:
        token, api, site, service, key = settings()
        auth = {'OAI-Sites-Authorization': 'Bearer ' + service, 'X-Sync-Key': key}
        def request(path, method='GET', data=None, mime='application/json'):
            headers = {**auth, 'Content-Type': mime}
            if data is not None:
                headers['Content-Length'] = str(len(data))
            return call(site + path, method, data, headers)
        remote = request('/api/sync/status')
        existing = {str(item['id']): item for item in remote['movies']}
        db = sqlite3.connect('file:' + (ROOT / 'movies.sqlite3').as_posix() + '?mode=ro', uri=True)
        db.row_factory = sqlite3.Row
        try:
            rows = [dict(row) for row in db.execute('SELECT * FROM movies ORDER BY id')]
        finally:
            db.close()
        cache = ROOT / '.site-cache'
        cache.mkdir(exist_ok=True)

        def download(file_id, unique, size=None):
            local = cache / hashlib.sha256(unique.encode()).hexdigest()
            if local.exists() and (size is None or local.stat().st_size == size):
                return local
            if size and size > 20 * 1024 * 1024 and api == 'https://api.telegram.org':
                raise RuntimeError('Large video needs Local Bot API')
            result = call(api + '/bot' + token + '/getFile', 'POST',
                          json.dumps({'file_id': file_id}).encode(), {'Content-Type': 'application/json'})
            if not result.get('ok'):
                raise RuntimeError('Telegram getFile failed')
            path = result['result']['file_path']
            if Path(path).is_absolute():
                source = Path(path)
                if not source.is_file():
                    raise RuntimeError('Local Bot API file path is not accessible on this machine')
                return source
            url = api + '/file/bot' + token + '/' + urllib.parse.quote(path, safe='/')
            partial = local.with_suffix('.part')
            try:
                with urllib.request.urlopen(url, timeout=90) as response, partial.open('wb') as output:
                    while True:
                        chunk = response.read(1024 * 1024)
                        if not chunk:
                            break
                        output.write(chunk)
                if size is not None and partial.stat().st_size != size:
                    raise RuntimeError('Telegram file size mismatch')
                partial.replace(local)
            finally:
                partial.unlink(missing_ok=True)
            return local

        def upload(movie_id, kind, path, mime):
            size = path.stat().st_size
            if kind == 'poster' or size <= 16 * 1024 * 1024:
                request('/api/sync/media/' + movie_id + '/' + kind, 'PUT', path.read_bytes(), mime)
                return
            headers = {**auth, 'X-Media-Type': mime}
            start = call(site + '/api/sync/multipart/' + movie_id + '/create', 'POST', b'', headers)
            query = '?upload_id=' + urllib.parse.quote(start['upload_id'], safe='')
            prefix = '/api/sync/multipart/' + movie_id + '/'
            parts = []
            try:
                with path.open('rb') as source:
                    number = 1
                    while True:
                        chunk = source.read(8 * 1024 * 1024)
                        if not chunk:
                            break
                        part = request(prefix + 'part' + query + '&part=' + str(number), 'POST', chunk, 'application/octet-stream')
                        parts.append({'partNumber': part['partNumber'], 'etag': part['etag']})
                        number += 1
                request(prefix + 'complete' + query, 'POST', json.dumps({'parts': parts}).encode())
            except Exception:
                try:
                    request(prefix + 'abort' + query, 'POST', b'')
                except Exception:
                    pass
                raise

        changes = 0
        for row in rows:
            movie_id = str(row['id'])
            digest = hashlib.sha256(row['file_unique_id'].encode()).hexdigest()
            poster = row.get('poster_file_id')
            poster_unique = row.get('poster_unique_id') or poster
            poster_digest = hashlib.sha256(poster_unique.encode()).hexdigest() if poster else None
            movie = {
                'id': movie_id, 'title': (row['title'] or 'Film')[:200],
                'description': (row['description'] or '')[:3000],
                'deleted': bool(row.get('deleted', 0)),
                'video_key': 'media/' + movie_id + '/video-' + digest,
                'poster_key': 'media/' + movie_id + '/poster-' + poster_digest if poster else None,
                'file_size': int(row.get('file_size') or 0),
                'duration': int(row.get('duration') or 0),
            }
            movie['hash'] = hashlib.sha256(json.dumps(movie, sort_keys=True, ensure_ascii=True).encode()).hexdigest()
            old = existing.get(movie_id, {})
            if old.get('hash') != movie['hash']:
                request('/api/sync/movie', 'POST', json.dumps(movie).encode())
                changes += 1
            if movie['deleted']:
                continue
            try:
                if old.get('video_key') != movie['video_key'] or not old.get('video_ready'):
                    video = download(row['file_id'], row['file_unique_id'], movie['file_size'] or None)
                    mime = row.get('mime_type') or 'video/mp4'
                    upload(movie_id, 'video', video, mime)
                    logging.info('Film %s video is ready on site', movie_id)
                if poster and (old.get('poster_key') != movie['poster_key'] or not old.get('poster_ready')):
                    image = download(poster, poster_unique)
                    upload(movie_id, 'poster', image, 'image/jpeg')
                    logging.info('Film %s poster is ready on site', movie_id)
            except Exception:
                marker = movie_id + ':' + movie['hash']
                if marker not in warned:
                    logging.warning('Film %s media sync failed. Files above 20 MB need Local Bot API. Retrying later.', movie_id)
                    warned.add(marker)
        logging.info('Site sync complete: %s catalog records, %s changes', len(rows), changes)
    finally:
        sync_lock.release()

def run():
    while not stop.is_set():
        try:
            sync_once()
        except Exception:
            logging.warning('Site sync failed; local catalog is safe. Retrying in 30 seconds.')
        wake.wait(30)
        wake.clear()

def start_background():
    config()
    if not os.environ.get('SITE_URL'):
        return None
    thread = threading.Thread(target=run, name='site-sync', daemon=True)
    thread.start()
    return thread

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--once', action='store_true')
    args = parser.parse_args()
    if args.once:
        try:
            sync_once()
        except Exception:
            logging.error('Site sync failed. Check site configuration and connection.')
            raise SystemExit(1)
    else:
        try:
            run()
        except KeyboardInterrupt:
            stop.set()
