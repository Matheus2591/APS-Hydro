import { mkdir, readdir, unlink, lstat } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { HydroDatabase } from './db/database.js';
import { refreshSantos } from './import/santos.js';

export async function backupDatabase(db: HydroDatabase, directory: string, keep = 3) {
  if (!Number.isInteger(keep) || keep < 1 || keep > 14)
    throw new Error('Retenção de backup inválida.');
  const targetDirectory = path.resolve(directory);
  await mkdir(targetDirectory, { recursive: true });
  const name = `hydro-pulse-backup-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}.db`;
  const target = path.join(targetDirectory, name);
  await db.backup(target);
  const owned = (await readdir(targetDirectory))
    .filter((file) =>
      /^hydro-pulse-backup-\d{4}-\d{2}-\d{2}T[0-9TZ-]+-[a-f0-9-]{36}\.db$/.test(file),
    )
    .sort()
    .reverse();
  const retained = new Set([name, ...owned.filter((file) => file !== name).slice(0, keep - 1)]);
  for (const file of owned.filter((file) => !retained.has(file))) {
    const candidate = path.resolve(targetDirectory, file);
    if (path.dirname(candidate) !== targetDirectory) throw new Error('Caminho de backup inválido.');
    const info = await lstat(candidate);
    if (info.isFile() && !info.isSymbolicLink()) await unlink(candidate);
  }
  return target;
}

type Options = {
  backupDirectory: string;
  refreshMs?: number;
  backupMs?: number;
  keep?: number;
  fetcher?: typeof fetch;
  log?: (message: string) => void;
};

export function startMaintenance(db: HydroDatabase, options: Options) {
  const log = options.log ?? console.log;
  let refreshing: ReturnType<typeof refreshSantos> | null = null;
  let backingUp: Promise<string> | null = null;
  let stopped = false;
  const refreshNow = () => {
    if (stopped) return Promise.reject(new Error('Manutenção encerrada.'));
    if (!refreshing)
      refreshing = refreshSantos(db, options.fetcher).finally(() => {
        refreshing = null;
      });
    return refreshing;
  };
  const backupNow = () => {
    if (stopped) return Promise.reject(new Error('Manutenção encerrada.'));
    if (!backingUp)
      backingUp = backupDatabase(db, options.backupDirectory, options.keep ?? 3).finally(() => {
        backingUp = null;
      });
    return backingUp;
  };
  const refresh = () => {
    void refreshNow()
      .then(() => log('Consulta oficial concluída; datas da fonte preservadas.'))
      .catch(() => log('Fonte indisponível; último histórico válido preservado.'));
  };
  const backup = () => {
    void backupNow()
      .then(() => log('Backup consistente concluído.'))
      .catch(() => log('Falha no backup; confira o espaço e as permissões do volume.'));
  };
  const initial = setTimeout(() => {
    refresh();
    backup();
  }, 1000);
  const sourceTimer = setInterval(refresh, options.refreshMs ?? 6 * 3600_000);
  const backupTimer = setInterval(backup, options.backupMs ?? 24 * 3600_000);
  initial.unref();
  sourceTimer.unref();
  backupTimer.unref();
  return {
    refreshNow,
    backupNow,
    async stop() {
      stopped = true;
      clearTimeout(initial);
      clearInterval(sourceTimer);
      clearInterval(backupTimer);
      await Promise.allSettled([refreshing, backingUp].filter(Boolean));
    },
  };
}
