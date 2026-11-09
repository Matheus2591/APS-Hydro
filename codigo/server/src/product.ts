import { Router, type RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { HydroDatabase } from './db/database.js';
import { requireAccount, createAccountSession, notify, type Account } from './community.js';
import { hashPassword, verifyPassword, newRecoveryCode, recoveryDigest } from './security.js';

export function prepareProductSchema(db: HydroDatabase) {
  const add = (table: string, name: string, definition: string) => {
    const columns = db.pragma(`table_info(${table})`) as Array<{ name: string }>;
    if (!columns.some((column) => column.name === name))
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  };
  add('accounts', 'login_name', 'TEXT');
  add('accounts', 'recovery_hash', 'TEXT');
  add('accounts', 'role', "TEXT NOT NULL DEFAULT 'user'");
  add('disputes', 'review_status', "TEXT NOT NULL DEFAULT 'pending'");
  add('disputes', 'moderation_note', 'TEXT');
  add('disputes', 'reviewed_at', 'TEXT');
  add('disputes', 'reviewer_id', 'TEXT');
  db.exec(`UPDATE accounts SET login_name=name WHERE login_name IS NULL;
    CREATE TABLE IF NOT EXISTS report_states(report_id TEXT PRIMARY KEY,lifecycle TEXT NOT NULL DEFAULT 'active',visibility TEXT NOT NULL DEFAULT 'visible',note TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS report_state_events(id TEXT PRIMARY KEY,report_id TEXT NOT NULL,author_id TEXT NOT NULL,lifecycle TEXT NOT NULL,note TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS moderation_actions(id TEXT PRIMARY KEY,dispute_id TEXT NOT NULL,actor_id TEXT,action TEXT NOT NULL,note TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS hidden_media(id TEXT PRIMARY KEY);
  `);
}

export function reportState(db: HydroDatabase, id: string) {
  return db
    .prepare(
      'SELECT lifecycle,visibility,note AS stateNote,updated_at AS stateUpdatedAt FROM report_states WHERE report_id=?',
    )
    .get(id) as
    | {
        lifecycle: 'active' | 'resolved';
        visibility: 'visible' | 'hidden' | 'removed';
        stateNote: string;
        stateUpdatedAt: string;
      }
    | undefined;
}

export function canReadReport(db: HydroDatabase, id: string, viewer?: Account) {
  const state = reportState(db, id);
  if (!state || state.visibility === 'visible') return true;
  if (state.visibility === 'removed') return false;
  return (
    viewer?.role === 'moderator' ||
    !!db
      .prepare('SELECT report_id FROM report_details WHERE report_id=? AND author_id=?')
      .get(id, viewer?.id ?? '')
  );
}

export function createProductRouter(db: HydroDatabase) {
  const router = Router();
  const requireUser = requireAccount(db);
  const limited = rateLimit({
    windowMs: 15 * 60_000,
    limit: 12,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    validate: { xForwardedForHeader: false },
    message: {
      error: {
        code: 'AUTH_RATE_LIMIT',
        message: 'Aguarde alguns minutos antes de tentar novamente.',
      },
    },
  });
  const fail = (res: any, status: number, code: string, message: string) =>
    res.status(status).json({ error: { code, message } });
  const password = z.string().min(8).max(128);
  const currentSchema = z.object({ currentPassword: z.string().min(1).max(128) }).strict();
  const requireModerator: RequestHandler = (_req, res, next) => {
    if (res.locals.account.role !== 'moderator') {
      fail(res, 403, 'FORBIDDEN', 'Esta área é restrita à moderação.');
      return;
    }
    next();
  };

  router.post('/auth/recover', limited, (req, res) => {
    const p = z
      .object({
        name: z.string().trim().min(1).max(100),
        recoveryCode: z.string().min(20).max(100),
        newPassword: password,
      })
      .strict()
      .safeParse(req.body);
    if (!p.success) {
      fail(
        res,
        400,
        'VALIDATION_ERROR',
        'Confira o usuário, a chave e a nova senha de 8 a 128 caracteres.',
      );
      return;
    }
    const account = db
      .prepare('SELECT * FROM accounts WHERE name_key=?')
      .get(p.data.name.normalize('NFKC').toLocaleLowerCase('pt-BR')) as Account | undefined;
    const expected = account?.recovery_hash ?? '0'.repeat(64);
    const valid = timingSafeEqual(
      Buffer.from(recoveryDigest(p.data.recoveryCode), 'hex'),
      Buffer.from(expected, 'hex'),
    );
    if (!account || !account.recovery_hash || !valid) {
      fail(res, 401, 'INVALID_RECOVERY', 'Usuário ou chave de recuperação incorretos.');
      return;
    }
    const code = newRecoveryCode();
    const session = db
      .transaction(() => {
        db.prepare('UPDATE accounts SET password_hash=?,recovery_hash=? WHERE id=?').run(
          hashPassword(p.data.newPassword),
          code.hash,
          account.id,
        );
        db.prepare('DELETE FROM sessions WHERE account_id=?').run(account.id);
        return createAccountSession(db, account);
      })
      .immediate();
    res.json({ ...session, recoveryCode: code.code });
  });

  router.post('/auth/password', limited, requireUser, (req, res) => {
    const p = z
      .object({ currentPassword: z.string().min(1).max(128), newPassword: password })
      .strict()
      .safeParse(req.body);
    const account = res.locals.account as Account;
    if (!p.success) {
      fail(res, 400, 'VALIDATION_ERROR', 'Use uma nova senha de 8 a 128 caracteres.');
      return;
    }
    if (!verifyPassword(p.data.currentPassword, account.password_hash)) {
      fail(res, 401, 'INVALID_PASSWORD', 'A senha atual está incorreta.');
      return;
    }
    const code = newRecoveryCode();
    const session = db
      .transaction(() => {
        db.prepare('UPDATE accounts SET password_hash=?,recovery_hash=? WHERE id=?').run(
          hashPassword(p.data.newPassword),
          code.hash,
          account.id,
        );
        db.prepare('DELETE FROM sessions WHERE account_id=?').run(account.id);
        return createAccountSession(db, account);
      })
      .immediate();
    res.json({ ...session, recoveryCode: code.code });
  });

  router.post('/auth/recovery-code', limited, requireUser, (req, res) => {
    const p = currentSchema.safeParse(req.body),
      account = res.locals.account as Account;
    if (!p.success || !verifyPassword(p.data.currentPassword, account.password_hash)) {
      fail(res, 401, 'INVALID_PASSWORD', 'Informe sua senha atual.');
      return;
    }
    const code = newRecoveryCode();
    db.prepare('UPDATE accounts SET recovery_hash=? WHERE id=?').run(code.hash, account.id);
    res.json({ recoveryCode: code.code });
  });

  router.post('/auth/delete', limited, requireUser, (req, res) => {
    const p = z
      .object({ currentPassword: z.string().min(1).max(128), confirmation: z.literal('EXCLUIR') })
      .strict()
      .safeParse(req.body);
    const account = res.locals.account as Account;
    if (!p.success || !verifyPassword(p.data.currentPassword, account.password_hash)) {
      fail(res, 401, 'INVALID_PASSWORD', 'Confira sua senha e digite EXCLUIR para confirmar.');
      return;
    }
    db.transaction(() => {
      const own = db
        .prepare(
          'SELECT r.id FROM reports r LEFT JOIN report_details d ON d.report_id=r.id WHERE r.installation_id=? OR d.author_id=?',
        )
        .all(account.id, account.id) as Array<{ id: string }>;
      for (const { id } of own) {
        db.prepare(
          "INSERT INTO report_states(report_id,lifecycle,visibility,note,updated_at) VALUES(?,'active','removed','',?) ON CONFLICT(report_id) DO UPDATE SET visibility='removed',note='',updated_at=excluded.updated_at",
        ).run(id, new Date().toISOString());
        db.prepare(
          'DELETE FROM moderation_actions WHERE dispute_id IN (SELECT id FROM disputes WHERE report_id=?)',
        ).run(id);
        db.prepare('DELETE FROM notifications WHERE report_id=?').run(id);
        db.prepare('DELETE FROM confirmations WHERE report_id=?').run(id);
        db.prepare('DELETE FROM disputes WHERE report_id=?').run(id);
        db.prepare('DELETE FROM report_state_events WHERE report_id=?').run(id);
        db.prepare('DELETE FROM report_details WHERE report_id=?').run(id);
        db.prepare('DELETE FROM reports WHERE id=?').run(id);
      }
      db.prepare(
        "DELETE FROM notifications WHERE event_key IN (SELECT 'dispute:'||id FROM disputes WHERE author_id=?) OR event_key IN (SELECT 'confirm:'||report_id||':'||account_id FROM confirmations WHERE account_id=?)",
      ).run(account.id, account.id);
      db.prepare(
        'DELETE FROM moderation_actions WHERE dispute_id IN (SELECT id FROM disputes WHERE author_id=?)',
      ).run(account.id);
      db.prepare('DELETE FROM disputes WHERE author_id=?').run(account.id);
      db.prepare('DELETE FROM confirmations WHERE account_id=?').run(account.id);
      db.prepare('DELETE FROM notifications WHERE account_id=?').run(account.id);
      db.prepare('DELETE FROM report_state_events WHERE author_id=?').run(account.id);
      db.prepare('UPDATE moderation_actions SET actor_id=NULL WHERE actor_id=?').run(account.id);
      db.prepare('UPDATE disputes SET reviewer_id=NULL WHERE reviewer_id=?').run(account.id);
      db.prepare(
        'DELETE FROM hidden_media WHERE id IN (SELECT id FROM media WHERE owner_id=?)',
      ).run(account.id);
      db.prepare('DELETE FROM media WHERE owner_id=?').run(account.id);
      db.prepare('DELETE FROM sessions WHERE account_id=?').run(account.id);
      db.prepare('DELETE FROM accounts WHERE id=?').run(account.id);
    }).immediate();
    res.json({ ok: true });
  });

  router.post('/reports/:id/state', requireUser, (req, res) => {
    const p = z
      .object({
        operationId: z.string().min(1).max(160),
        lifecycle: z.enum(['active', 'resolved']),
        note: z.string().trim().max(300),
      })
      .strict()
      .safeParse(req.body);
    const id = String(req.params.id),
      actor = res.locals.account.id;
    const owner = db.prepare('SELECT installation_id AS id FROM reports WHERE id=?').get(id) as
      { id: string } | undefined;
    if (!owner || owner.id !== actor) {
      fail(res, 403, 'FORBIDDEN', 'Somente o autor pode atualizar uma ocorrência existente.');
      return;
    }
    if (!p.success) {
      fail(res, 400, 'VALIDATION_ERROR', 'Confira a situação e escreva até 300 caracteres.');
      return;
    }
    const old = db
      .prepare('SELECT * FROM report_state_events WHERE id=?')
      .get(p.data.operationId) as Record<string, string> | undefined;
    if (
      old &&
      (old.report_id !== id ||
        old.author_id !== actor ||
        old.lifecycle !== p.data.lifecycle ||
        old.note !== p.data.note)
    ) {
      fail(res, 409, 'CONFLICT', 'Esta atualização já foi recebida com outro conteúdo.');
      return;
    }
    if (!old)
      db.transaction(() => {
        const now = new Date().toISOString();
        db.prepare(
          'INSERT INTO report_state_events(id,report_id,author_id,lifecycle,note,created_at) VALUES(?,?,?,?,?,?)',
        ).run(p.data.operationId, id, actor, p.data.lifecycle, p.data.note, now);
        db.prepare(
          "INSERT INTO report_states(report_id,lifecycle,visibility,note,updated_at) VALUES(?,?,'visible',?,?) ON CONFLICT(report_id) DO UPDATE SET lifecycle=excluded.lifecycle,note=excluded.note,updated_at=excluded.updated_at",
        ).run(id, p.data.lifecycle, p.data.note, now);
      }).immediate();
    res.json({ reportId: id, ...reportState(db, id) });
  });

  router.get('/moderation', requireUser, requireModerator, (_req, res) => {
    const items = db
      .prepare(
        `SELECT d.id,d.report_id AS reportId,d.justification,d.photo_uri AS evidencePhotoUri,d.created_at AS createdAt,d.review_status AS reviewStatus,d.moderation_note AS moderationNote,r.description,p.address,p.photo_uri AS reportPhotoUri FROM disputes d JOIN reports r ON r.id=d.report_id JOIN report_details p ON p.report_id=r.id ORDER BY CASE d.review_status WHEN 'pending' THEN 0 ELSE 1 END,d.created_at DESC LIMIT 100`,
      )
      .all();
    res.json({ items });
  });

  router.post('/moderation/:id', requireUser, requireModerator, (req, res) => {
    const p = z
      .object({
        operationId: z.string().min(1).max(160),
        action: z.enum(['keep', 'hide']),
        note: z.string().trim().min(10).max(300),
      })
      .strict()
      .safeParse(req.body);
    if (!p.success) {
      fail(res, 400, 'VALIDATION_ERROR', 'Explique a decisão em 10 a 300 caracteres.');
      return;
    }
    const id = String(req.params.id),
      actor = res.locals.account.id;
    const dispute = db.prepare('SELECT * FROM disputes WHERE id=?').get(id) as
      Record<string, string> | undefined;
    if (!dispute) {
      fail(res, 404, 'NOT_FOUND', 'Contestação não encontrada.');
      return;
    }
    const old = db
      .prepare('SELECT * FROM moderation_actions WHERE id=?')
      .get(p.data.operationId) as Record<string, string> | undefined;
    if (
      old &&
      (old.dispute_id !== id ||
        old.actor_id !== actor ||
        old.action !== p.data.action ||
        old.note !== p.data.note)
    ) {
      fail(res, 409, 'CONFLICT', 'Este identificador já registra outra decisão.');
      return;
    }
    if (!old)
      db.transaction(() => {
        const now = new Date().toISOString(),
          visibility = p.data.action === 'hide' ? 'hidden' : 'visible';
        db.prepare(
          'INSERT INTO moderation_actions(id,dispute_id,actor_id,action,note,created_at) VALUES(?,?,?,?,?,?)',
        ).run(p.data.operationId, id, actor, p.data.action, p.data.note, now);
        db.prepare(
          'UPDATE disputes SET review_status=?,moderation_note=?,reviewed_at=?,reviewer_id=? WHERE id=?',
        ).run(p.data.action === 'hide' ? 'hidden' : 'kept', p.data.note, now, actor, id);
        db.prepare(
          "INSERT INTO report_states(report_id,lifecycle,visibility,note,updated_at) VALUES(?,'active',?,'',?) ON CONFLICT(report_id) DO UPDATE SET visibility=excluded.visibility,updated_at=excluded.updated_at",
        ).run(dispute.report_id, visibility, now);
        const details = db
          .prepare('SELECT author_id,photo_uri FROM report_details WHERE report_id=?')
          .get(dispute.report_id) as { author_id: string; photo_uri: string | null };
        const mediaId = details.photo_uri?.match(/^\/v1\/media\/([a-f0-9]{64})$/)?.[1];
        if (mediaId && visibility === 'hidden')
          db.prepare('INSERT INTO hidden_media(id) VALUES(?) ON CONFLICT(id) DO NOTHING').run(
            mediaId,
          );
        if (
          mediaId &&
          visibility === 'visible' &&
          !db
            .prepare(
              "SELECT r.report_id FROM report_details r JOIN report_states s ON s.report_id=r.report_id WHERE r.photo_uri=? AND s.visibility='hidden'",
            )
            .get(details.photo_uri)
        )
          db.prepare('DELETE FROM hidden_media WHERE id=?').run(mediaId);
        for (const recipient of new Set([details.author_id, dispute.author_id])) {
          notify(
            db,
            recipient,
            `moderation:${p.data.operationId}`,
            dispute.report_id,
            'Contestação analisada',
            `${visibility === 'hidden' ? 'O relato foi ocultado do mapa.' : 'O relato foi mantido.'} ${p.data.note}`,
          );
        }
      }).immediate();
    res.json({ ok: true });
  });
  return router;
}
