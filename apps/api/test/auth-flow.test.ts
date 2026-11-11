import 'reflect-metadata';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHmac,randomBytes} from 'node:crypto';
import {passwordHash,decrypt} from '../src/crypto';
import {createApp} from '../src/app';
import {Database} from '../src/database';
import {Config} from '../src/config';
import {Shops} from '../src/shops';

test('local authorization lifecycle through real HTTP + PostgreSQL (emulated Shopee, not live verification)',async t=>{
 process.env.NODE_ENV='test';
 const production=process.env.DATABASE_URL!;
 assert.ok(production.includes('/yz_commerce_hub?'));
 process.env.DATABASE_URL=production.replace('/yz_commerce_hub?','/yz_commerce_hub_test?');
 process.env.ADMIN_EMAIL='test-admin@local.test';process.env.ADMIN_PASSWORD_HASH=passwordHash('test-password-only');
 process.env.WEB_ORIGIN='http://127.0.0.1:3100';process.env.PUBLIC_API_ORIGIN=process.env.WEB_ORIGIN;
 let exchanges=0,refreshes=0,refreshMode='ok',shopMode='ok';
 const testKey='fixture-key-only-not-a-real-key';
 const provider=createServer(async(req,res)=>{
  const url=new URL(req.url!,'http://127.0.0.1');let raw='';for await(const c of req)raw+=c;
  const body=raw?JSON.parse(raw):{};
  const token=url.searchParams.get('access_token')||'',shop=url.searchParams.get('shop_id')||'';
  const expected=createHmac('sha256',testKey).update(`10001${url.pathname}${url.searchParams.get('timestamp')}${token}${shop}`).digest('hex');
  res.setHeader('Content-Type','application/json');
  if(url.searchParams.get('partner_id')!=='10001'||url.searchParams.get('sign')!==expected){res.end(JSON.stringify({error:'wrong_sign'}));return;}
  if(url.pathname==='/api/v2/auth/token/get'){
   exchanges++;assert.equal(body.partner_id,10001);assert.equal(body.shop_id,123456);
   if(body.code==='rejected'){res.end(JSON.stringify({error:'invalid_code',message:'DO_NOT_EXPOSE_FIXTURE_SECRET'}));return;}
   res.end(JSON.stringify({access_token:'fixture-access-1',refresh_token:'fixture-refresh-1',expire_in:14400,shop_id_list:[123456]}));
  }else if(url.pathname==='/api/v2/auth/access_token/get'){
   refreshes++;await new Promise(r=>setTimeout(r,80));
   if(refreshMode==='invalid'){res.end(JSON.stringify({error:'invalid_refresh_token'}));return;}
   if(refreshMode==='unavailable'){res.statusCode=503;res.end(JSON.stringify({error:'unavailable'}));return;}
   res.end(JSON.stringify({access_token:`fixture-access-${refreshes+1}`,refresh_token:`fixture-refresh-${refreshes+1}`,expire_in:14400}));
  }else if(url.pathname==='/api/v2/shop/get_shop_info'){
   if(shopMode==='denied'){res.end(JSON.stringify({error:'permission_denied'}));return;}
   res.end(JSON.stringify({shop_name:'集成测试店铺（非真实店铺）',region:'PH'}));
  }else if(url.pathname==='/api/v2/product/get_item_list'){assert.equal(url.searchParams.get('item_status'),'NORMAL');res.end(JSON.stringify({response:{item:[{item_id:987654,item_status:'NORMAL'}],has_next_page:false}}));}else if(url.pathname==='/api/v2/product/get_item_base_info'){res.end(JSON.stringify({response:{item_list:[{item_id:987654,item_name:'HTTP fixture product'}]}}));}else{res.statusCode=404;res.end('{}');}
 });
 provider.listen(0,'127.0.0.1');await once(provider,'listening');
 const providerPort=(provider.address() as {port:number}).port;
 const fixtures=resolve('../../.local/test-fixtures');mkdirSync(fixtures,{recursive:true,mode:0o700});
 const file=resolve(fixtures,`apps-${randomBytes(5).toString('hex')}.json`);
 writeFileSync(file,JSON.stringify([{id:'fixture-app',name:'本地测试提供者',environment:'sandbox',partnerId:10001,partnerKey:testKey,baseUrl:`http://127.0.0.1:${providerPort}`}]),{mode:0o600});
 process.env.SHOPEE_APPS_FILE=file;
 const app=await createApp();await app.listen(0,'127.0.0.1');
 const base=`${await app.getUrl()}/api/v1`,db=app.get(Database);
 // Only the dedicated *_test database may be reset.
 assert.ok(process.env.DATABASE_URL.includes('/yz_commerce_hub_test?'));
 await db.authorizationAttempt.deleteMany();await db.shopConnection.deleteMany();await db.auditLog.deleteMany();await db.session.deleteMany();
 await db.user.update({where:{email:process.env.ADMIN_EMAIL},data:{passwordHash:process.env.ADMIN_PASSWORD_HASH}});
 let cookie='';
 const request=(path:string,method='GET',body?:object,extra:Record<string,string>={})=>fetch(base+path,{method,headers:{origin:process.env.WEB_ORIGIN!,cookie,'Content-Type':'application/json',...extra},body:body?JSON.stringify(body):undefined,redirect:'manual'});
 async function start(){const r=await request('/shopee/authorize','POST',{appId:'fixture-app'});assert.equal(r.status,201);const u=new URL((await r.json() as {url:string}).url);assert.equal(u.pathname,'/api/v2/shop/auth_partner');const cb=new URL(u.searchParams.get('redirect')!);return cb.search;}
 try{
 await t.test('unauthenticated APIs and cross-origin mutations are blocked',async()=>{
  assert.equal((await request('/shops')).status,401);
  assert.equal((await request('/auth/login','POST',{email:process.env.ADMIN_EMAIL,password:'test-password-only'},{origin:'https://attacker.test'})).status,403);
 });
 await t.test('login creates HttpOnly session; config never exposes partner key',async()=>{
  const r=await request('/auth/login','POST',{email:process.env.ADMIN_EMAIL,password:'test-password-only'});assert.equal(r.status,201);
  const value=r.headers.get('set-cookie')!;assert.match(value,/HttpOnly/);assert.match(value,/SameSite=Lax/);cookie=value.split(';')[0];
  const apps=await(await request('/shopee/apps')).text();assert.ok(!apps.includes(testKey));assert.ok(!apps.includes('partnerKey'));
 });
 let cb='';let connectionId='';
 await t.test('callback rejects wrong browser, expired and tampered state without exchange',async()=>{
  cb=await start();let r=await request(`/shopee/callback${cb}&code=ok&shop_id=123456`,'GET',undefined,{cookie:''});assert.equal(r.status,303);assert.match(r.headers.get('location')!,/failed/);assert.equal(exchanges,0);
  r=await request('/shopee/callback?state=tampered&code=ok&shop_id=123456');assert.match(r.headers.get('location')!,/failed/);assert.equal(exchanges,0);
 });
 await t.test('successful exchange, encrypted persistence, shop verification; replay does not exchange again',async()=>{
  const r=await request(`/shopee/callback${cb}&code=ok&shop_id=123456`);assert.match(r.headers.get('location')!,/saved/);assert.equal(exchanges,1);
  const stored=await db.shopConnection.findFirstOrThrow();connectionId=stored.id;assert.equal(stored.status,'CONNECTED');assert.equal(stored.shopName,'集成测试店铺（非真实店铺）');assert.notEqual(stored.accessTokenCipher,'fixture-access-1');assert.equal(decrypt(stored.accessTokenCipher,app.get(Config).encryptionKey),'fixture-access-1');
  const data=await(await request('/shops')).text();assert.ok(!data.includes('fixture-access'));assert.ok(!data.includes('TokenCipher'));
  const replay=await request(`/shopee/callback${cb}&code=ok&shop_id=123456`);assert.match(replay.headers.get('location')!,/failed/);assert.equal(exchanges,1);
 });
 await t.test('expired pending authorization cannot be exchanged',async()=>{
  const expired=await start();await db.authorizationAttempt.updateMany({where:{usedAt:null},data:{expiresAt:new Date(0)}});
  const r=await request(`/shopee/callback${expired}&code=ok&shop_id=123456`);assert.match(r.headers.get('location')!,/failed/);assert.equal(exchanges,1);
 });
 await t.test('app identity changes invalidate pending callbacks and never send stored tokens to another partner',async()=>{
  const cb=await start();const configured=app.get(Config).apps[0];const original=configured.partnerId;
  const beforeExchange=exchanges,beforeRefresh=refreshes;
  try {
   configured.partnerId=99999;
   const callback=await request(`/shopee/callback${cb}&code=ok&shop_id=123456`);
   assert.match(callback.headers.get('location')!,/failed/);assert.equal(exchanges,beforeExchange);
   assert.equal((await request(`/shops/${connectionId}/verify`,'POST')).status,400);
   assert.equal((await request(`/shops/${connectionId}/refresh`,'POST')).status,400);
   assert.equal(refreshes,beforeRefresh);
  }finally{configured.partnerId=original;}
 });
 await t.test('re-authorization upserts instead of duplicating; failed shop read retains tokens',async()=>{
  shopMode='denied';const cb=await start();await request(`/shopee/callback${cb}&code=ok&shop_id=123456`);
  assert.equal(await db.shopConnection.count(),1);const s=await db.shopConnection.findUniqueOrThrow({where:{id:connectionId}});assert.equal(s.status,'VERIFY_FAILED');assert.equal(s.lastError,'PERMISSION_DENIED');assert.ok(s.refreshTokenCipher);
  shopMode='ok';await request(`/shops/${connectionId}/verify`,'POST');assert.equal((await db.shopConnection.findUniqueOrThrow({where:{id:connectionId}})).status,'CONNECTED');
 });
 await t.test('parallel refresh performs exactly one token rotation',async()=>{
  const before=refreshes;const results=await Promise.all([request(`/shops/${connectionId}/refresh`,'POST'),request(`/shops/${connectionId}/refresh`,'POST')]);
  assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);assert.equal(refreshes,before+1);
  const c=await db.shopConnection.findUniqueOrThrow({where:{id:connectionId}});assert.equal(c.status,'CONNECTED');assert.equal(decrypt(c.refreshTokenCipher,app.get(Config).encryptionKey),'fixture-refresh-2');
 });
 await t.test('transient failure retains old tokens and schedules retry; invalid refresh requires reauthorization',async()=>{
  const old=await db.shopConnection.findUniqueOrThrow({where:{id:connectionId}});refreshMode='unavailable';await request(`/shops/${connectionId}/refresh`,'POST');let c=await db.shopConnection.findUniqueOrThrow({where:{id:connectionId}});assert.equal(c.status,'RETRY_PENDING');assert.equal(c.refreshTokenCipher,old.refreshTokenCipher);
  await db.shopConnection.update({where:{id:connectionId},data:{refreshLeaseUntil:null}});refreshMode='invalid';await request(`/shops/${connectionId}/refresh`,'POST');c=await db.shopConnection.findUniqueOrThrow({where:{id:connectionId}});assert.equal(c.status,'REAUTH_REQUIRED');assert.equal(c.refreshTokenCipher,old.refreshTokenCipher);
 });
 await t.test('scheduled scan refreshes only eligible expiring connections',async()=>{
  refreshMode='ok';const before=refreshes;
  // Revoked connections are not silently retried.
  await db.shopConnection.update({where:{id:connectionId},data:{accessExpiresAt:new Date(0),refreshLeaseUntil:null,status:'REAUTH_REQUIRED'}});
  await app.get(Shops).tick();assert.equal(refreshes,before);
  await db.shopConnection.update({where:{id:connectionId},data:{status:'CONNECTED'}});
  await app.get(Shops).tick();assert.equal(refreshes,before+1);
  assert.equal((await db.shopConnection.findUniqueOrThrow({where:{id:connectionId}})).status,'CONNECTED');
  await app.get(Shops).tick();assert.equal(refreshes,before+1);
 });
 await t.test('platform failure and audit logs do not disclose tokens or auth codes',async()=>{
  const cb=await start();const r=await request(`/shopee/callback${cb}&code=rejected&shop_id=123456`);assert.match(r.headers.get('location')!,/failed/);const logs=await(await request('/audit-logs')).text();assert.ok(!logs.includes('fixture-access'));assert.ok(!logs.includes('DO_NOT_EXPOSE'));assert.ok(!logs.includes('rejected'));
 });
 await t.test('shared account reads all shops; sessions stay separate and team management is removed',async()=>{
  await db.user.deleteMany({where:{email:'shared@local.test'}});
  const member=await db.user.create({data:{email:'shared@local.test',passwordHash:passwordHash('shared-test-password'),role:'ADMIN'}});
  const login=()=>fetch(base+'/development/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'shared@local.test',password:'shared-test-password'})});
  const l1=await login(),l2=await login();assert.equal(l1.status,201);assert.equal(l2.status,201);assert.equal(l1.headers.get('set-cookie'),null);
  const {token}=await l1.json() as {token:string};const second=(await l2.json() as {token:string}).token;assert.notEqual(token,second);
  const bearer={Authorization:`Bearer ${token}`};
  const dev=(path:string)=>fetch(base+path,{headers:bearer});
  assert.equal(await db.developmentGrant.count({where:{userId:member.id}}),0);
  const shops=await(await dev('/development/shops')).text();assert.ok(shops.includes(connectionId));assert.ok(!shops.includes('Cipher'));assert.ok(!shops.includes('fixture-access'));
  assert.equal((await request('/team')).status,404);assert.equal((await request('/team','POST',{})).status,404);
  assert.equal((await fetch(base+'/shops',{headers:bearer})).status,401);
  assert.equal((await request('/shops','GET',undefined,{cookie:`yz_session=${token}`})).status,401);
  assert.equal((await dev('/development/shops/not-existing/read/get_item_list')).status,404);
  assert.equal((await dev(`/development/shops/${connectionId}/read/add_item`)).status,400);
  assert.equal((await dev(`/development/shops/${connectionId}/read/get_item_list?access_token=evil`)).status,400);
  assert.equal((await dev(`/development/shops/${connectionId}/read/get_item_list?page_size=101`)).status,400);
  await db.shopConnection.update({where:{id:connectionId},data:{accessExpiresAt:new Date(0),refreshLeaseUntil:null}});const before=refreshes;
  const reads=await Promise.all([dev(`/development/shops/${connectionId}/read/get_item_list`),dev(`/development/shops/${connectionId}/read/get_item_list`)]);assert.deepEqual(reads.map(r=>r.status),[200,200]);assert.equal(refreshes,before+1);assert.equal((await reads[0].json() as {item:unknown[]}).item.length,1);
  const foreign=await fetch(base+'/development/logout',{method:'POST',headers:{...bearer,origin:'https://attacker.test'}});assert.equal(foreign.status,403);
  assert.equal((await fetch(base+'/development/logout',{method:'POST',headers:bearer})).status,201);
  assert.equal((await dev('/development/shops')).status,401);
  assert.equal((await fetch(base+'/development/shops',{headers:{Authorization:`Bearer ${second}`}})).status,200);
  await db.user.update({where:{id:member.id},data:{role:'DISABLED'}});
  assert.equal((await login()).status,401);
  assert.equal((await fetch(base+'/development/shops',{headers:{Authorization:`Bearer ${second}`}})).status,403);
  await db.user.delete({where:{id:member.id}});
 });
 await t.test('logout revokes persisted session' ,async()=>{await request('/auth/logout','POST');assert.equal((await request('/shops')).status,401);});
 }finally{await app.close();provider.close();await once(provider,'close');rmSync(file,{force:true});}
});
