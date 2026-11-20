'use client';

import {useDeferredValue, useEffect, useState} from 'react';
import {Dialog} from '@/components/dialog';
import {ProductImage} from '@/components/product-image';
import {Shell} from '@/components/shell';
import {Button} from '@/components/ui/button';
import {api, errorMessage} from '@/lib/api';
import {localizationApi, marketNames, type MarketShop} from '@/lib/localization';
import {criteriaText, metric, money, periodLabel, periodNames, referencePrice, selectionApi,
  type AnalysisRequest, type Criteria, type ResearchAnalysis, type ShopProfile, type ResearchDataset, type ResearchProduct} from '@/lib/selection';
import styles from './selection.module.css';

const shortDate = new Intl.DateTimeFormat('zh-CN', {dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Kuala_Lumpur'});
const percent = (value: number | null) => value === null ? '-' : metric(value) + '%';

function ProductDetails({row, onClose}: {row: ResearchProduct; onClose: () => void}) {
  const data = [
    ['店铺', row.shopName], ['类目', row.category], ['参考价', referencePrice(row.price)], ['商品状态', row.status],
    ['销量', metric(row.units)], ['销量环比', percent(row.growth)], ['销售额', money(row.revenue)],
    ['总销量', metric(row.totalUnits)], ['总销售额', money(row.totalRevenue)], ['佣金比例', percent(row.commission)],
    ['店铺总销量', metric(row.shopUnits)], ['预估上架时间', row.listedAt], ['商品 ID', row.productId],
  ];
  return <Dialog title="榜单商品详情" onClose={onClose}>
    <div className={styles.productDetail}>
      <ProductImage src={row.image} alt="榜单参考图" className={styles.detailImage}/>
      <div>
        <h3>{row.title}</h3>
        <dl className={styles.facts}>{data.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '-'}</dd></div>)}</dl>
        <div className={styles.links}>
          {[[row.fastmossUrl, 'FastMoss 商品'], [row.tiktokUrl, 'TikTok 商品'], [row.shopUrl, 'FastMoss 店铺']].map(([href, label]) =>
            href && <a href={href} key={label} target="_blank" rel="noreferrer">{label} ↗</a>)}
        </div>
      </div>
    </div>
    {row.assessment && <div className={styles.assessment}>
      <h3>AI 评分 {row.assessment.score} 分 · {row.assessment.confidence}置信度</h3>
      <p>{row.assessment.reason}</p>
      {row.assessment.evidence.length > 0 && <><strong>数据依据</strong><ul>{row.assessment.evidence.map((item, i) => <li key={i}>{item}</li>)}</ul></>}
      {row.assessment.risks.length > 0 && <><strong>风险与缺项</strong><ul>{row.assessment.risks.map((item, i) => <li key={i}>{item}</li>)}</ul></>}
    </div>}
  </Dialog>;
}

function FollowDialog({row, datasetId, defaultShopId, onClose}: {row: ResearchProduct; datasetId: string; defaultShopId?: string; onClose: () => void}) {
  const [shops, setShops] = useState<MarketShop[]>();
  const [shopId, setShopId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let current = true;
    void localizationApi.shops().then(items => {
      if (!current) return;
      const eligible = items.filter(shop => shop.status === 'CONNECTED' && shop.currency && shop.language);
      setShops(eligible);
      const preferred = eligible.find(shop => shop.id === defaultShopId) ?? (eligible.length === 1 ? eligible[0] : undefined);
      if (preferred) setShopId(preferred.id);
    }).catch(error => { if (current) {setError(errorMessage(error)); setShops([]);} });
    return () => {current = false;};
  }, [defaultShopId]);

  return <Dialog title="一键跟卖" onClose={() => { if (!busy) onClose(); }}>
    <form className={styles.dialogBody} onSubmit={async event => {
      event.preventDefault();
      if (!shopId || busy) return;
      setBusy(true);
      setError('');
      try {
        const result = await selectionApi.follow(datasetId, row.productId, shopId);
        window.location.assign(result.reviewPath);
      } catch (error) {setError(errorMessage(error)); setBusy(false);}
    }}>
      <div className={styles.followProduct}>
        <ProductImage src={row.image} alt="榜单参考图" className={styles.thumbnail}/>
        <div><strong>{row.title}</strong><p className="muted">马来西亚榜单参考价 {referencePrice(row.price)}</p></div>
      </div>
      {error && <p className="message error" role="alert">{error}</p>}
      {!shops ? <p role="status">正在读取已连接店铺…</p> : shops.length ? <label className={styles.field}>
        <span>目标 Shopee 店铺</span>
        <select required value={shopId} onChange={event => setShopId(event.target.value)} disabled={busy}>
          <option value="">选择店铺</option>
          {shops.map(shop => <option key={shop.id} value={shop.id}>{shop.shopName || shop.shopId} · {marketNames[shop.region] || shop.region} · {shop.currency}</option>)}
        </select>
      </label> : !error && <p>没有已连接且支持本地化的店铺。<a className={styles.link} href="/channels/shops">打开店铺管理</a></p>}
      <div className={styles.actions}>
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>取消</Button>
        <Button type="submit" disabled={!shopId || busy}>{busy ? '正在打开草稿…' : '生成并打开草稿'}</Button>
      </div>
    </form>
  </Dialog>;
}

