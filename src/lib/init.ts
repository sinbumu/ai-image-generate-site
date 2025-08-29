import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

const dataDir = path.join(process.cwd(), 'data')
const dbPath = path.join(dataDir, 'app.db')

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir)

const db = new Database(dbPath)
db.pragma('journal_mode = WAL')

db.exec(`
CREATE TABLE IF NOT EXISTS api_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  provider TEXT CHECK(provider IN ('openai','hailuo')) NOT NULL,
  key_hash TEXT NOT NULL,
  endpoint TEXT,
  task_id TEXT,
  status TEXT CHECK(status IN ('pending','created','completed','failed','error')) NOT NULL,
  error_message TEXT,
  payload_json TEXT,
  response_json TEXT,
  duration_ms INTEGER
);
CREATE INDEX IF NOT EXISTS idx_api_requests_key_created ON api_requests(key_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_requests_task ON api_requests(task_id);

CREATE TABLE IF NOT EXISTS saved_creations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  provider TEXT CHECK(provider IN ('openai','hailuo')) NOT NULL,
  key_hash TEXT NOT NULL,
  kind TEXT CHECK(kind IN ('image','video')) NOT NULL,
  prompt TEXT,
  model TEXT,
  resolution INTEGER,
  duration INTEGER,
  expand_prompt INTEGER,
  source_url TEXT,
  resource_url TEXT NOT NULL,
  thumb_url TEXT,
  metadata_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_saved_creations_key_created ON saved_creations(key_hash, created_at DESC);

CREATE TABLE IF NOT EXISTS uploaded_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  url TEXT NOT NULL,
  name TEXT,
  content_type TEXT,
  size INTEGER,
  uploader_ip TEXT
);
CREATE INDEX IF NOT EXISTS idx_uploaded_images_created ON uploaded_images(created_at DESC);
`)

export default db


