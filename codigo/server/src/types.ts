export interface ReportInput {
  id: string;
  installationId: string;
  category: 'water_accumulation' | 'flooding' | 'blocked_passage';
  description: string;
  latitude: number;
  longitude: number;
  locationMode: 'gps' | 'map' | 'reference';
  accuracyMeters: number | null;
  observedAt: string;
  isDemo: boolean;
}

export interface Report extends ReportInput {
  seq: number;
  receivedAt: string;
}

export interface Observation {
  id: string;
  source: string;
  sourceUrl: string;
  sourceRecordKey: string;
  scopeName: string;
  scopeType: string;
  stationId: string | null;
  latitude: number | null;
  longitude: number | null;
  variable: string;
  value: number | null;
  unit: string;
  observationDate: string;
  observedAt: null;
  period: string;
  timePrecision: 'day';
  importedAt: string;
  accessMode: 'official_import';
  datasetId: string;
}

export interface SourceState {
  source: string;
  lastAttemptAt: string;
  lastSuccessAt: string | null;
  lastError: string | null;
}
