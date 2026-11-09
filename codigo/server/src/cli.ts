import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from './app.js';
import { getDatabasePath, OFFICIAL_SAMPLE, OFFICIAL_DIRECTORY } from './config.js';
import { refreshSantos } from './import/santos.js';
import { openDatabase } from './db/database.js';
import { saveReport } from './db/reports.js';
import { DEFAULT_SOURCE, importOfficialFile, recordSourceFailure } from './import/official.js';
import type { ReportInput } from './types.js';
import { backupDatabase } from './operations.js';
import { resetPresentationData } from './presentation.js';

function demoReport(installationId = randomUUID()): ReportInput {
  return {
    id: randomUUID(),
    installationId,
    category: 'water_accumulation',
    description: 'DEMONSTRAÇÃO ACADÊMICA — relato fictício para testar sincronização.',
    latitude: -23.9608,
    longitude: -46.3336,
    locationMode: 'reference',
    accuracyMeters: null,
    observedAt: new Date().toISOString(),
    isDemo: true,
  };
}

async function demonstrateLostResponse() {
  // Banco isolado: a demonstração não cria relatos no banco utilizado pelos celulares.
  const directory = mkdtempSync(path.join(tmpdir(), 'hydro-pulse-idempotency-'));
  const db = openDatabase(path.join(directory, 'demo.db'));
  const report = demoReport();
  let first = true;
  const app = createApp(db, {
    afterCommitForTest: () => {
      if (first) {
        first = false;
        return 'drop-response';
      }
    },
  });
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Porta de teste indisponível.');
    const url = `http://127.0.0.1:${address.port}/reports`;
    const registration = await fetch(`http://127.0.0.1:${address.port}/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Ensaio isolado',
        password: randomUUID(),
        phone: '000000000',
        address: 'Banco temporário de testes',
      }),
    });
    if (registration.status !== 201)
      throw new Error('Não foi possível preparar a conta do ensaio.');
    const session = (await registration.json()) as { user: { id: string }; token: string };
    report.installationId = session.user.id;
    const request = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` },
      body: JSON.stringify(report),
      signal: AbortSignal.timeout(5000),
    };
    let lost = false;
    try {
      await fetch(url, request);
    } catch {
      lost = true;
    }
    if (!lost) throw new Error('A primeira resposta deveria ter sido perdida.');
    console.log(
      'Tentativa 1: COMMIT realizado; conexão encerrada antes de responder (erro real de rede).',
    );
    const response = await fetch(url, { ...request, signal: AbortSignal.timeout(5000) });
    const result = (await response.json()) as { duplicate: boolean };
    const count = (
      db.prepare('SELECT COUNT(*) AS count FROM reports WHERE id = ?').get(report.id) as {
        count: number;
      }
    ).count;
    if (response.status !== 200 || !result.duplicate || count !== 1)
      throw new Error('Falha de idempotência.');
    console.log(
      JSON.stringify(
        {
          id: report.id,
          attempts: 2,
          httpStatus: response.status,
          duplicate: result.duplicate,
          databaseRows: count,
        },
        null,
        2,
      ),
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
    const resolved = path.resolve(directory);
    if (
      !resolved.startsWith(path.resolve(tmpdir()) + path.sep) ||
      !path.basename(resolved).startsWith('hydro-pulse-idempotency-')
    ) {
      throw new Error('Limpeza recusada fora do diretório temporário da demonstração.');
    }
    rmSync(resolved, { recursive: true, force: true });
  }
}

async function main() {
  const command = process.argv[2];
  if (command === 'idempotency') return demonstrateLostResponse();
  const db = openDatabase(getDatabasePath());
  try {
    if (command === 'reset-presentation') {
      const result = resetPresentationData(db);
      console.log(
        JSON.stringify({
          ...result,
          message:
            'Contas, relatos, fotos e interações removidos. Administrador Roger preparado; medições oficiais preservadas.',
        }),
      );
    } else if (command === 'import') {
      const result = importOfficialFile(
        db,
        process.argv[3] ? path.resolve(process.argv[3]) : OFFICIAL_SAMPLE,
      );
      console.log(
        `Importação oficial concluída: ${result.count} registros processados (${result.source}). Sem duplicar chaves.`,
      );
    } else if (command === 'refresh') {
      const result = await refreshSantos(db);
      const file = path.join(OFFICIAL_DIRECTORY, `${result.snapshot.metadata.datasetId}.json`);
      writeFileSync(file + '.tmp', JSON.stringify(result.snapshot, null, 2) + '\n');
      renameSync(file + '.tmp', file);
      console.log(
        `Fonte oficial consultada por HTTPS: ${result.count} medições reais. Arquivo: ${file}`,
      );
    } else if (command === 'backup') {
      const file = await backupDatabase(
        db,
        process.env.BACKUP_DIRECTORY || path.join(path.dirname(getDatabasePath()), 'backups'),
      );
      console.log(`Backup consistente concluído: ${file}`);
    } else if (command === 'moderator' || command === 'unmoderator') {
      const username = process.argv.slice(3).join(' ').trim();
      if (!username) throw new Error('Informe o nome de usuário da conta já cadastrada.');
      const result = db
        .prepare('UPDATE accounts SET role=? WHERE name_key=?')
        .run(
          command === 'moderator' ? 'moderator' : 'user',
          username.normalize('NFKC').toLocaleLowerCase('pt-BR'),
        );
      if (!result.changes) throw new Error('Usuário não encontrado neste banco.');
      console.log(
        `Papel atualizado para ${command === 'moderator' ? 'moderação' : 'usuário comum'}. Entre novamente na conta para atualizar a tela.`,
      );
    } else if (command === 'source-fail') {
      recordSourceFailure(
        db,
        DEFAULT_SOURCE,
        process.argv[3] ??
          'DEMONSTRAÇÃO: falha simulada no adaptador de importação. Último dado válido preservado.',
      );
      console.log(
        'Falha simulada registrada. As medições e lastSuccessAt foram preservados. Não houve consulta externa.',
      );
    } else if (command === 'seed') {
      const count = Number(process.argv[3] ?? 120);
      if (!Number.isInteger(count) || count < 1 || count > 1000)
        throw new Error('Informe entre 1 e 1000 relatos de teste.');
      const installationId = randomUUID();
      db.transaction(() => {
        for (let index = 0; index < count; index++) {
          const report = demoReport(installationId);
          report.latitude += (index % 10) * 0.0005;
          report.longitude += Math.floor(index / 10) * 0.0005;
          saveReport(db, report);
        }
      })();
      console.log(
        `${count} relatos FICTÍCIOS criados para testar paginação. isDemo=true; nenhum dado foi apagado.`,
      );
    } else {
      throw new Error(
        'Use import, refresh, backup, reset-presentation, moderator, unmoderator, source-fail, seed ou idempotency.',
      );
    }
  } finally {
    db.close();
  }
}

main().catch((error) => {
  console.error(
    'A operação não foi concluída:',
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});
