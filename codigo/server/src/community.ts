import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Router, type Request, type RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import type { HydroDatabase } from './db/database.js';
import { hashPassword, verifyPassword, newRecoveryCode } from './security.js';

export type Account = {
  id: string;
  name: string;
  phone: string;
  address: string;
  profile_photo_uri: string | null;
  created_at: string;
  password_hash: string;
  login_name?: string;
  recovery_hash?: string | null;
  role?: 'user' | 'moderator';
};
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const profileSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    phone: z.string().trim().max(30).default(''),
    address: z.string().trim().max(300).default(''),
    profilePhotoUri: z.string().max(200).optional(),
  })
  .strict();
const registerSchema = profileSchema.extend({ password: z.string().min(8).max(128) });
const loginSchema = z
  .object({ name: z.string().trim().min(1).max(100), password: z.string().min(1).max(128) })
  .strict();
export function prepareCommunity(db: HydroDatabase) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, name TEXT NOT NULL, name_key TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, phone TEXT NOT NULL, address TEXT NOT NULL, profile_photo_uri TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id), expires_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES accounts(id), mime TEXT NOT NULL, content BLOB NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS confirmations (report_id TEXT NOT NULL REFERENCES reports(id), account_id TEXT NOT NULL REFERENCES accounts(id), created_at TEXT NOT NULL, PRIMARY KEY(report_id, account_id));
    CREATE TABLE IF NOT EXISTS disputes (id TEXT PRIMARY KEY, report_id TEXT NOT NULL REFERENCES reports(id), author_id TEXT NOT NULL REFERENCES accounts(id), justification TEXT NOT NULL, photo_uri TEXT, created_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'received');
    CREATE TABLE IF NOT EXISTS notifications (seq INTEGER PRIMARY KEY AUTOINCREMENT, account_id TEXT NOT NULL REFERENCES accounts(id), event_key TEXT NOT NULL, report_id TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, created_at TEXT NOT NULL, read_at TEXT, UNIQUE(account_id, event_key));
  `);
}
export const publicAccount = (a: Account) => ({
  id: a.id,
  name: a.name,
  phone: a.phone,
  address: a.address,
  ...(a.profile_photo_uri ? { profilePhotoUri: a.profile_photo_uri } : {}),
  createdAt: a.created_at,
  password: '',
  username: a.login_name ?? a.name,
  role: a.role ?? 'user',
});

export function createAccountSession(db: HydroDatabase, account: Account) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + 30 * 86400_000).toISOString();
  db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(new Date().toISOString());
  db.prepare('INSERT INTO sessions(token_hash,account_id,expires_at) VALUES(?,?,?)').run(
    digest(token),
    account.id,
    expiresAt,
  );
  return { user: publicAccount(account), token, expiresAt };
}
export function authenticatedAccount(db: HydroDatabase, req: Request): Account | undefined {
  const token = req.get('Authorization')?.match(/^Bearer ([A-Za-z0-9_-]{40,100})$/)?.[1];
  if (!token) return;
  return db
    .prepare(
      'SELECT a.* FROM accounts a JOIN sessions s ON a.id=s.account_id WHERE s.token_hash=? AND s.expires_at>?',
    )
    .get(digest(token), new Date().toISOString()) as Account | undefined;
}
export function requireAccount(db: HydroDatabase): RequestHandler {
  return (req, res, next) => {
    const account = authenticatedAccount(db, req);
    if (!account) {
      res.status(401).json({
        error: {
          code: 'AUTH_REQUIRED',
          message: 'Entre na sua conta para continuar. Sua fila continua salva.',
        },
      });
      return;
    }
    res.locals.account = account;
    next();
  };
}
export function validPhoto(db: HydroDatabase, uri: string | undefined, owner: string) {
  if (!uri) return true;
  const id = uri.match(/^\/v1\/media\/([a-f0-9]{64})$/)?.[1];
  return (
    !!id &&
    !!db
      .prepare(
        'SELECT id FROM media WHERE id=? AND owner_id=? AND id NOT IN (SELECT id FROM hidden_media)',
      )
      .get(id, owner)
  );
}
export function notify(
  db: HydroDatabase,
  accountId: string,
  event: string,
  reportId: string,
  title: string,
  body: string,
) {
  db.prepare(
    'INSERT INTO notifications(account_id,event_key,report_id,title,body,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(account_id,event_key) DO NOTHING',
  ).run(accountId, event, reportId, title, body, new Date().toISOString());
}
export function notifyNewReport(db: HydroDatabase, id: string, authorId: string) {
  for (const row of db.prepare('SELECT id FROM accounts WHERE id<>?').all(authorId) as {
    id: string;
  }[])
    notify(
      db,
      row.id,
      `report:${id}`,
      id,
      'Novo relato da comunidade',
      'Um colaborador publicou uma ocorrência. Consulte o relato e suas coordenadas.',
    );
}
export function createCommunityRouter(db: HydroDatabase) {
  const router = Router();
  const requireUser = requireAccount(db);
  const authLimit = rateLimit({
    windowMs: 15 * 60_000,
    limit: 50,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    validate: { xForwardedForHeader: false },
    message: {
      error: {
        code: 'AUTH_RATE_LIMIT',
        message: 'Muitas tentativas. Aguarde antes de tentar entrar novamente.',
      },
    },
  });
  const session = (account: Account) => createAccountSession(db, account);
  router.post('/auth/register', authLimit, (req, res) => {
    const p = registerSchema.safeParse(req.body);
    if (!p.success) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Confira o cadastro. A senha deve ter de 8 a 128 caracteres.',
        },
      });
      return;
    }
    const input = p.data,
      key = input.name.normalize('NFKC').toLocaleLowerCase('pt-BR');
    if (db.prepare('SELECT id FROM accounts WHERE name_key=?').get(key)) {
      res
        .status(409)
        .json({ error: { code: 'NAME_TAKEN', message: 'Este nome já está cadastrado.' } });
      return;
    }
    if (input.profilePhotoUri) {
      res.status(400).json({
        error: { code: 'PHOTO_AFTER_LOGIN', message: 'Adicione a foto após criar sua conta.' },
      });
      return;
    }
    const id = randomUUID();
    const recovery = newRecoveryCode();
    db.prepare(
      'INSERT INTO accounts(id,name,name_key,password_hash,phone,address,created_at,login_name,recovery_hash) VALUES(?,?,?,?,?,?,?,?,?)',
    ).run(
      id,
      input.name,
      key,
      hashPassword(input.password),
      input.phone,
      input.address,
      new Date().toISOString(),
      input.name,
      recovery.hash,
    );
    res
      .status(201)
      .json({
        ...session(db.prepare('SELECT * FROM accounts WHERE id=?').get(id) as Account),
        recoveryCode: recovery.code,
      });
  });
  router.post('/auth/login', authLimit, (req, res) => {
    const p = loginSchema.safeParse(req.body);
    if (!p.success) {
      res
        .status(400)
        .json({ error: { code: 'VALIDATION_ERROR', message: 'Informe nome e senha.' } });
      return;
    }
    const account = db
      .prepare('SELECT * FROM accounts WHERE name_key=?')
      .get(p.data.name.normalize('NFKC').toLocaleLowerCase('pt-BR')) as Account | undefined;
    if (!verifyPassword(p.data.password, account?.password_hash) || !account) {
      res
        .status(401)
        .json({ error: { code: 'INVALID_LOGIN', message: 'Nome ou senha incorretos.' } });
      return;
    }
    res.json(session(account));
  });
  router.get('/auth/me', requireUser, (_req, res) => res.json(publicAccount(res.locals.account)));
  router.post('/auth/logout', requireUser, (req, res) => {
    db.prepare('DELETE FROM sessions WHERE token_hash=?').run(
      digest(req.get('Authorization')!.slice(7)),
    );
    res.json({ ok: true });
  });
  router.patch('/auth/me', requireUser, (req, res) => {
    const p = profileSchema.safeParse(req.body),
      account = res.locals.account as Account;
    if (!p.success || !validPhoto(db, p.success ? p.data.profilePhotoUri : undefined, account.id)) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Confira os dados e a foto do perfil.' },
      });
      return;
    }
    // O nome de usuário não muda quando a pessoa edita o nome de exibição.
    db.prepare('UPDATE accounts SET name=?,phone=?,address=?,profile_photo_uri=? WHERE id=?').run(
      p.data.name,
      p.data.phone,
      p.data.address,
      p.data.profilePhotoUri ?? null,
      account.id,
    );
    res.json(
      publicAccount(db.prepare('SELECT * FROM accounts WHERE id=?').get(account.id) as Account),
    );
  });
  router.post('/media', requireUser, (req, res) => {
    const p = z
      .object({
        base64: z.string().min(16).max(2_800_000),
        mime: z.enum(['image/jpeg', 'image/png', 'image/webp']),
      })
      .strict()
      .safeParse(req.body);
    if (!p.success) {
      res.status(400).json({
        error: {
          code: 'INVALID_IMAGE',
          message: 'Envie uma imagem JPEG, PNG ou WebP de até 2 MB.',
        },
      });
      return;
    }
    const data = Buffer.from(p.data.base64, 'base64');
    const mime = data.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
      ? 'image/jpeg'
      : data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        ? 'image/png'
        : data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP'
          ? 'image/webp'
          : null;
    if (
      !mime ||
      mime !== p.data.mime ||
      data.length > 2_000_000 ||
      data.toString('base64') !== p.data.base64
    ) {
      res
        .status(400)
        .json({ error: { code: 'INVALID_IMAGE', message: 'Imagem inválida ou maior que 2 MB.' } });
      return;
    }
    const id = createHash('sha256').update(res.locals.account.id).update(data).digest('hex');
    if (db.prepare('SELECT id FROM hidden_media WHERE id=?').get(id)) {
      res
        .status(403)
        .json({
          error: {
            code: 'MODERATED_IMAGE',
            message: 'Essa imagem está indisponível por moderação. Escolha outra imagem.',
          },
        });
      return;
    }
    db.prepare(
      'INSERT INTO media(id,owner_id,mime,content,created_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO NOTHING',
    ).run(id, res.locals.account.id, mime, data, new Date().toISOString());
    res.status(201).json({ uri: `/v1/media/${id}` });
  });
  router.get('/media/:id', (req, res) => {
    if (!/^[a-f0-9]{64}$/.test(String(req.params.id))) {
      res.sendStatus(404);
      return;
    }
    const media = db
      .prepare(
        'SELECT content,mime FROM media WHERE id=? AND id NOT IN (SELECT id FROM hidden_media)',
      )
      .get(req.params.id) as { content: Buffer; mime: string } | undefined;
    if (!media) {
      res.sendStatus(404);
      return;
    }
    res
      .set({
        'Content-Type': media.mime,
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'",
      })
      .send(media.content);
  });
  router.post('/reports/:id/confirm', requireUser, (req, res) => {
    const id = String(req.params.id),
      user = res.locals.account.id;
    const report = db.prepare('SELECT author_id FROM report_details WHERE report_id=?').get(id) as
      { author_id: string } | undefined;
    if (!report) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Relato não encontrado.' } });
      return;
    }
    if (report.author_id === user) {
      res.status(400).json({
        error: { code: 'OWN_REPORT', message: 'Você não pode confirmar seu próprio relato.' },
      });
      return;
    }
    db.transaction(() => {
      const result = db
        .prepare(
          'INSERT INTO confirmations(report_id,account_id,created_at) VALUES(?,?,?) ON CONFLICT(report_id,account_id) DO NOTHING',
        )
        .run(id, user, new Date().toISOString());
      if (result.changes && db.prepare('SELECT id FROM accounts WHERE id=?').get(report.author_id))
        notify(
          db,
          report.author_id,
          `confirm:${id}:${user}`,
          id,
          'Seu relato recebeu uma confirmação',
          'Outro colaborador confirmou a observação. Isso não equivale a validação de autoridade.',
        );
    }).immediate();
    res.json({
      reportId: id,
      confirmations: (
        db.prepare('SELECT COUNT(*) AS n FROM confirmations WHERE report_id=?').get(id) as {
          n: number;
        }
      ).n,
    });
  });
  router.post('/report-disputes', requireUser, (req, res) => {
    const p = z
      .object({
        id: z.string().min(1).max(160),
        reportId: z.string().min(1).max(160),
        authorId: z.string().optional(),
        justification: z.string().trim().min(10).max(500),
        photoUri: z.string().max(200).optional(),
      })
      .strict()
      .safeParse(req.body);
    const authorId = res.locals.account.id;
    if (
      !p.success ||
      (p.data.authorId && p.data.authorId !== authorId) ||
      !validPhoto(db, p.success ? p.data.photoUri : undefined, authorId)
    ) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Confira a justificativa e a foto da contestação.',
        },
      });
      return;
    }
    const input = p.data;
    const report = db
      .prepare('SELECT author_id FROM report_details WHERE report_id=?')
      .get(input.reportId) as { author_id: string } | undefined;
    if (!report) {
      res
        .status(404)
        .json({ error: { code: 'NOT_FOUND', message: 'Sincronize o relato antes de contestar.' } });
      return;
    }
    const old = db.prepare('SELECT * FROM disputes WHERE id=?').get(input.id) as
      Record<string, string> | undefined;
    if (
      old &&
      (old.author_id !== authorId ||
        old.report_id !== input.reportId ||
        old.justification !== input.justification ||
        old.photo_uri !== (input.photoUri ?? null))
    ) {
      res.status(409).json({
        error: { code: 'CONFLICT', message: 'Este identificador já tem outro conteúdo.' },
      });
      return;
    }
    db.transaction(() => {
      db.prepare(
        'INSERT INTO disputes(id,report_id,author_id,justification,photo_uri,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING',
      ).run(
        input.id,
        input.reportId,
        authorId,
        input.justification,
        input.photoUri ?? null,
        new Date().toISOString(),
      );
      if (db.prepare('SELECT id FROM accounts WHERE id=?').get(report.author_id))
        notify(
          db,
          report.author_id,
          `dispute:${input.id}`,
          input.reportId,
          'Seu relato foi contestado',
          'Um colaborador enviou uma justificativa. O registro original foi preservado.',
        );
    }).immediate();
    res.status(old ? 200 : 201).json({
      id: input.id,
      reportId: input.reportId,
      authorId,
      justification: input.justification,
      ...(input.photoUri ? { photoUri: input.photoUri } : {}),
      createdAt: (
        db.prepare('SELECT created_at FROM disputes WHERE id=?').get(input.id) as {
          created_at: string;
        }
      ).created_at,
      status: 'sent',
    });
  });
  router.get('/community', requireUser, (_req, res) => {
    const user = res.locals.account.id;
    res.json({
      confirmations: db
        .prepare(
          'SELECT report_id AS reportId,COUNT(*) AS count FROM confirmations GROUP BY report_id',
        )
        .all(),
      confirmedReportIds: (
        db.prepare('SELECT report_id FROM confirmations WHERE account_id=?').all(user) as {
          report_id: string;
        }[]
      ).map((r) => r.report_id),
      disputes: db
        .prepare(
          "SELECT d.id,d.report_id AS reportId,d.author_id AS authorId,d.justification,d.photo_uri AS photoUri,d.created_at AS createdAt,'sent' AS status,d.review_status AS reviewStatus,d.moderation_note AS moderationNote,d.reviewed_at AS reviewedAt FROM disputes d JOIN report_details r ON r.report_id=d.report_id WHERE d.author_id=? OR r.author_id=?",
        )
        .all(user, user),
      notifications: db
        .prepare(
          'SELECT seq AS id,report_id AS reportId,title,body,created_at AS createdAt,read_at AS readAt FROM notifications WHERE account_id=? ORDER BY seq DESC LIMIT 100',
        )
        .all(user),
      reportStates: db
        .prepare(
          'SELECT report_id AS reportId,lifecycle,visibility,note AS stateNote,updated_at AS stateUpdatedAt FROM report_states',
        )
        .all(),
    });
  });
  router.post('/notifications/read', requireUser, (req, res) => {
    const p = z.object({ id: z.number().int().positive() }).strict().safeParse(req.body);
    if (!p.success) {
      res
        .status(400)
        .json({ error: { code: 'VALIDATION_ERROR', message: 'Notificação inválida.' } });
      return;
    }
    db.prepare(
      'UPDATE notifications SET read_at=COALESCE(read_at,?) WHERE seq=? AND account_id=?',
    ).run(new Date().toISOString(), p.data.id, res.locals.account.id);
    res.json({ ok: true });
  });
  return router;
}
