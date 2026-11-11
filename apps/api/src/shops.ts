import { Injectable, Controller, Get, Post, Param, Body, Req, Res, Query, UseGuards, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { Response } from 'express';
import { Database } from './database';
import { Config } from './config';
import { AdminGuard, Auth, AuthRequest } from './auth';
import { hash, randomToken, encrypt, decrypt } from './crypto';
import { ShopeeClient, PlatformError } from './shopee-client';
const safeSelect = { id:true,appId:true,environment:true,shopId:true,shopName:true,region:true,status:true,accessExpiresAt:true,authorizedAt:true,verifiedAt:true,refreshedAt:true,lastError:true,updatedAt:true } as const;
@Injectable()
export class Shops {
  constructor(private db: Database,private config: Config,private client: ShopeeClient) {}
  async audit(actorId:string,action:string,target:string,result:string) {await this.db.auditLog.create({data:{actorId,action,target,result}});}
  list() {return this.db.shopConnection.findMany({select:safeSelect,orderBy:{authorizedAt:'desc'}});}
  apps() {return this.config.apps.map(({id,name,environment})=>({id,name,environment}));}
  async start(appId:string,req:AuthRequest) {
    const app=this.config.getApp(appId);if(!app)throw new BadRequestException('请选择已配置的App');
    const state=randomToken();
    await this.db.authorizationAttempt.create({data:{stateHash:hash(state),sessionId:req.sessionId,appId,partnerId:String(app.partnerId),environment:app.environment,expiresAt:new Date(Date.now()+600000)}});
    const redirect=new URL('/api/v1/shopee/callback',this.config.publicApi);redirect.searchParams.set('state',state);
    await this.audit(req.userId,'AUTH_START',appId,'PENDING');
    return {url:this.client.authorizationUrl(app,redirect.toString()),expiresIn:600};
  }
  async callback(query:Record<string,unknown>,req:AuthRequest) {
    if(typeof query.state!=='string'||query.state.length>100)throw new BadRequestException('授权请求无效');
    const attempt=await this.db.authorizationAttempt.findUnique({where:{stateHash:hash(query.state)}});
    if(!attempt||attempt.sessionId!==req.sessionId||attempt.expiresAt<=new Date()||attempt.usedAt)throw new BadRequestException('授权请求已过期、已使用或不是当前登录会话发起');
    if(typeof query.code!=='string'||!query.code||query.code.length>512||typeof query.shop_id!=='string'||!/^\d{1,15}$/.test(query.shop_id)||!Number.isSafeInteger(Number(query.shop_id))||Number(query.shop_id)<=0)throw new BadRequestException('缺少有效店铺授权结果，请重新授权');
    const app=this.config.getApp(attempt.appId);if(!app||String(app.partnerId)!==attempt.partnerId||app.environment!==attempt.environment)throw new BadRequestException('App配置已变更，请重新发起授权');
    const claimed=await this.db.authorizationAttempt.updateMany({where:{id:attempt.id,usedAt:null,expiresAt:{gt:new Date()}},data:{usedAt:new Date(),result:'EXCHANGING'}});
    if(claimed.count!==1)throw new BadRequestException('授权回调已处理');
    try {
      const token=await this.client.exchange(app,query.code,query.shop_id);
      if(token.shop_id_list&&!token.shop_id_list.includes(Number(query.shop_id)))throw new PlatformError('INVALID_RESPONSE');
      const data={partnerId:String(app.partnerId),environment:app.environment,accessTokenCipher:encrypt(token.access_token,this.config.encryptionKey),refreshTokenCipher:encrypt(token.refresh_token,this.config.encryptionKey),accessExpiresAt:new Date(Date.now()+token.expire_in*1000),status:'VERIFY_PENDING',lastError:null,verifiedAt:null,refreshLeaseUntil:null};
      const connection=await this.db.shopConnection.upsert({where:{appId_shopId:{appId:app.id,shopId:query.shop_id}},create:{...data,appId:app.id,shopId:query.shop_id},update:{...data,authorizedAt:new Date(),tokenVersion:{increment:1}}});
      await this.db.authorizationAttempt.update({where:{id:attempt.id},data:{result:'TOKEN_SAVED'}});
      await this.verify(connection.id,req.userId);
      await this.audit(req.userId,'AUTH_COMPLETE',connection.id,'TOKEN_SAVED');
      return connection.id;
    }catch(e) {
      await this.db.authorizationAttempt.update({where:{id:attempt.id},data:{result:'FAILED'}});
      await this.audit(req.userId,'AUTH_COMPLETE',app.id,e instanceof PlatformError?e.code:'INTERNAL_ERROR');throw e;
    }
  }
  async verify(id:string,actor:string) {
    const c=await this.db.shopConnection.findUnique({where:{id}});if(!c)throw new NotFoundException('店铺连接不存在');
    const app=this.config.getApp(c.appId);if(!app||app.environment!==c.environment||String(app.partnerId)!==c.partnerId)throw new BadRequestException('App配置缺失或身份不匹配，请恢复配置或重新授权');
    try {
      const info=await this.client.shop(app,decrypt(c.accessTokenCipher,this.config.encryptionKey),c.shopId);
      await this.db.shopConnection.updateMany({where:{id,tokenVersion:c.tokenVersion},data:{...info,status:'CONNECTED',verifiedAt:new Date(),lastError:null}});
      await this.audit(actor,'SHOP_VERIFY',id,'SUCCESS');
      return {ok:true};
    }catch(e) {
      const error=e instanceof PlatformError?e.code:'INTERNAL_ERROR';
      await this.db.shopConnection.updateMany({where:{id,tokenVersion:c.tokenVersion},data:{status:'VERIFY_FAILED',lastError:error}});
      await this.audit(actor,'SHOP_VERIFY',id,error);
      return {ok:false,error};
    }
  }
  async refresh(id:string,actor:string) {
    const c=await this.db.shopConnection.findUnique({where:{id}});if(!c)throw new NotFoundException('店铺连接不存在');
    const app=this.config.getApp(c.appId);if(!app||app.environment!==c.environment||String(app.partnerId)!==c.partnerId)throw new BadRequestException('App配置缺失或身份不匹配，请恢复配置或重新授权');
    const claim=await this.db.shopConnection.updateMany({where:{id,tokenVersion:c.tokenVersion,OR:[{refreshLeaseUntil:null},{refreshLeaseUntil:{lt:new Date()}}]},data:{refreshLeaseUntil:new Date(Date.now()+60000)}});
    if(claim.count!==1)throw new ConflictException('当前正在续期，请稍后刷新');
    try {
      const token=await this.client.refresh(app,decrypt(c.refreshTokenCipher,this.config.encryptionKey),c.shopId);
      await this.db.shopConnection.updateMany({where:{id,tokenVersion:c.tokenVersion},data:{accessTokenCipher:encrypt(token.access_token,this.config.encryptionKey),refreshTokenCipher:encrypt(token.refresh_token,this.config.encryptionKey),accessExpiresAt:new Date(Date.now()+token.expire_in*1000),refreshedAt:new Date(),refreshLeaseUntil:null,tokenVersion:{increment:1},lastError:null,status:'VERIFY_PENDING'}});
      await this.audit(actor,'TOKEN_REFRESH',id,'SUCCESS');const verified=await this.verify(id,actor);return {...verified,tokenRefreshed:true};
    }catch(e) {
      const error=e instanceof PlatformError?e.code:'INTERNAL_ERROR';
      await this.db.shopConnection.updateMany({where:{id,tokenVersion:c.tokenVersion},data:{status:error==='TOKEN_INVALID'?'REAUTH_REQUIRED':'RETRY_PENDING',lastError:error,refreshLeaseUntil:new Date(Date.now()+60000)}});
      await this.audit(actor,'TOKEN_REFRESH',id,error);return {ok:false,error};
    }
  }
  async read(id:string,actor:string,path:string,query:Record<string,string>) {
    let c=await this.db.shopConnection.findUnique({where:{id}});
    if(!c)throw new NotFoundException('店铺连接不存在');
    if(c.status==='REAUTH_REQUIRED')throw new ConflictException('店铺需要管理员重新授权');
    if(c.accessExpiresAt.getTime()<Date.now()+60000){
      try{const r=await this.refresh(id,actor);if(!r.ok)throw new ConflictException('店铺续期未完成');}
      catch(e){if(!(e instanceof ConflictException))throw e;
        // A different request/scheduler may hold the shared renewal lease.
        for(let i=0;i<20;i++) {await new Promise(r=>setTimeout(r,250));const fresh=await this.db.shopConnection.findUniqueOrThrow({where:{id}});if(fresh.tokenVersion!==c.tokenVersion){c=fresh;break;}}
      }
      c=await this.db.shopConnection.findUniqueOrThrow({where:{id}});
      if(c.accessExpiresAt.getTime()<Date.now()+30000)throw new ConflictException('店铺正在续期，请稍后重试');
    }
    const app=this.config.getApp(c.appId);
    if(!app||app.environment!==c.environment||String(app.partnerId)!==c.partnerId)throw new BadRequestException('App配置身份不匹配');
    return this.client.read(app,path,decrypt(c.accessTokenCipher,this.config.encryptionKey),c.shopId,query);
  }
  @Interval(60000)
  async tick() {
    const due=await this.db.shopConnection.findMany({where:{status:{not:'REAUTH_REQUIRED'},accessExpiresAt:{lt:new Date(Date.now()+15*60000)},OR:[{refreshLeaseUntil:null},{refreshLeaseUntil:{lt:new Date()}}]},select:{id:true},take:20});
    for(const c of due)try{await this.refresh(c.id,'SYSTEM');}catch{/* Next tick retries; tokens and status retained. */}
    await this.db.session.deleteMany({where:{expiresAt:{lt:new Date()}}});
    await this.db.authorizationAttempt.deleteMany({where:{expiresAt:{lt:new Date(Date.now()-86400000)}}});
  }
}
@Controller()
export class ShopsController {
  constructor(private shops:Shops,private auth:Auth,private config:Config,private db:Database) {}
  @Get('shopee/apps') @UseGuards(AdminGuard) apps() {return this.shops.apps();}
  @Get('shops') @UseGuards(AdminGuard) list() {return this.shops.list();}
  @Post('shopee/authorize') @UseGuards(AdminGuard) authorize(@Body() body:{appId?:unknown},@Req() req:AuthRequest) {if(typeof body?.appId!=='string')throw new BadRequestException('请选择App');return this.shops.start(body.appId,req);}
  @Get('shopee/callback') async callback(@Query() query:Record<string,unknown>,@Req() req:AuthRequest,@Res() res:Response) {
    res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
    try {
      const session=await this.auth.session(req);if(!session||session.user.role!=='ADMIN')throw new BadRequestException('请在发起授权的浏览器保持登录');
      req.userId=session.userId;req.sessionId=session.id;
      await this.shops.callback(query,req);
      res.redirect(303,`${this.config.webOrigin}/channels/shops?authorization=saved`);
    }catch {res.redirect(303,`${this.config.webOrigin}/channels/shops?authorization=failed`);}
  }
  @Post('shops/:id/verify') @UseGuards(AdminGuard) verify(@Param('id') id:string,@Req() req:AuthRequest){return this.shops.verify(id,req.userId);}
  @Post('shops/:id/refresh') @UseGuards(AdminGuard) refresh(@Param('id') id:string,@Req() req:AuthRequest){return this.shops.refresh(id,req.userId);}
  @Get('audit-logs') @UseGuards(AdminGuard) logs(){return this.db.auditLog.findMany({take:50,orderBy:{createdAt:'desc'}});}
}
