// Iniciador do ensaio: mantém API e túnel na mesma janela e no mesmo banco.
import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const serverRoot = path.join(root, 'server');
const localOnly = process.argv.includes('--local');
const checkOnly = process.argv.includes('--check');
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT inválida.');
const trialDb = path.join(serverRoot, '.runtime/physical-20261025/server.db');
const defaultDb = process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, 'HydroPulse/server.db')
  : path.join(serverRoot, 'data/hydro-pulse.db');
const dbPath = path.resolve(process.env.DB_PATH || (existsSync(trialDb) ? trialDb : defaultDb));
const runtime = path.join(root, '.runtime');
mkdirSync(runtime, { recursive: true });
const apiUrl = `http://127.0.0.1:${port}`;
const cloudflareInstalled = path.join(process.env['ProgramFiles(x86)'] || 'C:/Program Files (x86)', 'cloudflared/cloudflared.exe');
const cloudflare = process.env.HYDROPULSE_CLOUDFLARED || (existsSync(cloudflareInstalled) ? cloudflareInstalled : 'cloudflared');
const require = createRequire(path.join(serverRoot, 'package.json'));
const Database = require('better-sqlite3');
let api;
let tunnel;
let healthTimer;
let stopping = false;

function stop(code = 0, message) {
  if (stopping) return;
  stopping = true;
  if (message) console.error(message);
  clearInterval(healthTimer);
  tunnel?.kill();
  api?.kill(); // Somente o processo que este iniciador criou.
  process.exitCode = code;
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
process.on('exit', () => { tunnel?.kill(); api?.kill(); });

async function health(url = apiUrl) {
  try {
    const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3000) });
    return response.ok ? await response.json() : undefined;
  } catch { return undefined; }
}

try {
  if (!existsSync(dbPath)) {
    if (checkOnly) throw new Error('Banco ainda não criado. Execute o iniciador sem --check.');
    const imported = spawnSync(process.execPath, ['--import', 'tsx', 'src/cli.ts', 'import'], {
      cwd: serverRoot, env: { ...process.env, DB_PATH: dbPath }, stdio: 'inherit', windowsHide: true,
    });
    if (imported.status !== 0) throw new Error('Não foi possível preparar os dados oficiais.');
  }
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  const expectedId = db.prepare("SELECT value FROM app_metadata WHERE key='serverId'").get()?.value;
  db.close();
  if (!expectedId) throw new Error('O arquivo escolhido não identifica um banco Hydro Pulse.');
  let current = await health();
  if (current && current.serverId !== expectedId) throw new Error('Esta porta já atende outro banco. Encerre a outra API antes de continuar.');
  if (current && !['accounts', 'media', 'account_security', 'report_states', 'moderation'].every(value => current.capabilities?.includes(value))) throw new Error('A API aberta é de uma versão antiga. Encerre-a e execute o iniciador novamente.');
  if (checkOnly) {
    const checkTunnel = spawnSync(cloudflare, ['--version'], { encoding: 'utf8', windowsHide: true });
    if (checkTunnel.status !== 0) throw new Error('cloudflared não encontrado.');
    console.log(`Banco confirmado: ${dbPath}\nAPI: ${current ? 'ativa, banco correto' : 'será iniciada'}\nTúnel: disponível.`);
  } else {
    if (!current) {
      const apiLog = createWriteStream(path.join(runtime, `presentation-api-${port}.log`), { flags: 'a' });
      api = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
        cwd: serverRoot, env: { ...process.env, DB_PATH: dbPath, PORT: String(port) },
        stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
      });
      api.stdout.pipe(apiLog, { end: false });
      api.stderr.pipe(apiLog, { end: false });
      api.once('error', error => stop(1, `API: ${error.message}`));
      api.once('exit', () => { if (!stopping) stop(1, 'A API encerrou. Confira o log e execute o iniciador novamente.'); });
      for (let attempt = 0; attempt < 30 && !stopping; attempt++) {
        current = await health();
        if (current) break;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    if (!current || current.serverId !== expectedId) throw new Error('A API não iniciou com o banco esperado.');
    console.log(`API verificada: ${apiUrl}\nBanco: ${dbPath}`);
    console.log('Mantenha esta janela aberta. Para encerrar, pressione Ctrl+C.');
    if (!localOnly) {
      const log = createWriteStream(path.join(runtime, `presentation-tunnel-${port}.log`), { flags: 'a' });
      tunnel = spawn(cloudflare, ['tunnel', '--url', apiUrl, '--no-autoupdate'], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
      tunnel.stdout.pipe(log, { end: false });
      tunnel.stderr.pipe(log, { end: false });
      tunnel.once('error', error => stop(1, `Túnel: ${error.message}`));
      tunnel.once('exit', () => { if (!stopping) stop(1, 'O túnel encerrou. Execute o iniciador novamente e atualize a URL no celular.'); });
      const lines = createInterface({ input: tunnel.stderr });
      let checkingUrl = false;
      lines.on('line', async line => {
        const url = line.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)?.[0];
        if (!url || checkingUrl) return;
        checkingUrl = true;
        for (let attempt = 0; attempt < 30 && !stopping; attempt++) {
          const remote = await health(url);
          if (remote?.serverId === expectedId) {
            writeFileSync(path.join(runtime, 'presentation-state.json'), JSON.stringify({ url, dbPath, serverId: expectedId, apiPid: api?.pid, tunnelPid: tunnel.pid }, null, 2));
            console.log(`\nCONEXÃO VERIFICADA: ${url}\nNo login: Configurar conexão → código 180504 → Liberar configuração → colar URL base → Testar e salvar conexão → Voltar para entrar. Administrador: Perfil → Administração → Conexão do serviço.\nA URL é temporária e muda ao iniciar um novo túnel.`);
            return;
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        if (!stopping) stop(1, 'A URL do túnel não ficou acessível. Confira a conexão e tente novamente.');
      });
    }
    let failedChecks = 0;
    healthTimer = setInterval(async () => {
      failedChecks = (await health())?.serverId === expectedId ? 0 : failedChecks + 1;
      if (failedChecks >= 3) stop(1, 'A API deixou de responder. Execute o iniciador novamente; o banco permanece salvo.');
    }, 10000);
  }
} catch (error) {
  stop(1, error.message);
}
