import { createApp } from './app.js';
import { getDatabasePath, getPort, getHost, OFFICIAL_SAMPLE } from './config.js';
import { getServerId, openDatabase } from './db/database.js';
import { importOfficialFile } from './import/official.js';
import { startMaintenance } from './operations.js';
import path from 'node:path';
import { ensurePresentationAdmin } from './presentation.js';

const db = openDatabase(getDatabasePath());
ensurePresentationAdmin(db);
if (!(db.prepare('SELECT COUNT(*) AS n FROM observations').get() as { n: number }).n)
  importOfficialFile(db, OFFICIAL_SAMPLE);
const maintenance =
  process.env.MAINTENANCE_ENABLED === 'false'
    ? undefined
    : startMaintenance(db, {
        backupDirectory:
          process.env.BACKUP_DIRECTORY || path.join(path.dirname(getDatabasePath()), 'backups'),
      });
const corsOrigins = process.env.CORS_ORIGINS?.split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const app = createApp(db, {
  corsOrigins,
  trustProxyHops: Number(process.env.TRUST_PROXY_HOPS || 0),
});
const port = getPort();
const server = app.listen(port, getHost(), () => {
  console.log(`Hydro Pulse 3.0.1 em http://${getHost()}:${port}`);
  console.log(`Banco: ${getDatabasePath()}`);
  console.log(`serverId: ${getServerId(db)}`);
  console.log('Túnel: cloudflared tunnel --url http://127.0.0.1:' + port);
});
server.requestTimeout = 30_000;
server.headersTimeout = 15_000;
server.on('error', (error) => {
  console.error('Não foi possível iniciar a API:', error.message);
  void maintenance?.stop().finally(() => db.close());
  if (!maintenance) db.close();
  process.exitCode = 1;
});
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  server.close(async () => {
    await maintenance?.stop();
    db.close();
    process.exitCode = 0;
  });
  server.closeIdleConnections();
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
