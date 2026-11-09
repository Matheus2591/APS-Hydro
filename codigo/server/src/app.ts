import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import type { HydroDatabase } from './db/database.js';
import { getServerId } from './db/database.js';
import { listReports, ReportConflictError, saveReport } from './db/reports.js';
import { getObservations } from './import/official.js';
import { cursorSchema, reportSchema } from './validation/report.js';
import type { Report } from './types.js';
import { createMobileRouter } from './mobile-api.js';
import { createCommunityRouter, requireAccount, authenticatedAccount } from './community.js';
import { createProductRouter, canReadReport } from './product.js';

export interface AppOptions {
  /** Compatibilidade exclusiva dos ensaios legados em servidores isolados. */
  allowLegacyWritesForTest?: boolean;
  /** Injetado apenas por testes/demonstração em servidor efêmero local. Não há rota/header de ativação. */
  afterCommitForTest?: (report: Report) => 'drop-response' | void;
  rateLimitMax?: number;
  corsOrigins?: string[];
  trustProxyHops?: number;
  log?: (line: string) => void;
}

const defaultOrigins = [
  'http://localhost:8081',
  'http://127.0.0.1:8081',
  'http://localhost:19006',
  'http://127.0.0.1:19006',
];

function validateOrigins(origins: string[]): string[] {
  for (const origin of origins) {
    const url = new URL(origin);
    if (
      !(
        url.protocol === 'https:' ||
        (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
      ) ||
      url.origin !== origin
    )
      throw new Error(`CORS_ORIGINS exige uma origem HTTPS ou HTTP local explícita: ${origin}`);
  }
  return origins;
}

export function createApp(db: HydroDatabase, options: AppOptions = {}) {
  const app = express();
  const log = options.log ?? console.log;
  const serverId = getServerId(db);
  const origins = validateOrigins(options.corsOrigins ?? defaultOrigins);
  app.disable('x-powered-by');
  const hops = options.trustProxyHops ?? 0;
  if (!Number.isInteger(hops) || hops < 0 || hops > 2)
    throw new Error('TRUST_PROXY_HOPS deve ser 0, 1 ou 2.');
  // Ativar apenas atrás do proxy da hospedagem, sem acesso direto à porta do processo.
  app.set('trust proxy', hops || false);
  app.use(
    cors({
      origin: (origin, callback) =>
        callback(null, origin === undefined || origins.includes(origin)),
      methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Idempotency-Key', 'Authorization'],
    }),
  );
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: options.rateLimitMax ?? 600,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      validate: { xForwardedForHeader: false },
      message: {
        error: {
          code: 'RATE_LIMIT',
          message: 'Muitas requisições. Aguarde um minuto e tente novamente.',
        },
      },
    }),
  );
  app.use('/v1/media', express.json({ limit: '3mb', strict: true }));
  app.use(express.json({ limit: '16kb', strict: true }));
  app.get('/health', (_req, res) =>
    res.json({
      status: 'ok',
      version: '3.0.1',
      capabilities: [
        'accounts',
        'media',
        'community',
        'account_security',
        'report_states',
        'moderation',
      ],
      serverId,
    }),
  );
  app.get('/observations', (_req, res) => res.json({ ...getObservations(db), serverId }));
  app.use('/v1', createProductRouter(db));
  app.use('/v1', createCommunityRouter(db));
  app.use(
    '/v1',
    createMobileRouter(db, options.afterCommitForTest, options.allowLegacyWritesForTest),
  );
  app.post(
    '/reports',
    ...(options.allowLegacyWritesForTest ? [] : [requireAccount(db)]),
    (req, res) => {
      const parsed = reportSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Confira os campos do relato.',
            details: parsed.error.issues.map((issue) => ({
              field: issue.path.join('.'),
              message: issue.message,
            })),
          },
        });
        return;
      }
      if (
        !options.allowLegacyWritesForTest &&
        parsed.data.installationId !== res.locals.account.id
      ) {
        res.status(403).json({
          error: { code: 'FORBIDDEN', message: 'O autor deve corresponder à conta autenticada.' },
        });
        return;
      }
      try {
        const result = saveReport(db, parsed.data);
        log(
          JSON.stringify({
            event: 'report_saved',
            id: result.report.id,
            seq: result.report.seq,
            duplicate: result.duplicate,
          }),
        );
        if (options.afterCommitForTest?.(result.report) === 'drop-response') {
          req.socket.destroy(); // O COMMIT já aconteceu; fetch recebe erro real de rede.
          return;
        }
        res.status(result.duplicate ? 200 : 201).json(result);
      } catch (error) {
        if (error instanceof ReportConflictError) {
          res.status(409).json({ error: { code: 'REPORT_CONFLICT', message: error.message } });
          return;
        }
        throw error;
      }
    },
  );
  app.get('/reports', (req, res) => {
    const query = cursorSchema.safeParse(req.query);
    if (!query.success) {
      res.status(400).json({
        error: {
          code: 'INVALID_CURSOR',
          message: 'after deve ser inteiro não negativo; limit deve estar entre 1 e 100.',
        },
      });
      return;
    }
    const page = listReports(db, query.data.after, query.data.limit);
    const viewer = authenticatedAccount(db, req);
    res.json({
      ...page,
      items: page.items.filter((report) => canReadReport(db, report.id, viewer)),
      serverId,
    });
  });
  app.use((_req, res) =>
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Rota não encontrada.' } }),
  );
  const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error.type === 'entity.too.large') {
      res.status(413).json({
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: 'A requisição excede o limite desta rota (16 KB; upload de imagem até 2 MB).',
        },
      });
    } else if (error.type === 'entity.parse.failed') {
      res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Envie um JSON válido.' } });
    } else {
      log(
        JSON.stringify({
          event: 'server_error',
          code: typeof error.code === 'string' ? error.code : 'INTERNAL_ERROR',
        }),
      );
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Não foi possível concluir. Tente novamente mais tarde.',
        },
      });
    }
  };
  app.use(handleError);
  return app;
}
