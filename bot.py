import json
import logging
import os
import sqlite3
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')


def config():
    path = ROOT / '.env'
    if path.exists():
        for line in path.read_text(encoding='utf-8-sig').splitlines():
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ.setdefault(key.strip(), value.strip())
    token = os.environ.get('BOT_TOKEN', '').strip()
    admin = os.environ.get('ADMIN_USER_ID', '').strip()
    if not token:
        raise SystemExit('.env faylida BOT_TOKEN ni kiriting.')
    if admin and not admin.isdecimal():
        raise SystemExit('ADMIN_USER_ID raqam bo‘lishi kerak.')
    base = os.environ.get('BOT_API_BASE', 'https://api.telegram.org').rstrip('/')
    return token, int(admin) if admin else None, base



def store_artwork(db, movie_id, kind, photo):
    columns = {'poster': ('poster_file_id', 'poster_unique_id'), 'banner': ('banner_file_id', 'banner_unique_id')}
    file_column, unique_column = columns[kind]
    with db:
        db.execute('UPDATE movies SET ' + file_column + '=?,' + unique_column + '=? WHERE id=?',
                   (photo['file_id'], photo.get('file_unique_id') or photo['file_id'], movie_id))


def main():
    token, admin, base = config()
    db = sqlite3.connect(ROOT / 'movies.sqlite3')
    db.execute('PRAGMA journal_mode=WAL')
    db.executescript('''
    CREATE TABLE IF NOT EXISTS movies (
      id INTEGER PRIMARY KEY, file_unique_id TEXT UNIQUE NOT NULL,
      file_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL,
      file_name TEXT, mime_type TEXT, file_size INTEGER, duration INTEGER,
      source_chat_id INTEGER NOT NULL, source_message_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    ''')
    columns = {row[1] for row in db.execute('PRAGMA table_info(movies)')}
    if 'deleted' not in columns:
        db.execute('ALTER TABLE movies ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0')
    for column in ('poster_file_id', 'poster_unique_id', 'banner_file_id', 'banner_unique_id'):
        if column not in columns:
            db.execute('ALTER TABLE movies ADD COLUMN ' + column + ' TEXT')
    db.commit()

    def api(method, values):
        req = urllib.request.Request(base + '/bot' + token + '/' + method,
            data=json.dumps(values).encode(), headers={'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(req, timeout=65) as response:
                result = json.load(response)
        except urllib.error.HTTPError as exc:
            # Do not log exception URLs: they contain the bot token.
            raise RuntimeError('Telegram HTTP status: ' + str(exc.code)) from None
        if not result.get('ok'):
            raise RuntimeError('Telegram API request failed')
        return result['result']

    def reply(chat, text):
        api('sendMessage', {'chat_id': chat, 'text': text})

    from site_sync import start_background, wake, stop
    start_background()
    me = api('getMe', {})
    logging.info('Bot ready: @%s', me['username'])
    if admin is None:
        logging.warning('ADMIN_USER_ID is missing; movie uploads are disabled.')
    row = db.execute("SELECT value FROM state WHERE key='offset'").fetchone()
    offset = int(row[0]) if row else 0
    while True:
        try:
            updates = api('getUpdates', {'offset': offset, 'timeout': 50, 'allowed_updates': ['message']})
            for update in updates:
                msg = update.get('message', {})
                chat = msg.get('chat', {})
                user = msg.get('from', {})
                text = msg.get('text') or (msg.get('caption', '') if msg.get('photo') else '')
                command = text.split()[0].split('@')[0] if text else ''
                if chat.get('type') == 'private' and not user.get('is_bot'):
                    chat_id = chat['id']
                    if command == '/id':
                        reply(chat_id, 'Sizning Telegram ID: ' + str(user['id']))
                    elif admin is None or user.get('id') != admin:
                        reply(chat_id, 'Bu bot faqat administrator uchun. ID olish: /id')
                    elif command in {'/start', '/help'}:
                        reply(chat_id, 'Filmni video yoki fayl sifatida yuboring. Caption: birinchi qator nomi, qolgan qatorlar tavsif.\n/list - filmlar\n/show ID - filmni tekshirish\n/title ID yangi nom\n/description ID yangi tavsif\n/description ID - tavsifni tozalash\nBanner: rasm yuboring, caption: /banner ID\nPoster: rasm yuboring, caption: /poster ID\n/delete ID - yashirish\n/restore ID - tiklash\n/sync - saytni yangilash\n/id - Telegram ID')
                    elif command == '/sync':
                        wake.set()
                        reply(chat_id, 'Saytga sinxronlash boshlandi. /list orqali film ID larini oling.')
                    elif command == '/list':
                        rows = db.execute('SELECT id, title FROM movies WHERE deleted=0 ORDER BY id DESC LIMIT 20').fetchall()
                        reply(chat_id, '\n'.join(str(i) + '. ' + title[:150] for i, title in rows) or 'Hali film yo‘q.')
                    elif command in {'/title', '/description', '/poster', '/banner', '/show'}:
                        parts = text.split(maxsplit=2)
                        if len(parts) < 2 or not parts[1].isascii() or not parts[1].isdecimal() or len(parts[1]) > 18:
                            reply(chat_id, 'Film ID kerak. /help orqali namunalarni oling.')
                        else:
                            movie_id = int(parts[1])
                            movie = db.execute('SELECT title,description,poster_file_id,deleted FROM movies WHERE id=?', (movie_id,)).fetchone()
                            if movie is None:
                                reply(chat_id, 'Bunday ID bilan film topilmadi.')
                            elif command == '/show':
                                info = 'ID: ' + str(movie_id) + '\n' + movie[0] + '\n' + movie[1] + '\nHolati: ' + ('yashirilgan' if movie[3] else 'katalogda')
                                reply(chat_id, info[:4000])
                                if movie[2]:
                                    api('sendPhoto', {'chat_id': chat_id, 'photo': movie[2]})
                            elif command in {'/poster', '/banner'}:
                                if not msg.get('photo') or len(parts) != 2:
                                    reply(chat_id, 'Rasmni photo sifatida yuboring, caption: ' + command + ' ' + str(movie_id))
                                else:
                                    store_artwork(db, movie_id, command[1:], msg['photo'][-1])
                                    label = 'Banner' if command == '/banner' else 'Poster'
                                    reply(chat_id, label + ' saqlandi. Sayt bir necha soniyada yangilanadi.')
                            else:
                                value = parts[2].strip() if len(parts) == 3 else ''
                                limit = 200 if command == '/title' else 3000
                                if (command == '/title' and not value) or len(value) > limit:
                                    reply(chat_id, "Nom 1-200, tavsif 0-3000 belgi bolishi kerak.")
                                else:
                                    column = 'title' if command == '/title' else 'description'
                                    with db:
                                        db.execute('UPDATE movies SET ' + column + '=? WHERE id=?', (value,movie_id))
                                    reply(chat_id, 'Saqlandi. Tekshirish: /show ' + str(movie_id))
                    elif command in {'/delete', '/restore'}:
                        parts = text.split()
                        if len(parts) != 2 or not parts[1].isascii() or not parts[1].isdecimal() or len(parts[1]) > 18:
                            reply(chat_id, 'Namuna: ' + command + ' 3. Film ID sini /list orqali oling.')
                        else:
                            movie_id = int(parts[1])
                            movie = db.execute('SELECT title,deleted FROM movies WHERE id=?', (movie_id,)).fetchone()
                            if movie is None:
                                reply(chat_id, 'Bunday ID bilan film topilmadi.')
                            else:
                                deleted = 1 if command == '/delete' else 0
                                with db:
                                    db.execute('UPDATE movies SET deleted=? WHERE id=?', (deleted, movie_id))
                                if deleted:
                                    reply(chat_id, "Katalogdan o'chirildi: " + movie[0] + '\nTiklash: /restore ' + str(movie_id) + '\nTelegramdagi video xabari saqlanib qoladi.')
                                else:
                                    reply(chat_id, 'Film katalogga tiklandi: ' + movie[0])
                    elif msg.get('video') or msg.get('document'):
                        media = msg.get('video') or msg['document']
                        mime = media.get('mime_type', '')
                        name = media.get('file_name', '')
                        if not msg.get('video') and not (mime.startswith('video/') or Path(name).suffix.lower() in {'.mp4', '.mkv', '.avi', '.mov', '.webm', '.m4v'}):
                            reply(chat_id, 'Video fayl yuboring.')
                        else:
                            caption = msg.get('caption', '').strip()
                            title, _, description = caption.partition('\n')
                            title = title.strip() or name or 'Nomsiz film'
                            with db:
                                db.execute('''INSERT INTO movies
                                (file_unique_id,file_id,title,description,file_name,mime_type,file_size,duration,source_chat_id,source_message_id)
                                VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(file_unique_id) DO NOTHING''',
                                (media['file_unique_id'],media['file_id'],title,description,name,mime,media.get('file_size'),media.get('duration'),chat_id,msg['message_id']))
                            movie = db.execute('SELECT id,title FROM movies WHERE file_unique_id=?', (media['file_unique_id'],)).fetchone()
                            reply(chat_id, 'Film bazada saqlandi. ID: ' + str(movie[0]) + '\n' + movie[1] + '\nVideo hozir Telegramda saqlanadi.')
                    else:
                        reply(chat_id, 'Film yuboring yoki /list buyrug‘ini ishlating.')
                if user.get('id') == admin:
                    wake.set()
                offset = update['update_id'] + 1
                with db:
                    db.execute("INSERT INTO state VALUES ('offset',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (str(offset),))
        except (RuntimeError, urllib.error.URLError, TimeoutError, OSError):
            logging.warning('Telegram connection failed; retrying in 5 seconds.')
            time.sleep(5)
        except KeyboardInterrupt:
            break
    stop.set()
    db.close()


if __name__ == '__main__':
    main()