type CriteriaForm = Record<keyof Criteria, string>;
const emptyCriteria: CriteriaForm = {priceMin: '', priceMax: '', minGrowth: '', minCommission: ''};
const criteriaFields: [keyof Criteria, string][] = [['priceMin', '售价下限 (RM)'], ['priceMax', '售价上限 (RM)'], ['minGrowth', '最低销量环比 (%)'], ['minCommission', '最低佣金比例 (%)']];

function AnalysisDialog({count, previous: latest, onClose, onStart}: {
  count: number; previous?: ResearchAnalysis; onClose: () => void; onStart: (body: Omit<AnalysisRequest, 'keyword' | 'category'>) => Promise<void>;
}) {
  // Freeze the brief source when the dialog opens; later polling must not reset edits.
  const [previous] = useState(latest);
  const [shops, setShops] = useState<MarketShop[]>();
  const [shopId, setShopId] = useState('');
  const [profile, setProfile] = useState<ShopProfile | null>(null);
  const [profileError, setProfileError] = useState('');
  const [criteria, setCriteria] = useState<CriteriaForm>(emptyCriteria);
  const [requirements, setRequirements] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    void localizationApi.shops().then(items => {
      if (!current) return;
      const eligible = items.filter(shop => shop.status === 'CONNECTED' && shop.currency);
      setShops(eligible);
      const remembered = eligible.find(shop => shop.id === previous?.shop?.shopId) ?? (eligible.length === 1 ? eligible[0] : undefined);
      if (remembered) setShopId(remembered.id);
    }).catch(error => { if (current) {setProfileError(errorMessage(error)); setShops([]);} });
    return () => {current = false;};
  }, [previous?.shop?.shopId]);

  useEffect(() => {
    setProfile(null);
    setProfileError('');
    if (!shopId) return;
    let current = true;
    void selectionApi.shopProfile(shopId).then(value => {
      if (!current) return;
      setProfile(value);
    }).catch(error => { if (current) setProfileError(errorMessage(error)); });
    return () => {current = false;};
  }, [shopId]);

  const loadingProfile = !!shopId && !profile && !profileError;
  const ready = !busy && !loadingProfile && (!!shopId || !!requirements.trim());
  return <Dialog title="AI 选品分析" onClose={() => { if (!busy) onClose(); }}>
    <form className={styles.dialogBody} onSubmit={async event => {
      event.preventDefault();
      if (!ready) return;
      setBusy(true);
      setError('');
      const values = Object.fromEntries(Object.entries(criteria).filter(([, value]) => value.trim()).map(([key, value]) => [key, Number(value)]));
      try {await onStart({requirements: requirements.trim(), ...(shopId ? {shopId} : {}), criteria: values});}
      catch (error) {setError(errorMessage(error)); setBusy(false);}
    }}>
      <p>当前筛选中有 <strong>{count} 款</strong>商品，先按下方条件过滤，再交给 AI 评分。</p>
      <label className={styles.field}><span>目标店铺</span>
        <select value={shopId} onChange={event => setShopId(event.target.value)} disabled={busy || !shops}>
          <option value="">{shops ? '不指定店铺' : '正在读取已连接店铺…'}</option>
          {shops?.map(shop => <option key={shop.id} value={shop.id}>{shop.shopName || shop.shopId} · {marketNames[shop.region] || shop.region} · {shop.currency}</option>)}
        </select>
      </label>
      {loadingProfile && <p role="status">正在根据店铺在售商品生成画像…</p>}
      {profileError && <p className="message error" role="alert">{profileError}</p>}
      {profile && <div className={`${styles.reviewSummary} ${styles.profile}`}>
        <strong>店铺画像 · 采样 {profile.sampled} 款在售商品</strong>
        <span>主营类目：{profile.categories.map(item => `${item.name} (${item.count})`).join('、') || '-'}</span>
        {profile.brands.length > 0 && <span>品牌：{profile.brands.join('、')}</span>}
        {profile.warnings.map(warning => <span key={warning} className="muted">{warning}</span>)}
      </div>}
      <div className={styles.criteria}>
        {criteriaFields.map(([key, label]) => <label key={key} className={styles.field}><span>{label}</span>
          <input type="number" step="any" min={key === 'minGrowth' ? undefined : 0} value={criteria[key]} disabled={busy}
            onChange={event => setCriteria(value => ({...value, [key]: event.target.value}))} placeholder="不限"/>
        </label>)}
      </div>
      <label className={styles.field}><span>{shopId ? '补充要求（选填）' : '选品要求'}</span>
        <textarea required={!shopId} maxLength={2000} rows={3} value={requirements} onChange={event => setRequirements(event.target.value)}
          placeholder={shopId ? '例如：避开易碎品，优先适合直播展示的商品' : '例如：面向马来西亚，售价 RM30 以内，关注销量增长的居家用品'}/>
      </label>
      {error && <div className="message error" role="alert">{error} {/模型|AI|文本/.test(error) && <a className={styles.link} href="/settings/ai">打开 AI 设置</a>}</div>}
      <div className={styles.actions}>
        <Button type="button" variant="outline" disabled={busy} onClick={onClose}>取消</Button>
        <Button type="submit" disabled={!ready}>{busy ? '正在提交…' : '开始分析'}</Button>
      </div>
    </form>
  </Dialog>;
}

