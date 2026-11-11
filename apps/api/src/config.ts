import { Injectable } from '@nestjs/common';
import { readFileSync } from 'node:fs';
export type ShopeeApp = { id: string; name: string; environment: 'live' | 'sandbox'; partnerId: number; partnerKey: string; baseUrl: string };
@Injectable()
export class Config {
  readonly webOrigin = process.env.WEB_ORIGIN || 'http://127.0.0.1:3100';
  readonly publicApi = process.env.PUBLIC_API_ORIGIN || this.webOrigin;
  readonly secureCookie = new URL(this.webOrigin).protocol === 'https:';
  readonly encryptionKey = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY || '', 'base64');
  readonly apps: ShopeeApp[];
  constructor() {
    if (this.encryptionKey.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY must contain 32 random base64-encoded bytes');
    if (process.env.NODE_ENV === 'production' && (!this.secureCookie || !this.publicApi.startsWith('https://'))) throw new Error('Production requires HTTPS');
    const path = process.env.SHOPEE_APPS_FILE;
    const raw: unknown = path ? JSON.parse(readFileSync(path, 'utf8')) : [];
    if (!Array.isArray(raw)) throw new Error('Shopee apps configuration must be an array');
    const ids = new Set();
    this.apps = raw.map((a: ShopeeApp) => {
      if (!a.id || !a.name || !['live','sandbox'].includes(a.environment) || !Number.isSafeInteger(a.partnerId) || a.partnerId <= 0 || !a.partnerKey || ids.has(a.id)) throw new Error('Invalid or duplicate Shopee app configuration');
      ids.add(a.id);
      const baseUrl = a.baseUrl || (a.environment === 'live' ? 'https://partner.shopeemobile.com' : 'https://partner.test-stable.shopeemobile.com');
      const u = new URL(baseUrl);
      const testProvider = process.env.NODE_ENV === 'test' && u.hostname === '127.0.0.1' && u.protocol === 'http:';
      const liveHosts = ['partner.shopeemobile.com', 'partner.shopeemobile.cn'];
      const testHosts = ['partner.test-stable.shopeemobile.com','partner.test-stable.shopeemobile.cn'];
      if (!testProvider && (u.protocol !== 'https:' || !(a.environment === 'live' ? liveHosts : testHosts).includes(u.hostname) || u.port || u.pathname !== '/' || u.search || u.hash || u.username || u.password)) throw new Error('App API host does not match environment');
      return { ...a, baseUrl: u.origin };
    });
  }
  getApp(id: string) { return this.apps.find(a => a.id === id); }
}
