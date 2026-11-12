import 'reflect-metadata';
import {Module,Controller,Get,Post,Body,Req,Res,Param,Query,UnauthorizedException,HttpException,Catch,ExceptionFilter,ArgumentsHost} from '@nestjs/common';
import {NestFactory} from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import {randomToken} from './crypto';
import {TeamShopClient} from './team-client';
import type {Request,Response,NextFunction} from 'express';
@Controller()
class TeamLocalController {
 constructor(private team:TeamShopClient){}
 @Get('health') health(){return {ok:true,mode:'team-local',managementOrigin:this.team.managementOrigin};}
 @Post('auth/login') async login(@Body() b:{email?:unknown;password?:unknown},@Res({passthrough:true}) res:Response){
  if(typeof b?.email!=='string'||b.email.length>254||typeof b.password!=='string'||b.password.length>256)throw new UnauthorizedException('请输入中台账号');
  const id=randomToken();await this.team.login(b.email,b.password,id);res.cookie('yz_team',id,{httpOnly:true,sameSite:'strict',path:'/',maxAge:28800000});return {ok:true,home:'/developer'};
 }
 @Get('auth/me') me(@Req() r:Request){return this.team.me(r.cookies?.yz_team);}
 @Post('auth/logout') async logout(@Req() r:Request,@Res({passthrough:true}) res:Response){try{await this.team.logout(r.cookies?.yz_team);}finally{res.clearCookie('yz_team',{path:'/'});}return {ok:true};}
 @Get('development/shops') shops(@Req() r:Request){return this.team.shops(r.cookies?.yz_team);}
 @Get('development/shops/:id/read/:operation') read(@Req() r:Request,@Param('id') id:string,@Param('operation') op:string,@Query() q:Record<string,string>){return this.team.read(r.cookies?.yz_team,id,op,q);}
}
@Catch()
class TeamErrors implements ExceptionFilter{catch(e:unknown,h:ArgumentsHost){h.switchToHttp().getResponse<Response>().status(e instanceof HttpException?e.getStatus():502).json({message:e instanceof HttpException?e.message:'无法连接团队服务，请检查网络后重试'});}}
@Module({controllers:[TeamLocalController],providers:[TeamShopClient]})
class TeamLocalModule{}
export async function createTeamApp(){
 const app=await NestFactory.create(TeamLocalModule,{logger:['error','warn']});app.use(helmet({contentSecurityPolicy:false}));app.use(cookieParser());
 app.use((req:Request,res:Response,next:NextFunction)=>{res.setHeader('Cache-Control','no-store');
  // Strict Host and Origin keep loopback credentials away from other browser origins/DNS rebinding.
  if(req.headers.host!==`127.0.0.1:${req.socket.localPort}`||(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.headers.origin!=='http://127.0.0.1:3100')){res.status(403).json({message:'本地请求来源不允许'});return;}next();});
 app.setGlobalPrefix('api/v1');app.useGlobalFilters(new TeamErrors());app.enableShutdownHooks();return app;
}
if(require.main===module)createTeamApp().then(app=>app.listen(4100,'127.0.0.1')).catch(()=>{console.error('本地团队服务启动失败，请检查端口和 TEAM_API_ORIGIN');process.exit(1);});
