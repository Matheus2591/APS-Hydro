import { Router } from 'express';
import { z } from 'zod';
import type { HydroDatabase } from './db/database.js';
import { getServerId } from './db/database.js';
import { listReports, ReportConflictError, saveReport } from './db/reports.js';
import { getObservations } from './import/official.js';
import type { Report, ReportInput } from './types.js';
import { cursorSchema } from './validation/report.js';
import { requireAccount, validPhoto, notifyNewReport, authenticatedAccount } from './community.js';
import { canReadReport, reportState } from './product.js';

// O novo mobile usa estes nomes; o banco continua tendo uma única tabela de relatos.
const toDatabaseCategory = {
  passable: 'water_accumulation',
  partial: 'flooding',
  blocked: 'blocked_passage',
} as const;
const toMobileCategory = {
  water_accumulation: 'passable',
  flooding: 'partial',
  blocked_passage: 'blocked',
} as const;

const mobileReportSchema = z
  .object({
    clientId: z.string().trim().min(1).max(160),
    authorId: z.string().trim().min(1).max(160),
    category: z.enum(['passable', 'partial', 'blocked']),
    description: z.string().trim().min(1).max(500),
    address: z.string().trim().min(1).max(300),
    coordinates: z
      .object({
        latitude: z.number().finite().min(-90).max(90),
        longitude: z.number().finite().min(-180).max(180),
      })
      .strict(),
    observedAt: z.iso
      .datetime({ offset: true })
      .transform((value) => new Date(value).toISOString()),
    locationMode: z.enum(['gps', 'map', 'reference']).default('reference'),
    photoUri: z.string().max(2000).optional(),
  })
  .strict();

type MobileReportInput = z.infer<typeof mobileReportSchema>;
type Details = { address: string; authorId: string; photoUri: string | null };

function getDetails(db: HydroDatabase, id: string): Details | undefined {
  return db
    .prepare(
      `SELECT address, author_id AS authorId, photo_uri AS photoUri
    FROM report_details WHERE report_id = ?`,
    )
    .get(id) as Details | undefined;
}

function toMobileReport(db: HydroDatabase, report: Report) {
  const details = getDetails(db, report.id);
  return {
    id: report.id,
    clientId: report.id,
    sequence: report.seq,
    category: toMobileCategory[report.category],
    description: report.description,
    address: details?.address ?? 'Local informado por coordenadas',
    neighborhood: 'Santos',
    coordinates: { latitude: report.latitude, longitude: report.longitude },
    observedAt: report.observedAt,
    createdAt: report.receivedAt,
    locationMode: report.locationMode,
    status: 'synced' as const,
    source: 'community' as const,
    confirmations: (
      db.prepare('SELECT COUNT(*) AS n FROM confirmations WHERE report_id=?').get(report.id) as {
        n: number;
      }
    ).n,
    authorId: details?.authorId ?? report.installationId,
    ...reportState(db, report.id),
    ...(details?.photoUri ? { photoUri: details.photoUri } : {}),
  };
}

function saveMobileReport(db: HydroDatabase, input: MobileReportInput, legacy: boolean) {
  const canonical: ReportInput = {
    id: input.clientId,
    installationId: input.authorId,
    category: toDatabaseCategory[input.category],
    description: input.description,
    ...input.coordinates,
    locationMode: input.locationMode,
    accuracyMeters: null,
    observedAt: input.observedAt,
    isDemo: legacy,
  };
  // Uma URI file:// é do aparelho de origem; não é um upload acessível aos outros celulares.
  const photoUri =
    input.photoUri?.startsWith('/v1/media/') || (legacy && input.photoUri?.startsWith('https://'))
      ? input.photoUri!
      : null;
  return db
    .transaction(() => {
      const previous = getDetails(db, input.clientId);
      if (
        previous &&
        (previous.address !== input.address ||
          previous.authorId !== input.authorId ||
          previous.photoUri !== photoUri)
      ) {
        throw new ReportConflictError();
      }
      const result = saveReport(db, canonical);
      db.prepare(
        `INSERT INTO report_details (report_id, address, author_id, photo_uri)
      VALUES (?, ?, ?, ?) ON CONFLICT(report_id) DO NOTHING`,
      ).run(input.clientId, input.address, input.authorId, photoUri);
      if (!result.duplicate) notifyNewReport(db, input.clientId, input.authorId);
      return {
        canonical: result.report,
        duplicate: result.duplicate,
        report: toMobileReport(db, result.report),
      };
    })
    .immediate();
}

export function createMobileRouter(
  db: HydroDatabase,
  afterCommitForTest?: (report: Report) => 'drop-response' | void,
  legacy = false,
) {
  const router = Router();
  const serverId = getServerId(db);

  router.get('/stations', (_req, res) => {
    // A fonte importada não publica coordenadas de estações. Não criar pontos fictícios.
    res.json([]);
  });
  router.get('/observations', (_req, res) => res.json({ ...getObservations(db), serverId }));
  router.post('/reports', ...(legacy ? [] : [requireAccount(db)]), (req, res) => {
    const parsed = mobileReportSchema.safeParse(req.body);
    if (!parsed.success || req.get('Idempotency-Key') !== parsed.data.clientId) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Confira os dados e mantenha Idempotency-Key igual ao clientId.',
        },
      });
      return;
    }
    if (
      !legacy &&
      (parsed.data.authorId !== res.locals.account.id ||
        !validPhoto(db, parsed.data.photoUri, res.locals.account.id))
    ) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'O autor e a foto devem pertencer à conta autenticada.',
        },
      });
      return;
    }
    try {
      const result = saveMobileReport(db, parsed.data, legacy);
      if (afterCommitForTest?.(result.canonical) === 'drop-response') {
        req.socket.destroy();
        return;
      }
      res.status(result.duplicate ? 200 : 201).json(result.report);
    } catch (error) {
      if (error instanceof ReportConflictError) {
        res.status(409).json({
          error: {
            code: 'REPORT_CONFLICT',
            message:
              'Este identificador já foi gravado com outros dados. O relato original foi preservado.',
          },
        });
        return;
      }
      throw error;
    }
  });
  router.get('/reports', (req, res) => {
    const rows = db.prepare('SELECT COUNT(*) AS count FROM reports').get() as { count: number };
    const viewer = authenticatedAccount(db, req);
    res.json(
      listReports(db, 0, rows.count || 1)
        .items.filter((report) => canReadReport(db, report.id, viewer))
        .map((report) => toMobileReport(db, report)),
    );
  });
  router.get('/sync/pull', (req, res) => {
    const parsed = cursorSchema.safeParse({ after: req.query.cursor ?? '0', limit: '100' });
    if (!parsed.success) {
      res.status(400).json({ error: { code: 'INVALID_CURSOR', message: 'Cursor inválido.' } });
      return;
    }
    const page = listReports(db, parsed.data.after, parsed.data.limit);
    res.json({
      cursor: String(page.nextCursor),
      hasMore: page.hasMore,
      serverId,
      stations: [],
      reports: page.items
        .filter((report) => canReadReport(db, report.id, authenticatedAccount(db, req)))
        .map((report) => toMobileReport(db, report)),
      serverTime: new Date().toISOString(),
    });
  });
  router.patch('/reports/:id', (_req, res) =>
    res.status(405).json({
      error: {
        code: 'IMMUTABLE_REPORT',
        message: 'Relatos enviados são imutáveis. Publique uma nova observação ou uma contestação.',
      },
    }),
  );
  return router;
}
