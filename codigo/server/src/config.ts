import path from 'node:path';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const SERVER_ROOT = fileURLToPath(new URL('../', import.meta.url));
export const OFFICIAL_DIRECTORY = path.resolve(SERVER_ROOT, '../data/official');
export function latestOfficialFile() {
  const filename = readdirSync(OFFICIAL_DIRECTORY)
    .filter((name) => /^santos-\d{4}-\d{2}\.json$/.test(name))
    .sort()
    .at(-1);
  if (!filename) throw new Error('Nenhum arquivo oficial foi encontrado.');
  return path.join(OFFICIAL_DIRECTORY, filename);
}
export const OFFICIAL_SAMPLE = latestOfficialFile();

export function getDatabasePath(): string {
  const configured = process.env.DB_PATH?.trim();
  if (configured === ':memory:') return configured;
  return configured ? path.resolve(configured) : path.join(SERVER_ROOT, 'data', 'hydro-pulse.db');
}

export function getPort(): number {
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('PORT deve estar entre 1 e 65535.');
  return port;
}

export function getHost() {
  const host = process.env.HOST?.trim() || '127.0.0.1';
  if (!['127.0.0.1', '0.0.0.0', '::', 'localhost'].includes(host))
    throw new Error('HOST inválido.');
  return host;
}
