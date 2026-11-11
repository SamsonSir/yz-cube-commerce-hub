import 'reflect-metadata';
import { Module, Controller, Get, Catch, ExceptionFilter, ArgumentsHost, HttpException } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { Config } from './config';
import { Database } from './database';
import { Auth, AdminGuard, AuthController } from './auth';
import { ShopeeClient, PlatformError } from './shopee-client';
import { Shops, ShopsController } from './shops';
import {DevelopmentController,DevelopmentGuard} from './development';
@Controller()
class HealthController { @Get('health') health(){return {ok:true,service:'yz-cube-api'};} }
@Catch()
class ErrorFilter implements ExceptionFilter {
  catch(error:unknown,host:ArgumentsHost){
    const res=host.switchToHttp().getResponse<Response>();
    const status=error instanceof HttpException?error.getStatus():error instanceof PlatformError?502:500;
    const message=error instanceof HttpException?error.message:error instanceof PlatformError?'平台请求未完成，请检查连接状态后重试':'服务暂时不可用';
    res.status(status).json({code:error instanceof PlatformError?error.code:`HTTP_${status}`,message,requestId:res.getHeader('X-Request-Id')});
  }
}
@Module({imports:[ScheduleModule.forRoot()],controllers:[HealthController,AuthController,ShopsController,DevelopmentController],providers:[Config,Database,Auth,AdminGuard,ShopeeClient,Shops,DevelopmentGuard]})
export class AppModule {}
export async function createApp(){
  const app=await NestFactory.create(AppModule,{logger:['error','warn']});
  const config=app.get(Config);
  // Only the loopback reverse proxy is trusted to provide the client IP.
  if(process.env.NODE_ENV==='production')app.getHttpAdapter().getInstance().set('trust proxy','loopback');
  app.use(helmet({contentSecurityPolicy:false}));app.use(cookieParser());
  app.use((req:Request,res:Response,next:NextFunction)=>{
    res.setHeader('X-Request-Id',randomUUID());res.setHeader('Cache-Control','no-store');
    // Cookie-authenticated mutations are accepted only from the first-party UI.
    const serverDevelopment=req.path.startsWith('/api/v1/development/')&&!req.headers.origin&&!req.headers.cookie&&(req.path==='/api/v1/development/login'||typeof req.headers.authorization==='string');
    if(!['GET','HEAD','OPTIONS'].includes(req.method)&&req.headers.origin!==config.webOrigin&&!serverDevelopment){res.status(403).json({message:'请求来源不允许'});return;}
    next();
  });
  app.setGlobalPrefix('api/v1');app.useGlobalFilters(new ErrorFilter());app.enableShutdownHooks();
  return app;
}
