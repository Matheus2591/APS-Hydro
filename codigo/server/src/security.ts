import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

export function verifyPassword(password: string, stored?: string) {
  const [salt, hash] = (stored ?? `${'0'.repeat(32)}:${'0'.repeat(128)}`).split(':');
  if (!salt || !hash || !/^[a-f0-9]{128}$/.test(hash)) return false;
  return timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(hash, 'hex')) && !!stored;
}

export function recoveryDigest(code: string) {
  return createHash('sha256').update(code.replace(/[-\s]/g, '').toUpperCase()).digest('hex');
}

export function newRecoveryCode() {
  const code = randomBytes(20).toString('hex').toUpperCase().match(/.{4}/g)!.join('-');
  return { code, hash: recoveryDigest(code) };
}
