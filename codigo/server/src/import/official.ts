import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import type { HydroDatabase } from '../db/database.js';
import type { Observation, SourceState } from '../types.js';

export const DEFAULT_SOURCE = 'Prefeitura de Santos — Dados de Pluviometria';
const DEFAULT_URL = 'https://www.santos.sp.gov.br/?q=pluviometria-tabela';
const sampleSchema = z.object({
  metadata: z
    .object({
      source: z.string().min(1).default(DEFAULT_SOURCE),
      sourceUrl: z.url().default(DEFAULT_URL),
      datasetId: z.string().min(1).default('santos-2026-10'),
      accessedAt: z.string().optional(),
      accessMode: z.string().optional(),
    })
    .passthrough(),
  observations: z
    .array(
      z
        .object({
          observationDate: z.iso.date(),
          value: z.number().finite().nonnegative().nullable(),
          unit: z.literal('mm'),
          period: z.literal('daily'),
          scopeName: z.string().min(1),
          scopeType: z.string().min(1),
          sourceRecordKey: z.string().min(1).optional(),
          variable: z.literal('precipitation').optional(),
        })
        .passthrough(),
    )
    .min(1)
    .max(5000),
});

export function recordSourceFailure(db: HydroDatabase, source: string, message: string): void {
  db.prepare(
    `INSERT INTO source_state (source, last_attempt_at, last_success_at, last_error)
    VALUES (?, ?, NULL, ?) ON CONFLICT(source) DO UPDATE SET
    last_attempt_at = excluded.last_attempt_at, last_error = excluded.last_error`,
  ).run(source, new Date().toISOString(), message.slice(0, 500));
}

function sourceFromUnknown(value: unknown): string {
  const name = (value as { metadata?: { source?: unknown } } | null)?.metadata?.source;
  return typeof name === 'string' && name.trim() ? name : DEFAULT_SOURCE;
}

export function importOfficial(db: HydroDatabase, raw: unknown): { count: number; source: string } {
  try {
    const data = sampleSchema.parse(raw);
    const importedAt = new Date().toISOString();
    const upsert = db.prepare(`INSERT INTO observations
      (id, source, source_url, source_record_key, scope_name, scope_type, station_id,
       latitude, longitude, variable, value, unit, observation_date, period, time_precision,
       imported_at, access_mode, dataset_id)
      VALUES (@id, @source, @sourceUrl, @sourceRecordKey, @scopeName, @scopeType, @stationId,
        @latitude, @longitude, @variable, @value, @unit, @observationDate, @period, @timePrecision,
        @importedAt, @accessMode, @datasetId)
      ON CONFLICT(source, source_record_key) DO UPDATE SET
        value = excluded.value, source_url = excluded.source_url,
        imported_at = excluded.imported_at, dataset_id = excluded.dataset_id`);
    db.transaction(() => {
      for (const item of data.observations) {
        // A chave inclui local, variável, período e data; não depende da ordem do arquivo.
        const sourceRecordKey =
          item.sourceRecordKey ??
          [item.scopeType, item.scopeName, 'precipitation', item.period, item.observationDate].join(
            '|',
          );
        const observation: Observation = {
          id: createHash('sha256')
            .update(`${data.metadata.source}\0${sourceRecordKey}`)
            .digest('hex'),
          source: data.metadata.source,
          sourceUrl: data.metadata.sourceUrl,
          sourceRecordKey,
          scopeName: item.scopeName,
          scopeType: item.scopeType,
          stationId: null,
          latitude: null,
          longitude: null,
          variable: 'precipitation',
          value: item.value,
          unit: item.unit,
          observationDate: item.observationDate,
          observedAt: null,
          period: item.period,
          timePrecision: 'day',
          importedAt,
          accessMode: 'official_import',
          datasetId: data.metadata.datasetId,
        };
        // observedAt não existe no banco diário: a data oficial não ganha um horário inventado.
        const { observedAt: _unused, ...row } = observation;
        upsert.run(row);
      }
      db.prepare(
        `INSERT INTO source_state (source, last_attempt_at, last_success_at, last_error)
        VALUES (?, ?, ?, NULL) ON CONFLICT(source) DO UPDATE SET
        last_attempt_at = excluded.last_attempt_at,
        last_success_at = excluded.last_success_at, last_error = NULL`,
      ).run(data.metadata.source, importedAt, importedAt);
    }).immediate();
    return { count: data.observations.length, source: data.metadata.source };
  } catch (error) {
    recordSourceFailure(
      db,
      sourceFromUnknown(raw),
      'Falha na importação oficial. Último conjunto válido preservado.',
    );
    throw error;
  }
}

export function importOfficialFile(db: HydroDatabase, filename: string) {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(filename, 'utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    recordSourceFailure(
      db,
      DEFAULT_SOURCE,
      'Não foi possível ler o arquivo oficial. Último conjunto válido preservado.',
    );
    throw error;
  }
  return importOfficial(db, raw);
}

export function getObservations(db: HydroDatabase): {
  items: Observation[];
  sources: SourceState[];
} {
  const items = db
    .prepare(
      `SELECT id, source, source_url AS sourceUrl, source_record_key AS sourceRecordKey,
    scope_name AS scopeName, scope_type AS scopeType, station_id AS stationId, latitude, longitude,
    variable, value, unit, observation_date AS observationDate, NULL AS observedAt, period,
    time_precision AS timePrecision, imported_at AS importedAt, access_mode AS accessMode,
    dataset_id AS datasetId FROM observations ORDER BY observation_date DESC, id ASC`,
    )
    .all() as Observation[];
  const sources = db
    .prepare(
      `SELECT source, last_attempt_at AS lastAttemptAt,
    last_success_at AS lastSuccessAt, last_error AS lastError FROM source_state ORDER BY source`,
    )
    .all() as SourceState[];
  return { items, sources };
}
