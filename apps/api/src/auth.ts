import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException, Controller, Post, Get, Body, Req, Res, OnModuleInit } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Database } from './database';
import { Config } from './config';
import { hash, randomToken, verifyPassword } from './crypto';
export type AuthRequest = Request & { userId: string; sessionId: string };
@Injectable()
export class Auth implements OnModuleInit {
  private failures = new Map<string, { count: number; until: number }>();
  constructor(private db: Database, private config: Config) {}
  async onModuleInit() {
    const email = process.env.ADMIN_EMAIL, passwordHash = process.env.ADMIN_PASSWORD_HASH;
    if (!email || !passwordHash) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD_HASH');
    await this.db.user.upsert({ where: { email }, create: { email, passwordHash }, update: {} });
  }
  async login(email: string, password: string, ip: string, kind: 'WEB'|'DEV' = 'WEB') {
    const key = hash(ip); const entry = this.failures.get(key);
    if (entry && entry.until > Date.now() && entry.count >= 5) throw new UnauthorizedException('登录尝试过多，请15分钟后重试');
    const user = await this.db.user.findUnique({ where: { email } });
    // Run scrypt on both valid and unknown accounts to avoid a fast account probe.
    const match = verifyPassword(password, user?.passwordHash || process.env.ADMIN_PASSWORD_HASH!);
    if (!user || !match || user.role!=='ADMIN') {
      this.failures.set(key, { count: entry && entry.until > Date.now() ? entry.count + 1 : 1, until: Date.now() + 900000 });
      if (this.failures.size > 10000) for (const [k,v] of this.failures) if (v.until < Date.now()) this.failures.delete(k);
      throw new UnauthorizedException('账号或密码错误');
    }
    this.failures.delete(key);
    const token = randomToken();
    await this.db.session.create({ data: { kind, userId: user.id, tokenHash: hash(token), expiresAt: new Date(Date.now() + 8*3600000) } });
    return token;
  }
  async session(req: Request) {
    const token: unknown = req.cookies?.yz_session;
    if (typeof token !== 'string') return null;
    const s = await this.db.session.findUnique({ where: { tokenHash: hash(token) }, include: { user: true } });
    return s && s.kind==='WEB' && s.user.role==='ADMIN' && s.expiresAt > new Date() ? s : null;
  }
  cookie(res: Response, value: string) { res.cookie('yz_session', value, { httpOnly: true, secure: this.config.secureCookie, sameSite: 'lax', path: '/', maxAge: 8*3600000 }); }
}
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private auth: Auth) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const s = await this.auth.session(req);
    if (!s) throw new UnauthorizedException('请先登录中台');
    if (s.user.role !== 'ADMIN') throw new ForbiddenException('仅管理员可以管理店铺授权');
    req.userId = s.userId; req.sessionId = s.id; return true;
  }
}
@Controller('auth')
export class AuthController {
  constructor(private auth: Auth, private db: Database) {}
  @Post('login') async login(@Body() body: unknown, @Req() req: Request, @Res({passthrough:true}) res: Response) {
    const b = body as Record<string, unknown>;
    if (!b || typeof b.email !== 'string' || typeof b.password !== 'string' || b.email.length > 254 || b.password.length > 256) throw new UnauthorizedException('请输入账号和密码');
    this.auth.cookie(res, await this.auth.login(b.email.toLowerCase().trim(), b.password, req.ip || 'unknown'));
    return { ok: true, home:'/channels/shops' };
  }
  @Get('me') async me(@Req() req: Request) { const s = await this.auth.session(req); if (!s) throw new UnauthorizedException('请先登录'); return { email: s.user.email, role: s.user.role }; }
  @Post('logout') async logout(@Req() req: Request, @Res({passthrough:true}) res: Response) {
    const s = await this.auth.session(req); if(s) await this.db.session.delete({where:{id:s.id}});
    res.clearCookie('yz_session', { path:'/' }); return { ok:true };
  }
}
