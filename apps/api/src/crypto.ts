import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
export const hash = (text: string) => createHash('sha256').update(text).digest('hex');
export const randomToken = () => randomBytes(32).toString('base64url');
export function passwordHash(password: string) { const salt = randomBytes(16).toString('hex'); return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`; }
export function verifyPassword(password: string, encoded: string) {
  const [salt, value] = encoded.split(':');
  if (!salt || !value) return false;
  const actual = scryptSync(password, salt, 64); const expected = Buffer.from(value, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function encrypt(value: string, key: Buffer) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${body.toString('base64url')}`;
}
export function decrypt(value: string, key: Buffer) {
  const [version, iv, tag, body] = value.split('.');
  if (version !== 'v1') throw new Error('Unsupported token encryption version');
  const cipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  cipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([cipher.update(Buffer.from(body, 'base64url')), cipher.final()]).toString('utf8');
}
