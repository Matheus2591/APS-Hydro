import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { prepareCommunity } from '../community.js';
import { prepareProductSchema } from '../product.js';

export type HydroDatabase = Database.Database;

export function openDatabase(filename: string): HydroDatabase {
  if (filename !== ':memory:') mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
  const db = new Database(filename);
  db.pragma('busy_timeout = 5000');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  // CREATE IF NOT EXISTS preserva dados e identidade em todo reinício.
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reports (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      id TEXT NOT NULL UNIQUE,
      installation_id TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      location_mode TEXT NOT NULL,
      accuracy_meters REAL,
      observed_at TEXT NOT NULL,
      is_demo INTEGER NOT NULL DEFAULT 1 CHECK (is_demo IN (0, 1)),
      received_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS observations (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      source_url TEXT NOT NULL,
      source_record_key TEXT NOT NULL,
      scope_name TEXT NOT NULL,
      scope_type TEXT NOT NULL,
      station_id TEXT,
      latitude REAL,
      longitude REAL,
      variable TEXT NOT NULL,
      value REAL,
      unit TEXT NOT NULL,
      observation_date TEXT NOT NULL,
      period TEXT NOT NULL,
      time_precision TEXT NOT NULL,
      imported_at TEXT NOT NULL,
      access_mode TEXT NOT NULL,
      dataset_id TEXT NOT NULL,
      UNIQUE (source, source_record_key)
    );
    CREATE TABLE IF NOT EXISTS source_state (
      source TEXT PRIMARY KEY,
      last_attempt_at TEXT NOT NULL,
      last_success_at TEXT,
      last_error TEXT
    );
    CREATE TABLE IF NOT EXISTS report_details (
      report_id TEXT PRIMARY KEY REFERENCES reports(id),
      address TEXT NOT NULL,
      author_id TEXT NOT NULL,
      photo_uri TEXT
    );
  `);
  prepareCommunity(db);
  prepareProductSchema(db);
  db.prepare('INSERT INTO app_metadata (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING').run(
    'serverId',
    randomUUID(),
  );
  return db;
}

export function getServerId(db: HydroDatabase): string {
  return (
    db.prepare('SELECT value FROM app_metadata WHERE key = ?').get('serverId') as { value: string }
  ).value;
}
