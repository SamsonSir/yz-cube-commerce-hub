import {Injectable,UnauthorizedException} from '@nestjs/common';
/** Local tool modules inject this service; the browser never receives the remote bearer. */
@Injectable()
export class TeamShopClient {
 private sessions=new Map<string,{token:string;expiresAt:number}>();
 private origin=process.env.TEAM_API_ORIGIN||'https://commerce.aicbec.cn';
 constructor(){const u=new URL(this.origin);if(u.protocol!=='https:'&&!(process.env.NODE_ENV==='test'&&u.hostname==='127.0.0.1'))throw Error('Team API requires HTTPS');if(u.username||u.password||u.search||u.hash||u.pathname!=='/')throw Error('Team API must be an origin');this.origin=u.origin;}
 get managementOrigin(){return this.origin;}
 async request(path:string,token?:string,body?:unknown){
  const res=await fetch(`${this.origin}/api/v1/development${path}`,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(25000),redirect:'error'});
  const data=await res.json();if(!res.ok){const {HttpException}=await import('@nestjs/common');throw new HttpException({message:data.message||'团队服务请求失败'},res.status);}return data;
 }
 async login(email:string,password:string,id:string){
  const r=await this.request('/login',undefined,{email,password});
  for(const [k,v] of this.sessions)if(v.expiresAt<Date.now())this.sessions.delete(k);
  if(this.sessions.size>=100)throw new UnauthorizedException('本地会话过多，请重启开发服务');
  this.sessions.set(id,{token:r.token,expiresAt:Date.now()+r.expiresIn*1000});
 }
 private token(id:string){const s=this.sessions.get(id);if(!s||s.expiresAt<Date.now()){this.sessions.delete(id);throw new UnauthorizedException('请重新登录中台账号');}return s.token;}
 me(id:string){return this.request('/me',this.token(id));}
 shops(id:string){return this.request('/shops',this.token(id));}
 read(id:string,connectionId:string,operation:string,query:Record<string,string>={}){return this.request(`/shops/${encodeURIComponent(connectionId)}/read/${encodeURIComponent(operation)}?${new URLSearchParams(query)}`,this.token(id));}
 async logout(id:string){try{await this.request('/logout',this.token(id),{});}finally{this.sessions.delete(id);}}
}
