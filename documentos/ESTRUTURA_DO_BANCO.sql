-- Hydro Pulse 3.0.1: estrutura gerada a partir do codigo atual.
-- Documento para explicar o banco; nao inclui contas, sessoes, fotos ou dados privados.
-- A API cria/migra as tabelas e importa os dados oficiais ao iniciar.
-- O SQLite do servidor usa foreign_keys=ON e journal_mode=WAL.

CREATE TABLE accounts (id TEXT PRIMARY KEY, name TEXT NOT NULL, name_key TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, phone TEXT NOT NULL, address TEXT NOT NULL, profile_photo_uri TEXT, created_at TEXT NOT NULL, login_name TEXT, recovery_hash TEXT, role TEXT NOT NULL DEFAULT 'user');

CREATE TABLE app_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

CREATE TABLE confirmations (report_id TEXT NOT NULL REFERENCES reports(id), account_id TEXT NOT NULL REFERENCES accounts(id), created_at TEXT NOT NULL, PRIMARY KEY(report_id, account_id));

CREATE TABLE disputes (id TEXT PRIMARY KEY, report_id TEXT NOT NULL REFERENCES reports(id), author_id TEXT NOT NULL REFERENCES accounts(id), justification TEXT NOT NULL, photo_uri TEXT, created_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'received', review_status TEXT NOT NULL DEFAULT 'pending', moderation_note TEXT, reviewed_at TEXT, reviewer_id TEXT);

CREATE TABLE hidden_media(id TEXT PRIMARY KEY);

CREATE TABLE media (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES accounts(id), mime TEXT NOT NULL, content BLOB NOT NULL, created_at TEXT NOT NULL);

CREATE TABLE moderation_actions(id TEXT PRIMARY KEY,dispute_id TEXT NOT NULL,actor_id TEXT,action TEXT NOT NULL,note TEXT NOT NULL,created_at TEXT NOT NULL);

CREATE TABLE notifications (seq INTEGER PRIMARY KEY AUTOINCREMENT, account_id TEXT NOT NULL REFERENCES accounts(id), event_key TEXT NOT NULL, report_id TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL, read_at TEXT, UNIQUE(account_id, event_key));

CREATE TABLE observations (
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

CREATE TABLE report_details (
      report_id TEXT PRIMARY KEY REFERENCES reports(id),
      address TEXT NOT NULL,
      author_id TEXT NOT NULL,
      photo_uri TEXT
    );

CREATE TABLE report_state_events(id TEXT PRIMARY KEY,report_id TEXT NOT NULL,author_id TEXT NOT NULL,lifecycle TEXT NOT NULL,note TEXT NOT NULL,created_at TEXT NOT NULL);

CREATE TABLE report_states(report_id TEXT PRIMARY KEY,lifecycle TEXT NOT NULL DEFAULT 'active',visibility TEXT NOT NULL DEFAULT 'visible',note TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL);

CREATE TABLE reports (
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

CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id), expires_at TEXT NOT NULL);

CREATE TABLE source_state (
      source TEXT PRIMARY KEY,
      last_attempt_at TEXT NOT NULL,
      last_success_at TEXT,
      last_error TEXT
    );
