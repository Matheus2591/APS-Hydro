import { randomUUID } from 'node:crypto';
import type { HydroDatabase } from './db/database.js';
import { hashPassword } from './security.js';

// Credencial inicial de demonstração definida pelo responsável pelo projeto.
// A senha é gravada no banco somente como hash scrypt.
export function ensurePresentationAdmin(db: HydroDatabase) {
  const count = (db.prepare('SELECT COUNT(*) AS n FROM accounts').get() as { n: number }).n;
  if (count) return false;
  db.prepare(
    `INSERT INTO accounts
    (id,name,name_key,password_hash,phone,address,created_at,login_name,recovery_hash,role)
    VALUES(?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    randomUUID(),
    'Roger',
    'roger',
    hashPassword('12345678'),
    '',
    '',
    new Date().toISOString(),
    'Roger',
    null,
    'moderator',
  );
  return true;
}

// Operação administrativa explícita: não é executada ao abrir/reiniciar a API.
// Mantém as observações oficiais e muda a identidade para invalidar caches antigos.
export function resetPresentationData(db: HydroDatabase) {
  return db
    .transaction(() => {
      for (const table of [
        'moderation_actions',
        'notifications',
        'confirmations',
        'disputes',
        'report_state_events',
        'report_states',
        'report_details',
        'reports',
        'hidden_media',
        'media',
        'sessions',
        'accounts',
      ])
        db.prepare(`DELETE FROM ${table}`).run();
      db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('reports','notifications')").run();
      const serverId = randomUUID();
      db.prepare("UPDATE app_metadata SET value=? WHERE key='serverId'").run(serverId);
      ensurePresentationAdmin(db);
      return { serverId, accounts: 1, reports: 0 };
    })
    .immediate();
}
