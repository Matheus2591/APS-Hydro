export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '');
export const USE_MOCKS = process.env.EXPO_PUBLIC_USE_MOCKS === 'true';
export type ApiBaseUrl = string | (() => string);

export function normalizeApiUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('Informe uma URL completa, como https://seu-servidor.trycloudflare.com.');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  )
    throw new Error('Informe somente a URL base do servidor, sem senha, caminho ou parâmetros.');
  if (
    url.protocol === 'http:' &&
    !['localhost', '127.0.0.1', '[::1]', '10.0.2.2'].includes(url.hostname)
  )
    throw new Error('No celular, informe a URL HTTPS do servidor.');
  return url.origin;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

type RequestOptions = RequestInit & { timeoutMs?: number };

export function createApiClient(
  baseUrl: ApiBaseUrl = API_URL,
  fetcher: typeof fetch = fetch,
  token?: () => string | null,
) {
  return async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000);

    try {
      const address = typeof baseUrl === 'function' ? baseUrl() : baseUrl;
      const response = await fetcher(`${address.trim().replace(/\/+$/, '')}${path}`, {
        ...options,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(token?.() ? { Authorization: `Bearer ${token()}` } : {}),
          ...options.headers,
        },
      });

      const body = await response.json().catch(() => undefined);
      if (!response.ok) {
        throw new ApiError(
          (body as { error?: { message?: string }; message?: string } | undefined)?.error
            ?.message ??
            (body as { message?: string } | undefined)?.message ??
            'Falha ao comunicar com o servidor.',
          response.status,
          body,
        );
      }
      if (body === undefined)
        throw new ApiError('A API não retornou JSON válido.', response.status);
      return body as T;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        'Não foi possível acessar o serviço. Verifique a conexão e tente novamente.',
        0,
      );
    } finally {
      clearTimeout(timeout);
    }
  };
}

export const apiRequest = createApiClient();
