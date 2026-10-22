CREATE TABLE IF NOT EXISTS site_sessions (
 token_hash TEXT PRIMARY KEY, store_id TEXT NOT NULL, identity TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('admin','employee')), expires_at INTEGER NOT NULL,
 created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS site_sessions_expiry ON site_sessions(expires_at);
CREATE INDEX IF NOT EXISTS site_sessions_identity ON site_sessions(store_id,identity);
CREATE TABLE IF NOT EXISTS login_attempts (
 bucket TEXT PRIMARY KEY, attempts INTEGER NOT NULL, reset_at INTEGER NOT NULL
);
