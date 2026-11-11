import {Injectable,CanActivate,ExecutionContext,UnauthorizedException,ForbiddenException,BadRequestException,Controller,Get,Post,Body,Req,Param,UseGuards,Query} from '@nestjs/common';
import type {Request} from 'express';
import {Database} from './database';
import {Auth,AuthRequest} from './auth';
import {hash} from './crypto';
import {Shops} from './shops';
@Injectable()
export class DevelopmentGuard implements CanActivate {
 constructor(private db:Database,private auth:Auth){}
 async canActivate(ctx:ExecutionContext){
  const req=ctx.switchToHttp().getRequest<AuthRequest>();
  const token=req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]{20,200})$/)?.[1];
  const s=token?await this.db.session.findUnique({where:{tokenHash:hash(token)},include:{user:true}}):await this.auth.session(req);
  if(!s||s.expiresAt<=new Date()||(token&&s.kind!=='DEV'))throw new UnauthorizedException('请先登录中台');
  if(s.user.role!=='ADMIN')throw new ForbiddenException('账号已停用或不可用');
  req.userId=s.userId;req.sessionId=s.id;return true;
 }
}
@Controller('development')
export class DevelopmentController {
 private rates=new Map<string,{start:number;count:number}>();
 constructor(private db:Database,private auth:Auth,private shops:Shops){}
 @Post('login') async login(@Body() b:{email?:unknown;password?:unknown},@Req() req:Request){
  if(typeof b?.email!=='string'||b.email.length>254||typeof b.password!=='string'||b.password.length>256)throw new UnauthorizedException('请输入中台账号');
  return {token:await this.auth.login(b.email.trim().toLowerCase(),b.password,req.ip||'unknown','DEV'),expiresIn:28800};
 }
 @Get('me') @UseGuards(DevelopmentGuard) async me(@Req() req:AuthRequest){return this.db.user.findUniqueOrThrow({where:{id:req.userId},select:{email:true,role:true}});}
 @Post('logout') @UseGuards(DevelopmentGuard) async logout(@Req() req:AuthRequest){await this.db.session.deleteMany({where:{id:req.sessionId}});return {ok:true};}
 @Get('shops') @UseGuards(DevelopmentGuard) async list(@Req() req:AuthRequest){
  return this.db.shopConnection.findMany({select:{id:true,shopId:true,shopName:true,region:true,status:true},orderBy:{authorizedAt:'desc'}});
 }
 @Get('shops/:id/read/:operation') @UseGuards(DevelopmentGuard)
 async read(@Param('id') id:string,@Param('operation') operation:string,@Query() q:Record<string,unknown>,@Req() req:AuthRequest){
  // Only read methods are exposed. Caller cannot supply a URL, signature or token.
  const allowed:Record<string,string[]>={get_item_list:['offset','page_size','item_status'],get_item_base_info:['item_id_list'],get_model_list:['item_id'],get_category:['language'],get_attribute_tree:['category_id','language'],get_brand_list:['offset','page_size','category_id','status'],get_item_limit:[],get_channel_list:[]};
  if(!Object.hasOwn(allowed,operation))throw new BadRequestException('此接口未开放；写入接口需随工具另行接入');
  const query:Record<string,string>={};
  for(const [k,v] of Object.entries(q)){
   if(!allowed[operation].includes(k)||typeof v!=='string'||v.length>1000)throw new BadRequestException('不支持的查询参数');
   if(['offset','page_size','category_id','item_id'].includes(k)&&(!/^\d{1,15}$/.test(v)||Number(v)>Number.MAX_SAFE_INTEGER))throw new BadRequestException('数字参数无效');
   query[k]=v;
  }
  if(query.page_size&&(Number(query.page_size)<1||Number(query.page_size)>100))throw new BadRequestException('每页需1—100条');
  if(operation==='get_item_list'){
   query.offset||='0';query.page_size||='20';query.item_status||='NORMAL';
   if(!['NORMAL','UNLIST','BANNED','DELETED'].includes(query.item_status))throw new BadRequestException('商品状态无效');
  }
  if(operation==='get_item_base_info'&&(!query.item_id_list||!/^\d{1,15}(,\d{1,15}){0,49}$/.test(query.item_id_list)))throw new BadRequestException('需1—50个商品ID');
  if(operation==='get_model_list'&&!query.item_id)throw new BadRequestException('需要商品ID');
  if(['get_attribute_tree','get_brand_list'].includes(operation)&&!query.category_id)throw new BadRequestException('需要类目ID');
  const now=Date.now(),rate=this.rates.get(req.userId);if(!rate||now-rate.start>60000)this.rates.set(req.userId,{start:now,count:1});else if(++rate.count>60)throw new ForbiddenException('调用过于频繁，请稍后重试');
  if(this.rates.size>10000)for(const [k,v] of this.rates)if(now-v.start>60000)this.rates.delete(k);
  const path=`/api/v2/${operation==='get_channel_list'?'logistics':'product'}/${operation}`;
  try{const result=await this.shops.read(id,req.userId,path,query);await this.shops.audit(req.userId,'DEV_READ',`${id}:${operation}`,'SUCCESS');return result;}
  catch(e){await this.shops.audit(req.userId,'DEV_READ',`${id}:${operation}`,'FAILED');throw e;}
 }
}
