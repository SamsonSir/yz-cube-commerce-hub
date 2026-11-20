import {api} from './api';

export type PeriodType = 'day' | 'week' | 'month';
export type Period = {type: PeriodType; value: string};

export type Assessment = {score: number; reason: string; evidence: string[]; risks: string[]; confidence: string};
export type ResearchProduct = {
  rank: number;
  productId: string;
  title: string;
  image: string;
  shopName: string;
  price: {min: number; max: number} | null;
  category: string;
  commission: number | null;
  units: number | null;
  growth: number | null;
  revenue: number | null;
  totalUnits: number | null;
  totalRevenue: number | null;
  listedAt: string;
  shopUnits: number | null;
  fastmossUrl: string;
  tiktokUrl: string;
  shopUrl: string;
  status: string;
  assessment?: Assessment;
};
export type ResearchDataset = {id: string; period: Period; total: number; archived?: boolean};
export type ShopProfile = {
  shopId: string; shopName: string; region: string; currency: string; sampled: number;
  categories: {name: string; count: number}[]; brands: string[]; warnings: string[];
};
export type Criteria = {priceMin?: number; priceMax?: number; minGrowth?: number; minCommission?: number};
export type AnalysisRequest = {keyword: string; category: string; requirements: string; shopId?: string; criteria?: Criteria};
export type ResearchAnalysis = {
  id: string;
  status: 'running' | 'complete' | 'partial';
  model: string;
  requirements: string;
  keyword: string;
  category: string;
  shop?: ShopProfile | null;
  criteria?: Criteria;
  excluded?: number;
  createdAt: string;
  total: number;
  scored: number;
  failed: number;
};
type ProductPage = {rows: ResearchProduct[]; categories: string[]; matched: number; total: number; page: number; pageSize: number};
export type ResearchOrigin = {
  draftId: string; datasetId: string; product: ResearchProduct; period: Period;
  copy: 'running' | 'ready' | 'failed' | 'unconfigured'; revision: number;
};

const root = '/localization/selection';
const dataset = (id: string) => root + '/datasets/' + encodeURIComponent(id);
const draft = (id: string) => root + '/drafts/' + encodeURIComponent(id);
const post = (body: unknown) => ({method: 'POST', body: JSON.stringify(body)});

export const selectionApi = {
  datasets: (linkedId?: string) => api<ResearchDataset[]>(root + '/datasets' + (linkedId ? '?' + new URLSearchParams({dataset: linkedId}) : '')),
  products: (id: string, query: URLSearchParams) => api<ProductPage>(dataset(id) + '/products?' + query),
  analyses: (id: string) => api<ResearchAnalysis[]>(dataset(id) + '/analyses'),
  shopProfile: (shopId: string) => api<ShopProfile>(root + '/shops/' + encodeURIComponent(shopId) + '/profile'),
  analyze: (id: string, body: AnalysisRequest) => api<ResearchAnalysis>(dataset(id) + '/analyses', post(body)),
  retry: (id: string) => api<ResearchAnalysis>(root + '/analyses/' + encodeURIComponent(id) + '/retry', post({})),
  follow: (id: string, productId: string, shopId: string) => api<{draftId: string; existing: boolean; reviewPath: string}>(dataset(id) + '/drafts', post({productId, shopId})),
  origin: (id: string) => api<ResearchOrigin>(draft(id) + '/origin'),
  retryCopy: (id: string) => api<ResearchOrigin>(draft(id) + '/copy', post({})),
};

const decimal = new Intl.NumberFormat('en-MY', {maximumFractionDigits: 2});
const currency = new Intl.NumberFormat('en-MY', {style: 'currency', currency: 'MYR'});
export const metric = (value: number | null) => value === null ? '-' : decimal.format(value);
export const money = (value: number | null) => value === null ? '-' : currency.format(value);
export function referencePrice(price: ResearchProduct['price']) {
  if (!price) return '-';
  return price.min === price.max ? money(price.min) : `${money(price.min)}–${money(price.max)}`;
}

const criteriaNames: [keyof Criteria, string, string][] = [['priceMin', '售价 ≥ RM', ''], ['priceMax', '售价 ≤ RM', ''], ['minGrowth', '环比 ≥ ', '%'], ['minCommission', '佣金 ≥ ', '%']];
export const criteriaText = (criteria?: Criteria) =>
  criteriaNames.filter(([key]) => criteria?.[key] !== undefined).map(([key, label, unit]) => label + criteria![key] + unit).join('，');

export const periodNames: Record<PeriodType, string> = {day: '日榜', week: '周榜', month: '月榜'};
function dateAt(value: string) {
  return new Date((value.length === 7 ? value + '-01' : value) + 'T00:00:00Z');
}
function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}
function addDays(date: Date, days: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}
function weekNumber(monday: Date) {
  const thursday = addDays(monday, 3);
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  return Math.floor((thursday.getTime() - yearStart) / (7 * 86400000)) + 1;
}
export function periodLabel(period: Period) {
  if (period.type !== 'week') return period.value;
  const monday = dateAt(period.value);
  return `第 ${weekNumber(monday)} 周 · ${period.value} 至 ${dayKey(addDays(monday, 6))}`;
}
