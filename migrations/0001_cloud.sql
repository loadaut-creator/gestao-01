PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS revisions (store_id TEXT NOT NULL, resource TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(store_id, resource));
CREATE TRIGGER IF NOT EXISTS revision_conflict BEFORE UPDATE ON revisions WHEN NEW.version != OLD.version + 1 BEGIN SELECT RAISE(ABORT, 'revision_conflict'); END;
CREATE TABLE IF NOT EXISTS documents (store_id TEXT NOT NULL, resource TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)), PRIMARY KEY(store_id,resource,id));
CREATE TABLE IF NOT EXISTS imports (store_id TEXT NOT NULL, id TEXT NOT NULL, fingerprint TEXT NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)), PRIMARY KEY(store_id,id), UNIQUE(store_id,fingerprint));
CREATE TABLE IF NOT EXISTS sales_rows (store_id TEXT NOT NULL, import_id TEXT NOT NULL, position INTEGER NOT NULL, data TEXT NOT NULL CHECK(json_valid(data)), PRIMARY KEY(store_id,import_id,position), FOREIGN KEY(store_id,import_id) REFERENCES imports(store_id,id) ON DELETE CASCADE);
CREATE TABLE IF NOT EXISTS audit_log (id TEXT PRIMARY KEY, store_id TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, resource TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS audit_store_date ON audit_log(store_id,created_at);
