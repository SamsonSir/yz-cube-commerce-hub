import {BadRequestException, ConflictException, Injectable, NotFoundException} from '@nestjs/common';
import {randomUUID} from 'node:crypto';
import {join} from 'node:path';
import {LocalizationService} from '../../localization';
import {LocalizationPlatform, type LocalizationContext} from '../../localization-platform';
import type {LocalizationDraft, LocalizationShop, SourceInput} from '../../localization-engine';
import type {ModelConfig} from '../../listing-engine';
import {assessProducts, type Assessment, type Criteria} from './assessment';
import {builtInDatasets, type Dataset} from './built-in';
import type {Product} from './fastmoss';
import type {Period} from './period';
import {fingerprint, SelectionStore, stableId} from './store';
import {productReferenceImages} from './references';
import {readShopProfile, type ShopProfile} from './shop-profile';

type Analysis = {
  id: string;
  datasetId: string;
  createdAt: string;
  model: string;
  modelKey: string;
  requirements: string;
  keyword: string;
  category: string;
  shop?: ShopProfile | null;
  criteria?: Criteria;
  excluded?: number;
  productIds: string[];
  status: 'running' | 'complete' | 'partial';
  results: Record<string, Assessment>;
};

type Origin = {
  draftId: string;
  sourceId: string;
  datasetId: string;
  product: Product;
  period: Period;
  shop: LocalizationShop;
  copy: 'running' | 'ready' | 'failed' | 'unconfigured';
};

const sourceSystem = 'fastmoss-selection';
const batchSize = 8;
const profileLifetime = 10 * 60 * 1000;
const pageSize = 20;
const now = () => new Date().toISOString();

function requireText(value: unknown, length: number, message: string) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > length) throw new BadRequestException(message);
  return value.trim();
}

function optionalText(value: unknown, length: number) {
  return value === undefined || value === '' ? '' : requireText(value, length, '筛选条件无效');
}

function filterRows(rows: Product[], keyword: string, category: string) {
  const needle = keyword.toLocaleLowerCase();
  return rows.filter(row => (!category || (row.category || '未分类') === category)
    && (!needle || [row.title, row.shopName, row.category].some(text => text.toLocaleLowerCase().includes(needle))));
}

function parseCriteria(raw: unknown): Criteria {
  if (raw === undefined || raw === null) return {};
  if (typeof raw !== 'object') throw new BadRequestException('筛选条件无效');
  const criteria: Criteria = {};
  for (const key of ['priceMin', 'priceMax', 'minGrowth', 'minCommission'] as const) {
    const value = (raw as Record<string, unknown>)[key];
    if (value === undefined || value === null || value === '') continue;
    if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1e7 || (key !== 'minGrowth' && value < 0)) {
      throw new BadRequestException('筛选条件无效');
    }
    criteria[key] = value;
  }
  if (criteria.priceMin !== undefined && criteria.priceMax !== undefined && criteria.priceMin > criteria.priceMax) {
    throw new BadRequestException('价格下限不能高于上限');
  }
  return criteria;
}

/** Missing FastMoss values stay in scope: absence is not evidence of failing a rule. */
export function matchesCriteria(row: Product, {priceMin, priceMax, minGrowth, minCommission}: Criteria) {
  return (!row.price || ((priceMin === undefined || row.price.max >= priceMin) && (priceMax === undefined || row.price.min <= priceMax)))
    && (row.growth === null || minGrowth === undefined || row.growth >= minGrowth)
    && (row.commission === null || minCommission === undefined || row.commission >= minCommission);
}

function datasetSummary({rows, digest, ...meta}: Dataset) {
  return {...meta, total: rows.length};
}

function modelKey(config: ModelConfig) {
  return fingerprint([config.baseUrl, config.model, 'selection-v1']);
}

@Injectable()
export class SelectionService {
  private readonly store: SelectionStore;
  private readonly analysisActive = new Set<string>();
  private readonly copyActive = new Set<string>();
  private readonly profiles = new Map<string, {expires: number; value: Promise<ShopProfile>}>();

  constructor(private readonly localization: LocalizationService, private readonly platform: LocalizationPlatform) {
    this.store = new SelectionStore(join(localization.engine.dir, 'selection'));
  }

