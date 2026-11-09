// Execute antes de gerar a versão para distribuição pública.
import { existsSync } from 'node:fs';

export function validateRelease(env) {
  const errors = [];
  let url;
  try {
    url = new URL(env.EXPO_PUBLIC_API_URL);
  } catch {
    errors.push('Informe EXPO_PUBLIC_API_URL com a URL HTTPS fixa da API.');
  }
  if (
    url &&
    (url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      (url.pathname !== '/' && url.pathname !== '') ||
      /(^|\.)(localhost|example\.(com|org|net)|trycloudflare\.com|ngrok[^.]*\.[a-z.]+)$/.test(
        url.hostname,
      ) ||
      /sua-api|seu-servidor|your-api|placeholder/.test(url.hostname) ||
      /^127\.|^10\.|^192\.168\.|^172\.(1[6-9]|2[0-9]|3[01])\.|^\[/.test(url.hostname))
  )
    errors.push(
      'Use a origem HTTPS fixa da hospedagem, sem caminho, túnel temporário ou IP privado.',
    );
  if (env.EXPO_PUBLIC_USE_MOCKS !== 'false') errors.push('EXPO_PUBLIC_USE_MOCKS deve ser false.');
  if (env.EXPO_PUBLIC_SHOW_CONNECTION_SETTINGS !== 'false')
    errors.push('EXPO_PUBLIC_SHOW_CONNECTION_SETTINGS deve ser false.');
  for (const key of [
    'HYDROPULSE_KEYSTORE_PATH',
    'HYDROPULSE_KEYSTORE_PASSWORD',
    'HYDROPULSE_KEY_ALIAS',
    'HYDROPULSE_KEY_PASSWORD',
  ])
    if (!env[key]) errors.push(`Defina ${key} em uma variável privada.`);
  if (env.HYDROPULSE_KEYSTORE_PATH && !existsSync(env.HYDROPULSE_KEYSTORE_PATH))
    errors.push('O arquivo privado da chave de assinatura não foi encontrado.');
  return errors;
}

if (
  process.argv[1] &&
  new URL(import.meta.url).pathname
    .toLowerCase()
    .endsWith(process.argv[1].replaceAll('\\', '/').toLowerCase().split('/').at(-1))
) {
  const errors = validateRelease(process.env);
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
  } else {
    try {
      const response = await fetch(new URL('/health', process.env.EXPO_PUBLIC_API_URL), {
        signal: AbortSignal.timeout(15000),
        redirect: 'error',
      });
      const health = await response.json();
      if (
        !response.ok ||
        health.status !== 'ok' ||
        health.version !== '3.0.1' ||
        !health.serverId ||
        !['accounts', 'media', 'account_security', 'report_states', 'moderation'].every((value) =>
          health.capabilities?.includes(value),
        )
      )
        throw new Error('A API não confirmou a versão e as capacidades necessárias.');
      console.log(
        'Configuração e API aprovadas. Gere o Android App Bundle com a mesma chave nas próximas versões.',
      );
    } catch (error) {
      console.error('Publicação impedida:', error.message);
      process.exitCode = 1;
    }
  }
}
