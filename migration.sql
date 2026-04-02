-- Migration for StreamList preview database
-- Generated from schema.ts

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL DEFAULT (CAST((strftime('%s', 'now') * 1000) AS INTEGER)),
    countries TEXT NOT NULL DEFAULT '["US"]',
    api_key TEXT
);

-- User streaming services
CREATE TABLE IF NOT EXISTS user_streaming_services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    service_id TEXT NOT NULL,
    service_name TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id)
);

-- User genres
CREATE TABLE IF NOT EXISTS user_genres (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    genre_id INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id)
);

-- User likes
CREATE TABLE IF NOT EXISTS user_likes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    tmdb_id INTEGER NOT NULL,
    media_type TEXT NOT NULL,
    title TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id)
);

-- Watchlist
CREATE TABLE IF NOT EXISTS watchlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    tmdb_id INTEGER NOT NULL,
    media_type TEXT NOT NULL,
    added_at INTEGER NOT NULL DEFAULT (CAST((strftime('%s', 'now') * 1000) AS INTEGER)),
    FOREIGN KEY (user_id) REFERENCES users (id)
);

-- Watched
CREATE TABLE IF NOT EXISTS watched (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    tmdb_id INTEGER NOT NULL,
    media_type TEXT NOT NULL,
    title TEXT NOT NULL,
    watched_at INTEGER NOT NULL DEFAULT (CAST((strftime('%s', 'now') * 1000) AS INTEGER)),
    FOREIGN KEY (user_id) REFERENCES users (id)
);

-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id)
);

-- User groups
CREATE TABLE IF NOT EXISTS user_groups (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (CAST((strftime('%s', 'now') * 1000) AS INTEGER)),
    created_by TEXT NOT NULL,
    FOREIGN KEY (created_by) REFERENCES users (id)
);

-- User group members
CREATE TABLE IF NOT EXISTS user_group_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    joined_at INTEGER NOT NULL DEFAULT (CAST((strftime('%s', 'now') * 1000) AS INTEGER)),
    FOREIGN KEY (group_id) REFERENCES user_groups (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
);

-- Group invites
CREATE TABLE IF NOT EXISTS group_invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id TEXT NOT NULL,
    invited_by TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY (group_id) REFERENCES user_groups (id),
    FOREIGN KEY (invited_by) REFERENCES users (id)
);

-- Group polls
CREATE TABLE IF NOT EXISTS group_polls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    closed_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (CAST((strftime('%s', 'now') * 1000) AS INTEGER)),
    candidates TEXT NOT NULL,
    winner_tmdb_id INTEGER,
    winner_media_type TEXT,
    FOREIGN KEY (group_id) REFERENCES user_groups (id)
);

-- Group poll votes
CREATE TABLE IF NOT EXISTS group_poll_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    poll_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    rankings TEXT NOT NULL,
    FOREIGN KEY (poll_id) REFERENCES group_polls (id),
    FOREIGN KEY (user_id) REFERENCES users (id)
);