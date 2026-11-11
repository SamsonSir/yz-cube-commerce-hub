import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const r=spawnSync(`${process.env.PG_BIN||'/opt/homebrew/opt/postgresql@16/bin'}/pg_ctl`,['-D',resolve(root,'.local/postgres'),'stop','-m','fast'],{stdio:'inherit'});process.exit(r.status??1);
