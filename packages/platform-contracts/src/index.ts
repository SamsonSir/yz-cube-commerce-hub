// 领域层多平台连接器契约 (对应《总体架构规划 V0.2》第 5 节)
export type CapabilityState =
  | 'VERIFIED_AVAILABLE'
  | 'PARTIAL_PERMISSION'
  | 'FALLBACK_IMPORT'
  | 'NEEDS_CONFIRMATION'
  | 'RESERVED_V1_1';

export interface UnifiedMoney {
  amount: string; // 定点十进制字符串，禁止浮点数精度丢失
  currency: 'PHP' | 'MYR' | 'THB' | 'SGD' | 'USD' | 'CNY';
}

export interface CommercePlatformAdapter {
  authorize(): Promise<{ shopId: string; expiresAt: string }>;
  refreshAuthorization(shopId: string): Promise<void>;
  syncOrders(shopId: string, cursor?: string): Promise<{ nextCursor?: string; count: number }>;
  syncRefunds(shopId: string, cursor?: string): Promise<{ nextCursor?: string; count: number }>;
  syncListings(shopId: string, cursor?: string): Promise<{ nextCursor?: string; count: number }>;
  // Capability-gated：无权限或采样缺失时返回显式状态，禁止伪造 0
  syncAds?(shopId: string, window: { start: string; end: string }): Promise<{ state: CapabilityState }>;
  syncMarketingCosts?(shopId: string, window: { start: string; end: string }): Promise<{ state: CapabilityState }>;
  // V1.1 预留写操作契约（V1 强制关闭）
  updateStock?(updates: Array<{ shopId: string; platformSkuId: string; stock: 0 }>): Promise<{ accepted: boolean }>;
  updatePrice?(updates: Array<{ shopId: string; platformSkuId: string; price: string }>): Promise<{ accepted: boolean }>;
}
