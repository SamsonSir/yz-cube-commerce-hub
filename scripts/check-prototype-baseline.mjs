import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..');
const expected='3669023cc554cf27fd665728b8010abb298e537e2cdfab1d66255608d7b61f45';
const files=['apps/web/public/interactive-preview.html'];
// The independently managed public prototype repository is not part of a fresh checkout.
if(existsSync(resolve(root,'deployment/github-pages/index.html')))files.push('deployment/github-pages/index.html');
for(const file of files){
 assert.equal(createHash('sha256').update(readFileSync(resolve(root,file))).digest('hex'),expected,`Protected prototype changed: ${file}`);
}
console.log('受保护原型及本机存在的公开站点副本校验通过。');
