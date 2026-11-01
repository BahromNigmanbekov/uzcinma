
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
 poster_file_id TEXT,
 banner_file_id TEXT,
 poster_url TEXT,
 backdrop_url TEXT,
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
