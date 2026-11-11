import {mkdirSync,existsSync,writeFileSync,chmodSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {randomBytes,scryptSync} from 'node:crypto';
const root=resolve(import.meta.dirname,'..');process.chdir(root);
const local=resolve('.local');mkdirSync(local,{recursive:true,mode:0o700});chmodSync(local,0o700);
const pgBin=process.env.PG_BIN||'/opt/homebrew/opt/postgresql@16/bin';
const run=(file,args,env=process.env)=>{const r=spawnSync(file,args,{stdio:'inherit',env});if(r.status!==0)throw Error(`${file} failed`);};
if(!existsSync('.env.local')){
 const password=randomBytes(24).toString('base64url'),dbPassword=randomBytes(24).toString('base64url'),salt=randomBytes(16).toString('hex');
 writeFileSync(resolve(local,'admin-login.txt'),`本地中台登录（不是Shopee账号）\n邮箱：admin@yz-cube.local\n密码：${password}\n`,{mode:0o600});
 writeFileSync(resolve(local,'db-password'),dbPassword,{mode:0o600});
 writeFileSync('.env.local',`NODE_ENV=development\nDATABASE_URL=postgresql://yz_hub:${dbPassword}@127.0.0.1:55439/yz_commerce_hub?schema=public\nTOKEN_ENCRYPTION_KEY=${randomBytes(32).toString('base64')}\nADMIN_EMAIL=admin@yz-cube.local\nADMIN_PASSWORD_HASH=${salt}:${scryptSync(password,salt,64).toString('hex')}\nWEB_ORIGIN=http://127.0.0.1:3100\nPUBLIC_API_ORIGIN=http://127.0.0.1:3100\nAPI_PORT=4100\nSHOPEE_APPS_FILE=${resolve(local,'shopee-apps.json')}\n`,{mode:0o600});
 writeFileSync(resolve(local,'shopee-apps.json'),'[]\n',{mode:0o600});
}
process.loadEnvFile('.env.local');
const data=resolve(local,'postgres');
if(!existsSync(resolve(data,'PG_VERSION'))){run(`${pgBin}/initdb`,['-D',data,'-U','yz_hub','--auth-local=trust','--auth-host=scram-sha-256',`--pwfile=${resolve(local,'db-password')}`,'--encoding=UTF8','--locale=C']);}
const status=spawnSync(`${pgBin}/pg_ctl`,['-D',data,'status'],{stdio:'ignore'});
if(status.status!==0)run(`${pgBin}/pg_ctl`,['-D',data,'-l',resolve(local,'postgres.log'),'-o',`-h 127.0.0.1 -p 55439 -k ${local}`,'start']);
const dbUrl=new URL(process.env.DATABASE_URL);const dbEnv={...process.env,PGPASSWORD:decodeURIComponent(dbUrl.password)};
for(const name of ['yz_commerce_hub','yz_commerce_hub_test']){
 const r=spawnSync(`${pgBin}/psql`,['-h','127.0.0.1','-p','55439','-U','yz_hub','-d','postgres','-Atc',`SELECT 1 FROM pg_database WHERE datname='${name}'`],{env:dbEnv,encoding:'utf8'});
 if(r.status!==0)throw Error('Cannot connect to dedicated local database');
 if(r.stdout.trim()!=='1')run(`${pgBin}/createdb`,['-h','127.0.0.1','-p','55439','-U','yz_hub',name],dbEnv);
}
run('pnpm',['--filter','@yz-cube/api','exec','prisma','generate']);
run('pnpm',['--filter','@yz-cube/api','exec','prisma','migrate','deploy']);
const testEnv={...process.env,DATABASE_URL:process.env.DATABASE_URL.replace('/yz_commerce_hub?','/yz_commerce_hub_test?')};
run('pnpm',['--filter','@yz-cube/api','exec','prisma','migrate','deploy'],testEnv);
console.log('本地数据库和管理员已准备。登录信息：.local/admin-login.txt（仅本机可读）。Shopee App未配置时不会生成模拟连接。');
