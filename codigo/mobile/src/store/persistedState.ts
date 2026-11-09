import type { AppState } from './appState';
import { normalizeApiUrl } from '../services/api/client';
import {
  isFloodReport,
  isObservation,
  isSourceState,
  isStation,
  isUserAccount,
  isDispute,
  isPendingReportUpdate,
  isPendingModeration,
} from '../utils/validation';

// Validar o arquivo inteiro antes de mesclar evita telas quebradas e perda do original.
export function mergePersistedState(value: unknown, current: AppState): AppState {
  if (value === undefined) return current;
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('Estado local inválido.');
  const saved = value as Partial<AppState>;
  if (saved.apiUrl !== undefined && saved.apiUrl !== '') normalizeApiUrl(saved.apiUrl);
  const arrays: Array<[keyof AppState, (item: unknown) => boolean]> = [
    ['reports', isFloodReport],
    ['accounts', isUserAccount],
    ['disputes', isDispute],
    ['pendingReportUpdates', isPendingReportUpdate],
    ['pendingModerations', isPendingModeration],
    ['observations', isObservation],
    ['sources', isSourceState],
    ['stations', isStation],
    ['confirmedReportIds', (item) => typeof item === 'string'],
    [
      'pendingConfirmations',
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as any).reportId === 'string' &&
        typeof (item as any).authorId === 'string',
    ],
    [
      'notifications',
      (item) =>
        typeof item === 'object' &&
        item !== null &&
        Number.isSafeInteger((item as any).id) &&
        typeof (item as any).title === 'string' &&
        typeof (item as any).body === 'string' &&
        typeof (item as any).reportId === 'string' &&
        Number.isFinite(Date.parse((item as any).createdAt)),
    ],
  ];
  for (const [key, valid] of arrays) {
    const items = saved[key];
    if (items !== undefined && (!Array.isArray(items) || !items.every(valid)))
      throw new Error(`Dados locais inválidos: ${key}.`);
  }
  if (
    (saved.user !== undefined && saved.user !== null && !isUserAccount(saved.user)) ||
    (saved.cursor !== undefined &&
      (!/^\d+$/.test(saved.cursor) || !Number.isSafeInteger(Number(saved.cursor)))) ||
    (saved.serverId !== undefined &&
      saved.serverId !== null &&
      typeof saved.serverId !== 'string') ||
    (saved.lastSyncAt !== undefined &&
      saved.lastSyncAt !== null &&
      !Number.isFinite(Date.parse(saved.lastSyncAt)))
  )
    throw new Error('Identidade ou cursor local inválido.');

  // Somente campos de dados são recuperados. Funções e estado de conexão vêm do aplicativo.
  const result = { ...current };
  for (const [key] of arrays) {
    if (saved[key] !== undefined) Object.assign(result, { [key]: saved[key] });
  }
  if (saved.sessionToken != null && !/^[A-Za-z0-9_-]{40,100}$/.test(saved.sessionToken))
    throw new Error('Sessão local inválida.');
  if (saved.authServerId != null && typeof saved.authServerId !== 'string')
    throw new Error('Servidor da sessão inválido.');
  for (const key of [
    'user',
    'cursor',
    'serverId',
    'lastSyncAt',
    'apiUrl',
    'sessionToken',
    'authServerId',
  ] as const) {
    if (saved[key] !== undefined) Object.assign(result, { [key]: saved[key] });
  }
  return result;
}
