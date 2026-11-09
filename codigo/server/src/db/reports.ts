import type { HydroDatabase } from './database.js';
import type { Report, ReportInput } from '../types.js';

export class ReportConflictError extends Error {
  constructor() {
    super('Este identificador já existe com outro conteúdo. Crie um novo relato com outro UUID.');
  }
}

// O SQLite devolve isDemo como 0 ou 1; a API usa booleano.
type ReportRow = Omit<Report, 'isDemo'> & { isDemo: number };

const reportSelectColumns = `seq, id, installation_id AS installationId, category, description,
  latitude, longitude, location_mode AS locationMode, accuracy_meters AS accuracyMeters,
  observed_at AS observedAt, is_demo AS isDemo, received_at AS receivedAt`;

function toApiReport(row: unknown): Report {
  const databaseReport = row as ReportRow;
  return { ...databaseReport, isDemo: Boolean(databaseReport.isDemo) };
}

function sameContent(existing: Report, incoming: ReportInput): boolean {
  return (
    existing.id === incoming.id &&
    existing.installationId === incoming.installationId &&
    existing.category === incoming.category &&
    existing.description === incoming.description &&
    existing.latitude === incoming.latitude &&
    existing.longitude === incoming.longitude &&
    existing.locationMode === incoming.locationMode &&
    existing.accuracyMeters === incoming.accuracyMeters &&
    existing.observedAt === incoming.observedAt &&
    existing.isDemo === incoming.isDemo
  );
}

export function saveReport(
  db: HydroDatabase,
  report: ReportInput,
): { report: Report; duplicate: boolean } {
  // BEGIN IMMEDIATE + UNIQUE protege inclusive dois processos usando o mesmo arquivo.
  return db
    .transaction(() => {
      if (
        db
          .prepare("SELECT report_id FROM report_states WHERE report_id=? AND visibility='removed'")
          .get(report.id)
      )
        throw new ReportConflictError();
      const existing = db
        .prepare(`SELECT ${reportSelectColumns} FROM reports WHERE id = ?`)
        .get(report.id);
      if (existing) {
        const saved = toApiReport(existing);
        if (!sameContent(saved, report)) throw new ReportConflictError();
        return { report: saved, duplicate: true };
      }
      db.prepare(
        `INSERT INTO reports
      (id, installation_id, category, description, latitude, longitude, location_mode,
       accuracy_meters, observed_at, is_demo, received_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        report.id,
        report.installationId,
        report.category,
        report.description,
        report.latitude,
        report.longitude,
        report.locationMode,
        report.accuracyMeters,
        report.observedAt,
        Number(report.isDemo),
        new Date().toISOString(),
      );
      return {
        report: toApiReport(
          db.prepare(`SELECT ${reportSelectColumns} FROM reports WHERE id = ?`).get(report.id),
        ),
        duplicate: false,
      };
    })
    .immediate();
}

export function listReports(db: HydroDatabase, after: number, limit: number) {
  // Uma linha adicional informa hasMore sem pular resultados.
  const rows = db
    .prepare(`SELECT ${reportSelectColumns} FROM reports WHERE seq > ? ORDER BY seq ASC LIMIT ?`)
    .all(after, limit + 1)
    .map(toApiReport);
  const items = rows.slice(0, limit);
  return { items, nextCursor: items.at(-1)?.seq ?? after, hasMore: rows.length > limit };
}
