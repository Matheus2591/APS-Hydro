import type {
  CreateReportInput,
  FloodReport,
  OfficialObservation,
  SourceState,
  Station,
  UserAccount,
  ReportDispute,
  ReportState,
  PendingReportUpdate,
  PendingModeration,
  ModerationItem,
} from '../types/domain';

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;
const date = (value: unknown): value is string => text(value) && Number.isFinite(Date.parse(value));

export function validateReportInput(input: Omit<CreateReportInput, 'clientId' | 'authorId'>) {
  if (!text(input.address) || input.address.trim().length > 300)
    throw new Error('Informe um endereço com até 300 caracteres.');
  if (
    !text(input.description) ||
    input.description.trim().length < 10 ||
    input.description.trim().length > 500
  )
    throw new Error('Escreva uma descrição entre 10 e 500 caracteres.');
  if (!['passable', 'partial', 'blocked'].includes(input.category))
    throw new Error('Escolha uma situação válida.');
  const point = input.coordinates;
  if (
    !point ||
    !Number.isFinite(point.latitude) ||
    Math.abs(point.latitude) > 90 ||
    !Number.isFinite(point.longitude) ||
    Math.abs(point.longitude) > 180
  )
    throw new Error('As coordenadas do relato são inválidas.');
  if (!date(input.observedAt)) throw new Error('A data do relato é inválida.');
}

// JSON válido também pode ter campos errados. Conferir antes de usar ou persistir.
export function isFloodReport(value: unknown): value is FloodReport {
  if (
    !object(value) ||
    !text(value.id) ||
    !text(value.clientId) ||
    !text(value.authorId) ||
    !text(value.address) ||
    !text(value.description) ||
    typeof value.neighborhood !== 'string' ||
    !date(value.observedAt) ||
    !date(value.createdAt) ||
    value.source !== 'community' ||
    !['passable', 'partial', 'blocked'].includes(String(value.category)) ||
    !['pending', 'syncing', 'synced', 'failed'].includes(String(value.status)) ||
    !Number.isSafeInteger(value.confirmations) ||
    Number(value.confirmations) < 0 ||
    !object(value.coordinates)
  )
    return false;
  const { latitude, longitude } = value.coordinates;
  return (
    typeof latitude === 'number' &&
    Number.isFinite(latitude) &&
    Math.abs(latitude) <= 90 &&
    typeof longitude === 'number' &&
    Number.isFinite(longitude) &&
    Math.abs(longitude) <= 180 &&
    (value.photoUri === undefined || typeof value.photoUri === 'string') &&
    (value.lifecycle === undefined || ['active', 'resolved'].includes(String(value.lifecycle))) &&
    (value.visibility === undefined ||
      ['visible', 'hidden', 'removed'].includes(String(value.visibility))) &&
    (value.stateUpdatedAt === undefined || date(value.stateUpdatedAt))
  );
}

export function isObservation(value: unknown): value is OfficialObservation {
  return (
    object(value) &&
    text(value.id) &&
    text(value.source) &&
    text(value.sourceUrl) &&
    text(value.scopeName) &&
    value.unit === 'mm' &&
    value.period === 'daily' &&
    text(value.observationDate) &&
    /^\d{4}-\d{2}-\d{2}$/.test(value.observationDate) &&
    date(value.observationDate) &&
    date(value.importedAt) &&
    (value.value === null ||
      (typeof value.value === 'number' && Number.isFinite(value.value) && value.value >= 0))
  );
}

export function isSourceState(value: unknown): value is SourceState {
  return (
    object(value) &&
    text(value.source) &&
    [value.lastAttemptAt, value.lastSuccessAt].every((item) => item === null || date(item)) &&
    (value.lastError === null || typeof value.lastError === 'string')
  );
}

export function isStation(value: unknown): value is Station {
  return (
    object(value) &&
    text(value.id) &&
    text(value.name) &&
    text(value.neighborhood) &&
    object(value.coordinates) &&
    typeof value.coordinates.latitude === 'number' &&
    typeof value.coordinates.longitude === 'number' &&
    Number.isFinite(value.coordinates.latitude) &&
    Number.isFinite(value.coordinates.longitude) &&
    Math.abs(value.coordinates.latitude) <= 90 &&
    Math.abs(value.coordinates.longitude) <= 180 &&
    typeof value.rainfallMm === 'number' &&
    Number.isFinite(value.rainfallMm) &&
    value.rainfallMm >= 0 &&
    typeof value.accumulationPeriodHours === 'number' &&
    value.accumulationPeriodHours > 0 &&
    date(value.observedAt) &&
    ['CEMADEN', 'Prefeitura de Santos'].includes(String(value.source)) &&
    ['normal', 'attention', 'alert'].includes(String(value.status))
  );
}

export function isUserAccount(value: unknown): value is UserAccount {
  return (
    object(value) &&
    text(value.id) &&
    text(value.name) &&
    typeof value.password === 'string' &&
    (value.username === undefined || text(value.username)) &&
    (value.role === undefined || ['user', 'moderator'].includes(String(value.role))) &&
    typeof value.phone === 'string' &&
    typeof value.address === 'string' &&
    date(value.createdAt) &&
    (value.profilePhotoUri === undefined || typeof value.profilePhotoUri === 'string')
  );
}

export function isReportState(value: unknown): value is ReportState {
  return (
    object(value) &&
    text(value.reportId) &&
    ['active', 'resolved'].includes(String(value.lifecycle)) &&
    ['visible', 'hidden', 'removed'].includes(String(value.visibility)) &&
    typeof value.stateNote === 'string' &&
    date(value.stateUpdatedAt)
  );
}

export function isPendingReportUpdate(value: unknown): value is PendingReportUpdate {
  return (
    object(value) &&
    text(value.operationId) &&
    text(value.reportId) &&
    text(value.authorId) &&
    ['active', 'resolved'].includes(String(value.lifecycle)) &&
    typeof value.note === 'string' &&
    value.note.length <= 300
  );
}

export function isPendingModeration(value: unknown): value is PendingModeration {
  return (
    object(value) &&
    text(value.operationId) &&
    text(value.disputeId) &&
    text(value.authorId) &&
    ['keep', 'hide'].includes(String(value.action)) &&
    typeof value.note === 'string' &&
    value.note.length >= 10 &&
    value.note.length <= 300
  );
}

export function isModerationItem(value: unknown): value is ModerationItem {
  return (
    object(value) &&
    text(value.id) &&
    text(value.reportId) &&
    text(value.justification) &&
    text(value.description) &&
    text(value.address) &&
    date(value.createdAt) &&
    ['pending', 'kept', 'hidden'].includes(String(value.reviewStatus))
  );
}

export function isDispute(value: unknown): value is ReportDispute {
  return (
    object(value) &&
    text(value.id) &&
    text(value.reportId) &&
    text(value.authorId) &&
    text(value.justification) &&
    date(value.createdAt) &&
    ['pending', 'sent'].includes(String(value.status)) &&
    (value.photoUri == null || typeof value.photoUri === 'string')
  );
}