function DatasetTable({dataset}: {dataset: ResearchDataset}) {
  const [keyword, setKeyword] = useState('');
  const deferredKeyword = useDeferredValue(keyword.trim());
  const [category, setCategory] = useState('');
  const [sort, setSort] = useState('rank');
  const [recommended, setRecommended] = useState(false);
  const [page, setPage] = useState(1);
  const [analyses, setAnalyses] = useState<ResearchAnalysis[]>([]);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState('');
  const analysis = analyses.find(job => job.id === selectedAnalysisId) ?? analyses[0];
  const running = analyses.some(job => job.status === 'running');
  const [table, setTable] = useState<Awaited<ReturnType<typeof selectionApi.products>>>();
  const [loadedQuery, setLoadedQuery] = useState('');
  const [reload, setReload] = useState(0);
  const [productsError, setProductsError] = useState('');
  const [analysisError, setAnalysisError] = useState('');
  const [retrying, setRetrying] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [detail, setDetail] = useState<ResearchProduct | null>(null);
  const [follow, setFollow] = useState<ResearchProduct | null>(null);
  const query = new URLSearchParams({
    keyword: deferredKeyword, category, sort, page: String(page), recommended: String(recommended),
    ...(analysis ? {analysisId: analysis.id} : {}),
  }).toString();
  const loading = loadedQuery !== query || deferredKeyword !== keyword.trim();

  useEffect(() => {
    let current = true;
    void selectionApi.analyses(dataset.id).then(jobs => { if (current) setAnalyses(jobs); })
      .catch(error => {if (current) setAnalysisError(errorMessage(error));});
    return () => {current = false;};
  }, [dataset.id]);

  useEffect(() => {
    if (!running) return;
    let current = true, pending = false;
    const poll = window.setInterval(async () => {
      if (pending) return;
      pending = true;
      try {const jobs = await selectionApi.analyses(dataset.id); if (current) {setAnalyses(jobs); setAnalysisError('');}}
      catch (error) {if (current) setAnalysisError(errorMessage(error));}
      finally {pending = false;}
    }, 2500);
    return () => {current = false; window.clearInterval(poll);};
  }, [dataset.id, running]);

  useEffect(() => {
    let current = true;
    void selectionApi.products(dataset.id, new URLSearchParams(query)).then(value => {
      if (!current) return;
      setTable(value);
      setLoadedQuery(query);
      setProductsError('');
    }).catch(error => {if (current) setProductsError(errorMessage(error));});
    return () => {current = false;};
  }, [dataset.id, query, reload, analysis?.scored]);

  function accept(job: ResearchAnalysis) {
    setAnalyses(jobs => [job, ...jobs.filter(previous => previous.id !== job.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    setSelectedAnalysisId(job.id);
  }

  const hasPage = table && table.total > table.pageSize;
  return <>
    <section className="card" aria-label="销量榜">
      <div className={styles.tableHeader}>
        <div>
          <h2>{periodNames[dataset.period.type]} · {periodLabel(dataset.period)}</h2>
          <p className="muted">{dataset.total} 款商品</p>
        </div>
        <Button disabled={loading || !table?.matched || running} onClick={() => setAnalysisOpen(true)}>AI 分析</Button>
      </div>
      <div className={styles.filters}>
        <label className={styles.field}><span>搜索商品</span><input type="search" maxLength={200} placeholder="商品名、店铺名、类目"
          value={keyword} onChange={event => {setKeyword(event.target.value); setPage(1);}}/></label>
        <label className={styles.field}><span>商品类目</span>
          <select value={category} onChange={event => {setCategory(event.target.value); setPage(1);}}>
            <option value="">全部类目</option>{table?.categories.map(name => <option key={name}>{name}</option>)}
          </select>
        </label>
        <label className={styles.field}><span>排序</span>
          <select value={sort} onChange={event => {setSort(event.target.value); setPage(1);}}>
            <option value="rank">原始排名</option><option value="units">销量最高</option>
            <option value="growth">销量环比最高</option><option value="revenue">销售额最高</option>
            <option value="totalUnits">总销量最高</option><option value="score">AI 评分最高</option>
          </select>
        </label>
        {analysis && <label className={styles.checkbox}><input type="checkbox" checked={recommended} onChange={event => {
          setRecommended(event.target.checked); setPage(1);
        }}/>仅推荐 · 70 分及以上</label>}
      </div>
      {analysis && <div className={styles.analysisBar}>
        <label className={styles.field}><span>分析记录</span>
          <select value={analysis.id} onChange={event => {setSelectedAnalysisId(event.target.value); setPage(1);}}>
            {analyses.map(job => <option key={job.id} value={job.id}>{shortDate.format(new Date(job.createdAt))} · {[job.shop?.shopName, job.requirements].filter(Boolean).join(' · ').slice(0, 42) || '按店铺画像'}</option>)}
          </select>
        </label>
        <div className={styles.analysisStatus}>
          <p role="status">{analysis.status === 'running' ? '分析中' : analysis.status === 'complete' ? '已完成' : '分析未完成'} · 已评分 {analysis.scored}/{analysis.total}
            {analysis.failed > 0 && ` · ${analysis.failed} 款可重试`}
            {!!analysis.excluded && ` · ${analysis.excluded} 款因条件（${criteriaText(analysis.criteria)}）未送评`}</p>
          {analysis.status === 'running' && <progress className={styles.progress} aria-label="AI 分析进度" max={analysis.total} value={analysis.scored}/>}
          <p className="muted">{[analysis.model, analysis.shop && `店铺 ${analysis.shop.shopName}`, analysis.requirements].filter(Boolean).join(' · ')}</p>
        </div>
        {analysis.status === 'partial' && <Button variant="outline" disabled={running || retrying} onClick={async () => {
          setRetrying(true); setAnalysisError('');
          try {accept(await selectionApi.retry(analysis.id));}
          catch (error) {setAnalysisError(errorMessage(error));}
          finally {setRetrying(false);}
        }}>重试未完成商品</Button>}
      </div>}
      {analysisError && <p className={`message error ${styles.tableMessage}`} role="alert">{analysisError}</p>}
      {productsError && <div className={`message error ${styles.tableMessage}`} role="alert">{productsError} <button className={styles.textButton} onClick={() => setReload(value => value + 1)}>重试</button></div>}
      {!table && !productsError && <p className="empty" role="status">正在加载榜单…</p>}
      {table && <div className={styles.tableScroll} role="region" aria-label="榜单商品" tabIndex={0} aria-busy={loading}>
        <table className={styles.productsTable}>
          <colgroup>{['rankColumn', 'productColumn', 'shopColumn', 'priceColumn', 'unitsColumn', 'growthColumn', 'revenueColumn', 'totalColumn', 'scoreColumn', 'actionColumn'].map(column =>
            <col key={column} className={styles[column]}/>)}</colgroup>
          <thead><tr>
            {['排名', '商品', '店铺 / 类目', '参考售价', '销量', '环比', '销售额', '总销量', 'AI 评分', '操作'].map(label => <th key={label} scope="col">{label}</th>)}
          </tr></thead>
          <tbody>{table.rows.map(row => <tr key={row.productId}>
            <td className={styles.rank}>{row.rank}</td>
            <td><button className={styles.product} type="button" onClick={() => setDetail(row)}>
              <ProductImage src={row.image} alt="" className={styles.thumbnail}/>
              <span className={styles.productText}>
                <span className={styles.productTitle}>{row.title}</span>
                <span className={styles.productMetrics}>{referencePrice(row.price)} · 销量 {metric(row.units)}{row.assessment && ` · ${row.assessment.score} 分`}</span>
              </span>
            </button></td>
            <td><span className={styles.shop}>{row.shopName || '-'}</span><small>{row.category || '未分类'}</small></td>
            <td className={styles.numeric}>{referencePrice(row.price)}</td>
            <td className={styles.numeric}>{metric(row.units)}</td>
            <td className={`${styles.numeric} ${row.growth === null || row.growth === 0 ? '' : row.growth > 0 ? styles.positive : styles.negative}`}>{percent(row.growth)}</td>
            <td className={styles.numeric}>{money(row.revenue)}</td>
            <td className={styles.numeric}>{metric(row.totalUnits)}</td>
            <td>{row.assessment ? <button className={`badge ${row.assessment.score >= 70 ? 'good' : ''}`}
              aria-label={`查看评分 ${row.assessment.score} 分 · ${row.title}`} type="button" onClick={() => setDetail(row)}>{row.assessment.score} 分</button> : '-'}</td>
            <td><Button variant="outline" type="button" onClick={() => setFollow(row)}>一键跟卖</Button></td>
          </tr>)}</tbody>
        </table>
        {!table.rows.length && <p className="empty">{recommended ? '当前范围没有 70 分及以上商品' : '没有符合条件的商品'}</p>}
      </div>}
      {table && <div className={styles.tableFooter}>
        <span role="status">{loading ? '正在更新榜单…' : `共 ${table.total} 款商品`}</span>
        {hasPage && <div className={styles.pagination}>
          <Button variant="outline" disabled={loading || table.page <= 1} onClick={() => setPage(table.page - 1)}>上一页</Button>
          <span>第 {table.page} / {Math.ceil(table.total / table.pageSize)} 页</span>
          <Button variant="outline" disabled={loading || table.page * table.pageSize >= table.total} onClick={() => setPage(table.page + 1)}>下一页</Button>
        </div>}
      </div>}
    </section>
    {analysisOpen && <AnalysisDialog count={table?.matched ?? 0} previous={analysis} onClose={() => setAnalysisOpen(false)} onStart={async body => {
      const job = await selectionApi.analyze(dataset.id, {keyword: deferredKeyword, category, ...body});
      accept(job); setSort('score'); setRecommended(false); setPage(1); setAnalysisError(''); setAnalysisOpen(false);
    }}/>}
    {detail && <ProductDetails row={detail} onClose={() => setDetail(null)}/>}
    {follow && <FollowDialog row={follow} datasetId={dataset.id} defaultShopId={analysis?.shop?.shopId} onClose={() => setFollow(null)}/>}
  </>;
}

export default function SelectionPage() {
  const [email, setEmail] = useState('');
  const [datasets, setDatasets] = useState<ResearchDataset[]>();
  const [loadError, setLoadError] = useState('');
  const [selection, setSelection] = useState('');
  const dataset = datasets?.find(item => item.id === selection) ?? datasets?.[0];

  async function refresh(linkedId?: string) {
    setLoadError('');
    try {
      const [me, rankings] = await Promise.all([api<{email: string}>('/auth/me'), selectionApi.datasets(linkedId)]);
      setEmail(me.email);
      setDatasets(rankings);
    } catch (error) {
      if ((error as {status?: number}).status === 401) window.location.assign('/login');
      else setLoadError(errorMessage(error));
    }
  }

  useEffect(() => {
    const linkedId = new URLSearchParams(window.location.search).get('dataset') ?? '';
    setSelection(linkedId);
    void refresh(linkedId);
  }, []);

  return <Shell active="selection" email={email}>
    <div className={styles.workspace}>
      <section className={`card ${styles.heading}`}>
        <div><h1>市场调研</h1><p className="muted">FastMoss · TikTok Shop 马来西亚销量榜</p></div>
        {!!datasets?.length && <div className={styles.periodTypes} role="group" aria-label="切换榜单">
          {datasets.map(item => <button key={item.id} type="button" aria-pressed={dataset?.id === item.id}
            onClick={() => setSelection(item.id)}>{item.archived ? '历史榜单' : periodNames[item.period.type]}</button>)}
        </div>}
      </section>
      {loadError && <p className="message error" role="alert">{loadError} <button className={styles.textButton} onClick={() => void refresh(selection)}>重试</button></p>}
      {!datasets && !loadError && <section className="card empty" role="status">正在读取 FastMoss 榜单…</section>}
      {dataset ? <DatasetTable key={dataset.id} dataset={dataset}/> : datasets && <section className="card empty">暂无榜单</section>}
    </div>
  </Shell>;
}
