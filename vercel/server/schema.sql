
CREATE TABLE IF NOT EXISTS movies (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 file_unique_id TEXT UNIQUE,
 file_id TEXT,
 title TEXT NOT NULL,
 description TEXT NOT NULL DEFAULT '',
 genres TEXT NOT NULL DEFAULT '[]',
 type TEXT NOT NULL DEFAULT 'movie',
 year INTEGER,
 rating REAL NOT NULL DEFAULT 0,
 duration INTEGER NOT NULL DEFAULT 0,
 file_size INTEGER NOT NULL DEFAULT 0,
 source_chat_id TEXT,
 source_message_id INTEGER,
 mime_type TEXT,
 file_name TEXT,
 poster_file_id TEXT,
 banner_file_id TEXT,
 poster_url TEXT,
 backdrop_url TEXT,
 logo_file_id TEXT,
 logo_url TEXT,
 collection_id INTEGER,
 season_number INTEGER,
 episode_number INTEGER,
 is_collection INTEGER NOT NULL DEFAULT 0,
 deleted INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS movies_visible ON movies(deleted, created_at DESC);
CREATE INDEX IF NOT EXISTS movies_rating ON movies(deleted, rating DESC);
CREATE TABLE IF NOT EXISTS sources (
 movie_id INTEGER NOT NULL REFERENCES movies(id),
 quality TEXT NOT NULL,
 url TEXT NOT NULL,
 PRIMARY KEY(movie_id, quality)
);
CREATE TABLE IF NOT EXISTS telegram_updates (
 id INTEGER PRIMARY KEY,
 status TEXT NOT NULL DEFAULT 'pending',
 lease_until INTEGER NOT NULL DEFAULT 0,
 completed_at INTEGER
);

CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY,value TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS seasons (
 series_id INTEGER NOT NULL REFERENCES movies(id),
 number INTEGER NOT NULL,
 title TEXT NOT NULL DEFAULT '',
 description TEXT NOT NULL DEFAULT '',
 PRIMARY KEY(series_id,number)
);
