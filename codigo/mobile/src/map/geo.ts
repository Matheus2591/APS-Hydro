import type { Coordinates, FloodReport, Station } from '../types/domain';

export const SANTOS_CENTER: Coordinates = { latitude: -23.9608, longitude: -46.3336 };

export function isCoordinate(value: unknown): value is Coordinates {
  if (typeof value !== 'object' || value === null) return false;
  const point = value as Coordinates;
  return (
    Number.isFinite(point.latitude) &&
    Math.abs(point.latitude) <= 90 &&
    Number.isFinite(point.longitude) &&
    Math.abs(point.longitude) <= 180
  );
}

// Relatos antigos com um ponto de demonstração não ganham um marcador geográfico.
export const hasConfirmedLocation = (report: FloodReport) =>
  (report.locationMode === 'gps' || report.locationMode === 'map') &&
  isCoordinate(report.coordinates);

export type MapPoint = {
  id: string;
  kind: 'report' | 'station';
  coordinates: Coordinates;
  title: string;
  detail: string;
  color: string;
};
export type MapFocus = { id: string; coordinates?: Coordinates; zoom?: number; fit?: boolean };
export type MapPayload = {
  points: MapPoint[];
  selectable: boolean;
  selection?: Coordinates | null;
  userLocation?: Coordinates | null;
  focus?: MapFocus;
};

export function makeMapPoints(reports: FloodReport[], stations: Station[]): MapPoint[] {
  const colors = { passable: '#138363', partial: '#B66A00', blocked: '#CF3434' };
  return [
    ...reports
      .filter(
        (report) =>
          hasConfirmedLocation(report) &&
          report.visibility !== 'hidden' &&
          report.visibility !== 'removed',
      )
      .map((report) => ({
        id: report.id,
        kind: 'report' as const,
        coordinates: report.coordinates,
        title: report.address,
        detail: `${report.lifecycle === 'resolved' ? 'Ocorrência encerrada' : report.status === 'synced' ? 'Compartilhado pela comunidade' : 'Salvo neste aparelho'} · observado em ${new Date(report.observedAt).toLocaleString('pt-BR')} · sem validação de autoridade`,
        color: report.lifecycle === 'resolved' ? '#6B7E8D' : colors[report.category],
      })),
    ...stations
      .filter((station) => isCoordinate(station.coordinates))
      .map((station) => ({
        id: station.id,
        kind: 'station' as const,
        coordinates: station.coordinates,
        title: station.name,
        detail: `${station.source} · ${station.rainfallMm} mm`,
        color: '#087EB6',
      })),
  ];
}

export function serializeMapData(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export type MapMessage =
  | { type: 'ready' }
  | { type: 'status'; status: 'loading' | 'ready' | 'error' }
  | { type: 'select'; coordinates: Coordinates }
  | { type: 'point'; id: string; kind: 'report' | 'station' };

export function readMapMessage(raw: unknown): MapMessage | null {
  try {
    const message = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!message || message.channel !== 'hydropulse-map') return null;
    if (message.type === 'ready') return { type: 'ready' };
    if (message.type === 'status' && ['loading', 'ready', 'error'].includes(message.status))
      return { type: 'status', status: message.status };
    if (message.type === 'select' && isCoordinate(message.coordinates))
      return { type: 'select', coordinates: message.coordinates };
    if (
      message.type === 'point' &&
      typeof message.id === 'string' &&
      message.id.length <= 160 &&
      ['report', 'station'].includes(message.kind)
    )
      return { type: 'point', id: message.id, kind: message.kind };
    return null;
  } catch {
    return null;
  }
}
