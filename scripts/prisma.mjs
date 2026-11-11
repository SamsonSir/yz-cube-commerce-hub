import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
const require=createRequire(new URL('../apps/api/package.json',import.meta.url));
const r=spawnSync(process.execPath,[require.resolve('prisma'),...process.argv.slice(2)],{stdio:'inherit',env:process.env});process.exit(r.status??1);
