import {spawn} from 'node:child_process';
// tsc emits Nest decorator metadata; the runtime restarts after compiled changes.
const children=[
 spawn('pnpm',['exec','tsc','-p','tsconfig.json','--watch','--preserveWatchOutput'],{stdio:'inherit'}),
 spawn(process.execPath,['--env-file=../../.env.local','--watch','dist/main.js'],{stdio:'inherit'}),
];
let stopping=false;
function stop(code=0){if(stopping)return;stopping=true;for(const child of children)child.kill('SIGTERM');process.exitCode=code;}
for(const child of children){child.on('error',()=>stop(1));child.on('exit',code=>stop(code??0));}
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