  async datasets(owner: string, linkedId: unknown) {
    const datasets = await builtInDatasets();
    const summaries = datasets.map(datasetSummary);
    if (typeof linkedId === 'string' && !datasets.some(dataset => dataset.id === linkedId)) {
      const legacy = this.store.read<Dataset>(owner, 'datasets', linkedId);
      if (legacy) return [...summaries, {...datasetSummary(legacy), archived: true}];
    }
    return summaries;
  }

  private async dataset(owner: string, id: string) {
    const dataset = (await builtInDatasets()).find(entry => entry.id === id)
      ?? this.store.read<Dataset>(owner, 'datasets', id);
    if (!dataset) throw new NotFoundException('榜单不存在');
    return dataset;
  }

  async products(owner: string, id: string, query: Record<string, unknown>) {
    const dataset = await this.dataset(owner, id);
    const keyword = optionalText(query.keyword, 200), category = optionalText(query.category, 200);
    const job = query.analysisId ? this.analysis(owner, requireText(query.analysisId, 36, '分析任务无效')) : undefined;
    if (job && job.datasetId !== id) throw new BadRequestException('分析任务不属于当前榜单');
    const byId = job?.results ?? {};
    const categories = [...new Set(dataset.rows.map(row => row.category || '未分类'))].sort((a, b) => a.localeCompare(b, 'zh-CN'));
    const rows = filterRows(dataset.rows, keyword, category);
    const visible = query.recommended === 'true' ? rows.filter(row => (byId[row.productId]?.score ?? -1) >= 70) : rows;
    const orderValue = (row: Product) => {
      switch (query.sort) {
        case 'units': return row.units;
        case 'growth': return row.growth;
        case 'revenue': return row.revenue;
        case 'totalUnits': return row.totalUnits;
        case 'score': return byId[row.productId]?.score;
        default: return -row.rank;
      }
    };
    visible.sort((a, b) => {
      const first = orderValue(a) ?? -Infinity, second = orderValue(b) ?? -Infinity;
      return first === second ? a.rank - b.rank : first < second ? 1 : -1;
    });
    const requestedPage = Number(query.page);
    const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, Math.max(1, Math.ceil(visible.length / pageSize))) : 1;
    return {
      categories, page, pageSize, total: visible.length, matched: rows.length,
      rows: visible.slice((page - 1) * pageSize, page * pageSize).map(row => ({...row, assessment: byId[row.productId]})),
    };
  }

  private analysis(owner: string, id: string) {
    const job = this.store.read<Analysis>(owner, 'analyses', id);
    if (!job) throw new NotFoundException('分析任务不存在');
    return job;
  }

  private analysisView(owner: string, job: Analysis) {
    const {results, productIds, modelKey: key, ...summary} = job;
    const scoreCount = Object.keys(results).length;
    const status = job.status === 'running' && !this.analysisActive.has(owner) ? 'partial' : job.status;
    return {...summary, status, total: productIds.length, scored: scoreCount, failed: status === 'partial' ? productIds.length - scoreCount : 0};
  }

  async analyses(owner: string, datasetId: string) {
    await this.dataset(owner, datasetId);
    return this.store.list<Analysis>(owner, 'analyses').filter(job => job.datasetId === datasetId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(job => this.analysisView(owner, job));
  }

  async shopProfile(ctx: LocalizationContext, shopId: string) {
    const shop = (await this.platform.shops(ctx)).find(s => s.id === shopId && s.status === 'CONNECTED' && s.currency);
    if (!shop) throw new BadRequestException('请选择已连接的 Shopee 店铺');
    const key = JSON.stringify([ctx.owner, shopId]);
    const cached = this.profiles.get(key);
    if (cached && cached.expires > Date.now()) return cached.value;
    if (this.profiles.size >= 100) this.profiles.delete(this.profiles.keys().next().value!);
    const value = readShopProfile(this.platform, ctx, shop);
    this.profiles.set(key, {expires: Date.now() + profileLifetime, value});
    value.catch(() => this.profiles.delete(key));
    return value;
  }

  async analyze(ctx: LocalizationContext, datasetId: string, raw: unknown) {
    const owner = ctx.owner;
    if (this.analysisActive.has(owner)) throw new ConflictException('已有选品分析正在运行，请等待完成');
    const input = raw as {requirements?: unknown; keyword?: unknown; category?: unknown; shopId?: unknown; criteria?: unknown} | null;
    const dataset = await this.dataset(owner, datasetId);
    const shopId = input?.shopId === undefined || input.shopId === '' ? '' : requireText(input.shopId, 150, '请选择目标店铺');
    const requirements = shopId && (input?.requirements === undefined || input.requirements === '') ? ''
      : requireText(input?.requirements, 2000, '请填写选品要求，最多 2,000 字');
    const keyword = optionalText(input?.keyword, 200), category = optionalText(input?.category, 200);
    const criteria = parseCriteria(input?.criteria);
    const scoped = filterRows(dataset.rows, keyword, category);
    if (!scoped.length) throw new BadRequestException('当前筛选范围没有商品');
    const rows = scoped.filter(row => matchesCriteria(row, criteria));
    if (!rows.length) throw new BadRequestException('没有商品满足价格、环比或佣金条件，请放宽条件');
    const config = this.localization.content.planner();
    const shop = shopId ? await this.shopProfile(ctx, shopId) : null;
    if (this.analysisActive.has(owner)) throw new ConflictException('已有选品分析正在运行，请等待完成');
    const job: Analysis = {
      id: randomUUID(), datasetId, createdAt: now(), model: config.model, modelKey: modelKey(config),
      requirements, keyword, category, shop, criteria, excluded: scoped.length - rows.length, productIds: rows.map(row => row.productId), status: 'running', results: {},
    };
    this.runAnalysis(owner, job, dataset, config);
    return this.analysisView(owner, job);
  }

  async retryAnalysis(owner: string, id: string) {
    let job = this.analysis(owner, id);
    if (job.status === 'complete') return this.analysisView(owner, job);
    const dataset = await this.dataset(owner, job.datasetId);
    job = this.analysis(owner, id);
    if (job.status === 'complete') return this.analysisView(owner, job);
    if (this.analysisActive.has(owner)) throw new ConflictException('已有选品分析正在运行，请等待完成');
    const config = this.localization.content.planner();
    if (job.modelKey !== modelKey(config)) throw new ConflictException('文本模型已变更，请开始新一轮分析');
    job.status = 'running';
    this.runAnalysis(owner, job, dataset, config);
    return this.analysisView(owner, job);
  }

  private runAnalysis(owner: string, job: Analysis, dataset: Dataset, config: ModelConfig) {
    this.store.write(owner, 'analyses', job.id, job);
    this.analysisActive.add(owner);
    void (async () => {
      const ids = new Set(job.productIds.filter(id => !job.results[id]));
      const pending = dataset.rows.filter(row => ids.has(row.productId));
      let consecutiveFailures = 0;
      for (let index = 0; index < pending.length; index += batchSize) {
        try {
          const results = await assessProducts(config, {requirements: job.requirements, shop: job.shop, criteria: job.criteria}, dataset.period, pending.slice(index, index + batchSize));
          for (const result of results) job.results[result.productId] = result;
          consecutiveFailures = 0;
        } catch {
          consecutiveFailures++;
        }
        this.store.write(owner, 'analyses', job.id, job);
        // A persistent provider failure should leave the remaining rows available for a deliberate retry.
        if (consecutiveFailures >= 3) break;
      }
      job.status = Object.keys(job.results).length === job.productIds.length ? 'complete' : 'partial';
      this.store.write(owner, 'analyses', job.id, job);
    })().catch(() => { /* The persisted checkpoint becomes retryable once the worker stops. */ })
      .finally(() => this.analysisActive.delete(owner));
  }

  async follow(ctx: LocalizationContext, datasetId: string, raw: unknown) {
    const input = raw as {productId?: unknown; shopId?: unknown} | null;
    const productId = requireText(input?.productId, 64, '请选择榜单商品');
    const shopId = requireText(input?.shopId, 150, '请选择目标店铺');
    const dataset = await this.dataset(ctx.owner, datasetId);
    const product = dataset.rows.find(row => row.productId === productId);
    if (!product) throw new NotFoundException('榜单商品不存在');
    const draftId = stableId([sourceSystem, ctx.owner, productId, shopId]);
    let origin = this.store.read<Origin>(ctx.owner, 'origins', draftId);
    if (origin) {
      this.materialize(ctx.owner, origin);
      return this.followResult(origin, true);
    }
    const shop = (await this.platform.shops(ctx)).find(s => s.id === shopId && s.status === 'CONNECTED' && s.language && s.currency);
    if (!shop) throw new BadRequestException('请选择已连接且支持本地化的 Shopee 店铺');
    // Re-read after the platform lookup so concurrent browser requests share the first snapshot.
    origin = this.store.read<Origin>(ctx.owner, 'origins', draftId);
    if (origin) {
      this.materialize(ctx.owner, origin);
      return this.followResult(origin, true);
    }
    origin = {draftId, sourceId: stableId([sourceSystem, draftId]), datasetId, product, period: dataset.period, shop, copy: 'failed'};
    this.store.write(ctx.owner, 'origins', draftId, origin);
    const draft = this.materialize(ctx.owner, origin);
    this.generateCopy(ctx.owner, origin, draft);
    return this.followResult(origin, false);
  }

  private followResult(origin: Origin, existing: boolean) {
    return {draftId: origin.draftId, existing, reviewPath: '/tools/localization?selection=1&draft=' + origin.draftId};
  }

  private materialize(owner: string, origin: Origin) {
    const row = origin.product;
    const input: SourceInput = {
      schemaVersion: 1, sourceSystem, sourceProductId: row.productId, title: row.title, description: '',
      images: productReferenceImages(row), parameters: row.category ? {'类目': row.category} : {}, specificationNames: [],
      variants: [{sku: 'FM-' + row.productId, options: []}],
    };
    const engine = this.localization.engine;
    // Older snapshots intentionally stored no images. Do not rewrite immutable sources
    // or infer that an empty draft gallery has not been deliberately edited.
    try { engine.getSource(owner, origin.sourceId); } catch (error) {
      if (!(error instanceof NotFoundException)) throw error;
      engine.ensureImportedSource(owner, input, origin.sourceId);
    }
    return engine.ensureImportedDraft(owner, origin.sourceId, origin.shop, origin.shop.language, origin.draftId);
  }

  private readOrigin(owner: string, id: string) {
    const origin = this.store.read<Origin>(owner, 'origins', id);
    if (!origin) throw new NotFoundException('跟卖来源不存在');
    if (origin.copy === 'running' && !this.copyActive.has(id)) {
      origin.copy = 'failed';
      this.store.write(owner, 'origins', id, origin);
    }
    return origin;
  }

  origin(owner: string, id: string) {
    const {shop, ...origin} = this.readOrigin(owner, id);
    const draft = this.localization.engine.getDraft(owner, id);
    return {...origin, revision: draft.revision, referenceImages: productReferenceImages(origin.product),
      canApplyReferenceImages: !this.localization.engine.listTasks(owner).some(task => task.draftId === id && (task.status !== 'failed' || task.remoteId))};
  }

  retryCopy(owner: string, id: string) {
    const origin = this.readOrigin(owner, id);
    const engine = this.localization.engine;
    if (engine.listTasks(owner).some(task => task.draftId === id && (task.status !== 'failed' || task.remoteId))) {
      throw new ConflictException('草稿已有发布任务，请先核对发布结果');
    }
    if (origin.copy !== 'running') this.generateCopy(owner, origin, engine.getDraft(owner, id));
    return this.origin(owner, id);
  }

  private generateCopy(owner: string, origin: Origin, draft: LocalizationDraft) {
    try {
      this.localization.content.planner();
    } catch {
      origin.copy = 'unconfigured';
      this.store.write(owner, 'origins', origin.draftId, origin);
      return;
    }
    origin.copy = 'running';
    this.store.write(owner, 'origins', origin.draftId, origin);
    this.copyActive.add(origin.draftId);
    void (async () => {
      try {
        const engine = this.localization.engine;
        const patch = await this.localization.content.selectionCopy(engine.getSource(owner, draft.sourceId), draft);
        engine.updateDraft(owner, draft.id, patch, draft.revision);
        origin.copy = 'ready';
      } catch {
        origin.copy = 'failed';
      }
      this.store.write(owner, 'origins', origin.draftId, origin);
    })().catch(() => { /* The saved draft remains available even if the checkpoint cannot be written. */ })
      .finally(() => this.copyActive.delete(origin.draftId));
  }
}
