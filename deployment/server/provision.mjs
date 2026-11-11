// Run as root on the target server after bootstrap, with the release path as argv[2].
// Secrets are generated and retained only on that server. Re-runs preserve them.
import { existsSync, writeFileSync, readFileSync, chmodSync, chownSync } from 'node:fs';
import { randomBytes, scryptSync } from 'node:crypto';
import { execFileSync } from 'node:child_process';

if (process.getuid() !== 0) throw new Error('Run as root');
const release = process.argv[2];
if (!/^\/opt\/yz-commerce\/releases\/[a-zA-Z0-9-]+$/.test(release || '')) throw new Error('Invalid release path');
const origin = process.env.HUB_ORIGIN || 'https://commerce.aicbec.cn';
const url = new URL(origin);
if (url.protocol !== 'https:' || url.origin !== origin || url.username || url.password) throw new Error('HUB_ORIGIN must be an HTTPS origin');
const path = '/etc/yz-commerce/app.env';
const gid = Number(execFileSync('id', ['-g', 'yz-hub'], { encoding: 'utf8' }).trim());
if (!existsSync(path)) {
  const password = randomBytes(32).toString('hex');
  const adminPassword = randomBytes(24).toString('base64url');
  const salt = randomBytes(16).toString('hex');
  const adminHash = `${salt}:${scryptSync(adminPassword, salt, 64).toString('hex')}`;
  // Hex-only password is safe as a SQL literal; role/database names are constants.
  execFileSync('runuser', ['-u', 'postgres', '--', 'psql', '-v', 'ON_ERROR_STOP=1'], {
    input: `CREATE ROLE yz_commerce LOGIN PASSWORD '${password}';\nCREATE DATABASE yz_commerce OWNER yz_commerce;\n`, stdio: ['pipe', 'pipe', 'pipe'],
  });
  writeFileSync('/etc/yz-commerce/admin-login.txt', `URL: ${origin}\nEmail: wangzy@yz-cube.com\nPassword: ${adminPassword}\n`, { mode: 0o600, flag: 'wx' });
  writeFileSync(path, [
    'NODE_ENV=production',
    `DATABASE_URL=postgresql://yz_commerce:${password}@127.0.0.1:5432/yz_commerce?schema=public`,
    `TOKEN_ENCRYPTION_KEY=${randomBytes(32).toString('base64')}`,
    'ADMIN_EMAIL=wangzy@yz-cube.com',
    `ADMIN_PASSWORD_HASH=${adminHash}`,
    `WEB_ORIGIN=${origin}`,
    `PUBLIC_API_ORIGIN=${origin}`,
    'API_PORT=4100',
    'SHOPEE_APPS_FILE=/etc/yz-commerce/shopee-apps.json', '',
  ].join('\n'), { mode: 0o640, flag: 'wx' });
}
if (!existsSync('/etc/yz-commerce/shopee-apps.json')) writeFileSync('/etc/yz-commerce/shopee-apps.json', '[]\n', { mode: 0o640, flag: 'wx' });
for (const f of [path, '/etc/yz-commerce/shopee-apps.json']) { chownSync(f, 0, gid); chmodSync(f, 0o640); }
const env = { ...process.env };
for (const line of readFileSync(path, 'utf8').trim().split('\n')) {
  const index = line.indexOf('='); env[line.slice(0, index)] = line.slice(index + 1);
}
execFileSync('/opt/yz-commerce/runtime/node-v22.22.2-linux-x64/bin/node', [
  `${release}/apps/api/node_modules/prisma/build/index.js`, 'migrate', 'deploy', '--schema', `${release}/apps/api/prisma/schema.prisma`,
], { env, cwd: release, stdio: ['ignore', 'pipe', 'pipe'] });
console.log('Production database migrated; credentials retained in /etc/yz-commerce (not printed).');
