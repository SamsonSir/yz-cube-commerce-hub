import { createApp } from './app';
async function main(){const app=await createApp();await app.listen(Number(process.env.API_PORT||4100),'127.0.0.1');console.log('YZ Cube API ready on loopback');}
main().catch(()=>{console.error('API startup failed. Check server configuration and database.');process.exit(1);});
