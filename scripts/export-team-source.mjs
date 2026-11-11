import {mkdirSync,mkdtempSync,cpSync,existsSync} from 'node:fs';
import {resolve,relative,basename} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=resolve(import.meta.dirname,'..');mkdirSync(resolve(root,'output'),{recursive:true});const out=mkdtempSync(resolve(root,'output/team-development-source-'));
const blocked=new Set(['node_modules','.next','dist','dist-test','.git','.local','.playwright-cli','output','verification']);
for(const name of ['apps/api','apps/console','packages','scripts','docs','config','package.json','pnpm-lock.yaml','pnpm-workspace.yaml','.gitignore','.env.example','.env.team.example','README.md']){
 const from=resolve(root,name);if(!existsSync(from))continue;
 cpSync(from,resolve(out,name),{recursive:true,filter:p=>!relative(from,p).split(/[\\/]/).some(x=>blocked.has(x))&&!/^(\.env(?:\.local|\.team)?|.*\.(?:log|tsbuildinfo|pem|key))$/.test(basename(p))});
}
// Include the protected reference, without the nested public Git repository.
for(const [from,to] of [['apps/web/public','apps/web/public'],['deployment/github-pages/index.html','deployment/github-pages/index.html']])if(existsSync(resolve(root,from)))cpSync(resolve(root,from),resolve(out,to),{recursive:true,filter:p=>!blocked.has(basename(p))});
const archive=resolve(root,'output/team-development-source.tar.gz');
const r=spawnSync('tar',['-czf',archive,'-C',out,'.'],{stdio:'inherit'});if(r.status!==0)throw Error('源码导出失败');
console.log(archive);
