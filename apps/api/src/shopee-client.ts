import { Injectable } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import type { ShopeeApp } from './config';
export class PlatformError extends Error {
  constructor(public readonly code: 'TOKEN_INVALID' | 'PERMISSION_DENIED' | 'PLATFORM_UNAVAILABLE' | 'INVALID_RESPONSE') { super(code); }
}
export function signature(app: ShopeeApp, path: string, timestamp: number, accessToken = '', shopId = '') {
  return createHmac('sha256', app.partnerKey).update(`${app.partnerId}${path}${timestamp}${accessToken}${shopId}`).digest('hex');
}
export type Tokens = { access_token: string; refresh_token: string; expire_in: number; shop_id_list?: number[] };
@Injectable()
export class ShopeeClient {
  authorizationUrl(app: ShopeeApp, redirect: string) {
    const path='/api/v2/shop/auth_partner', ts=Math.floor(Date.now()/1000), u=new URL(path,app.baseUrl);
    u.search=new URLSearchParams({partner_id:String(app.partnerId),timestamp:String(ts),sign:signature(app,path,ts),redirect}).toString();return u.toString();
  }
  private async request(app: ShopeeApp, path: string, body?: object, token='', shopId='', query:Record<string,string>={}) {
    const ts=Math.floor(Date.now()/1000),u=new URL(path,app.baseUrl);
    u.search=new URLSearchParams({...query,partner_id:String(app.partnerId),timestamp:String(ts),sign:signature(app,path,ts,token,shopId),...(token?{access_token:token,shop_id:shopId}:{})}).toString();
    let response: Response;
    try {response=await fetch(u,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000),redirect:'error'});} catch {throw new PlatformError('PLATFORM_UNAVAILABLE');}
    let data: Record<string,unknown>;
    try {data=await response.json() as Record<string,unknown>;}catch{throw new PlatformError('INVALID_RESPONSE');}
    if(!response.ok) throw new PlatformError('PLATFORM_UNAVAILABLE');
    if(data.error) {
      const code=String(data.error).toLowerCase();
      if(/token|auth|code|shop_not_authorized/.test(code))throw new PlatformError('TOKEN_INVALID');
      if(/permission|scope|access_denied/.test(code))throw new PlatformError('PERMISSION_DENIED');
      throw new PlatformError('PLATFORM_UNAVAILABLE');
    }
    return data;
  }
  async read(app:ShopeeApp,path:string,token:string,shopId:string,query:Record<string,string>) {
    const data=await this.request(app,path,undefined,token,shopId,query);
    if(!data.response || typeof data.response!=='object')throw new PlatformError('INVALID_RESPONSE');
    return data.response;
  }
  private tokens(data: Record<string,unknown>): Tokens {
    if(typeof data.access_token!=='string'||!data.access_token||typeof data.refresh_token!=='string'||!data.refresh_token||typeof data.expire_in!=='number'||!Number.isFinite(data.expire_in)||data.expire_in<=0)throw new PlatformError('INVALID_RESPONSE');
    return data as Tokens;
  }
  async exchange(app: ShopeeApp, code: string, shopId: string) {return this.tokens(await this.request(app,'/api/v2/auth/token/get',{partner_id:app.partnerId,code,shop_id:Number(shopId)}));}
  async refresh(app: ShopeeApp, token: string, shopId: string) {return this.tokens(await this.request(app,'/api/v2/auth/access_token/get',{partner_id:app.partnerId,refresh_token:token,shop_id:Number(shopId)}));}
  async shop(app: ShopeeApp, token: string, shopId: string) {
    const d=await this.request(app,'/api/v2/shop/get_shop_info',undefined,token,shopId);
    if(typeof d.shop_name!=='string'||typeof d.region!=='string')throw new PlatformError('INVALID_RESPONSE');
    return {shopName:d.shop_name,region:d.region};
  }
}
