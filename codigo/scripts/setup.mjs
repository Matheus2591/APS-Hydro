import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const npmCli = process.env.npm_execpath;
if (!npmCli || path.basename(npmCli) !== 'npm-cli.js' || !existsSync(npmCli)) {
  console.error('Execute este instalador com npm run setup na raiz do projeto.');
  process.exit(1);
}
if (Number(process.versions.node.split('.')[0]) !== 24) {
  console.error('Instale Node.js 24 LTS. Versão atual:', process.versions.node);
  process.exit(1);
}
for (const folder of ['server', 'mobile']) {
  console.log(`\nInstalando dependências de ${folder}...`);
  const cwd = path.join(projectRoot, folder);
  let args = [existsSync(path.join(cwd, 'package-lock.json')) ? 'ci' : 'install'];
  if (existsSync(path.join(cwd, 'pnpm-lock.yaml'))) {
    // Respeita o gerenciador e o lockfile trazidos pelo novo mobile.
    args = [
      'exec',
      '--yes',
      '--package=pnpm@11.25.0',
      '--',
      'pnpm',
      'install',
      '--frozen-lockfile',
    ];
    // Reutiliza o cache de uma instalação existente, sem gravar caminhos da máquina no projeto.
    const modulesFile = path.join(cwd, 'node_modules', '.modules.yaml');
    if (existsSync(modulesFile)) {
      try {
        const modules = JSON.parse(readFileSync(modulesFile, 'utf8'));
        if (typeof modules.storeDir === 'string' && existsSync(modules.storeDir)) {
          const storeDir = /^v\d+$/.test(path.basename(modules.storeDir))
            ? path.dirname(modules.storeDir)
            : modules.storeDir;
          args.push('--store-dir', storeDir);
        }
      } catch {
        /* Em uma instalação nova, o pnpm usa seu cache padrão. */
      }
    }
  }
  const result = spawnSync(process.execPath, [npmCli, ...args], {
    cwd,
    stdio: 'inherit',
  });
  if (result.error || result.status !== 0) {
    console.error(`Não foi possível instalar ${folder}. Confira a conexão e o erro acima.`);
    process.exit(result.status || 1);
  }
}
console.log('\nDependencias do aplicativo e da API preparadas.');
console.log('Use INICIAR_APRESENTACAO.cmd na pasta superior para iniciar a API e a URL HTTPS.');
