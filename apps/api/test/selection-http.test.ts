import 'reflect-metadata';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {mkdtempSync, rmSync} from 'node:fs';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {test} from 'node:test';
import {SelectionStore} from '../src/tools/selection/store';
import {createTeamApp} from '../src/team-main';

const productId = '1729550982771738420';
const shops = [
  {id: 'test-my', shopId: '1', shopName: '测试马来店', region: 'MY', status: 'CONNECTED'},
  {id: 'test-ph', shopId: '2', shopName: '测试菲律宾店', region: 'PH', status: 'CONNECTED'},
];

test('Built-in FastMoss rankings feed owned Shopee drafts and preserve linked historical rankings', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'selection-http-'));
  process.env.NODE_ENV = 'test';
  process.env.LOCALIZATION_DATA_DIR = join(directory, 'localization');
  process.env.LISTING_DATA_DIR = join(directory, 'listing');
  process.env.LOCALIZATION_LOCAL_MODE = 'true';
  const upstream = createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json');
    if (request.url === '/api/v1/development/login') {
      let body = '';
      request.on('data', chunk => {body += chunk;});
      request.on('end', () => response.end(JSON.stringify({token: JSON.parse(body).email, expiresIn: 3600})));
      return;
    }
    if (request.url === '/api/v1/development/shops') return response.end(JSON.stringify(shops));
    if (request.url === '/api/v1/development/localization/imports') return response.end('{"records":[]}');
    if (request.url?.includes('/read/')) return response.end('{}');
    response.end(JSON.stringify({email: request.headers.authorization?.slice(7), role: 'ADMIN'}));
  });
  upstream.listen(0, '127.0.0.1');
  await once(upstream, 'listening');
  process.env.TEAM_API_ORIGIN = `http://127.0.0.1:${(upstream.address() as {port: number}).port}`;
  const app = await createTeamApp();
  await app.listen(0, '127.0.0.1');
  const base = await app.getUrl() + '/api/v1';
  const origin = 'http://127.0.0.1:3100';
  const root = '/localization/selection';
  const call = (path: string, cookie = '', body?: unknown, method = body === undefined ? 'GET' : 'POST') => fetch(base + path, {
    method, headers: {origin, ...(cookie ? {cookie} : {}), 'content-type': 'application/json'},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  async function json(response: Response, status = 200) {
    const body = await response.json();
    assert.equal(response.status, status, JSON.stringify(body));
    return body;
  }
  async function login(email: string) {
    const response = await call('/auth/login', '', {email, password: 'fixture'});
    assert.equal(response.status, 201);
    return response.headers.get('set-cookie')!.split(';')[0];
  }

  try {
    assert.equal((await call(root + '/datasets')).status, 401);
    const owner = 'operator@fixture.test';
    const cookie = await login(owner);
    const other = await login('other@fixture.test');
    assert.equal((await call(root + '/imports/preview', cookie, {})).status, 404);
    assert.equal((await call(root + '/imports', cookie, {})).status, 404);
    const rankings = await json(await call(root + '/datasets', cookie));
    assert.deepEqual(rankings.map(({period, total}: {period: unknown; total: number}) => ({period, total})), [
      {period: {type: 'day', value: '2026-11-18'}, total: 300},
      {period: {type: 'week', value: '2026-11-09'}, total: 300},
      {period: {type: 'month', value: '2026-10'}, total: 300},
    ]);
    assert.deepEqual(await json(await call(root + '/datasets', other)), rankings);
    const [daily, weekly, monthly] = rankings;
    const dailyPath = root + '/datasets/' + daily.id;
    const weeklyPath = root + '/datasets/' + weekly.id;
    const monthlyPath = root + '/datasets/' + monthly.id;
    const query = '?keyword=abangs&category=' + encodeURIComponent('内头巾');
    const listed = await json(await call(dailyPath + '/products' + query, cookie));
    assert.equal(listed.matched, 1);
    const [product] = listed.rows;
    assert.equal(product.productId, productId);
    assert.equal(product.rank, 2);
    assert.equal(product.units, 5897);
    assert.deepEqual(product.price, {min: 1.75, max: 1.95});
    assert.match(product.image, /^https:\/\/s\.500fd\.com\//);
    assert.equal((await json(await call(weeklyPath + '/products' + query, other))).rows[0].units, 53992);
    assert.equal((await json(await call(monthlyPath + '/products' + query, cookie))).rows[0].units, 157567);
    const lastPage = await json(await call(monthlyPath + '/products?page=15', cookie));
    assert.equal(lastPage.rows.at(-1).rank, 300);

    const legacyId = randomUUID();
    const legacyPeriod = {type: 'day', value: '2026-11-17'};
    const store = new SelectionStore(join(directory, 'localization', 'selection'));
    store.write(owner, 'datasets', legacyId, {
      id: legacyId, period: legacyPeriod, filename: 'historical.xlsx', createdAt: '2026-11-18T00:00:00.000Z', digest: 'fixture', rows: [product],
    });
    assert.deepEqual(await json(await call(root + '/datasets', cookie)), rankings);
    const linked = root + '/datasets?dataset=' + legacyId;
    const legacyPath = root + '/datasets/' + legacyId;
    const withLegacy = await json(await call(linked, cookie));
    assert.equal(withLegacy.length, 4);
    assert.equal(withLegacy[3].archived, true);
    assert.deepEqual(withLegacy[3].period, legacyPeriod);
    assert.deepEqual(await json(await call(linked, other)), rankings);
    assert.equal((await call(legacyPath + '/products', other)).status, 404);
    assert.equal((await json(await call(legacyPath + '/products', cookie))).rows[0].productId, productId);

    const analysisError = await json(await call(dailyPath + '/analyses', cookie, {requirements: '头巾'}), 400);
    assert.match(analysisError.message, /文本/);
    assert.deepEqual(await json(await call(dailyPath + '/analyses', cookie)), []);
    const strict = await json(await call(dailyPath + '/analyses', cookie, {shopId: 'test-my', keyword: 'abangs', category: '内头巾', criteria: {priceMin: 10}}), 400);
    assert.match(strict.message, /放宽/);
    assert.equal((await json(await call(dailyPath + '/analyses', cookie, {requirements: '头巾', criteria: {priceMin: 5, priceMax: 1}}), 400)).message, '价格下限不能高于上限');
    const profile = await json(await call(root + '/shops/test-ph/profile', cookie));
    assert.equal(profile.currency, 'PHP');
    assert.equal(profile.sampled, 0);
    assert.ok(profile.warnings.some((warning: string) => /马来西亚/.test(warning)));

    const analysisId = randomUUID();
    const assessment = {productId, score: 82, reason: 'Fixture', evidence: [], risks: [], confidence: 'high'};
    store.write(owner, 'analyses', analysisId, {
      id: analysisId, datasetId: daily.id, createdAt: '2026-11-19T00:00:00.000Z', model: 'fixture', modelKey: 'fixture',
      requirements: '头巾', keyword: '', category: '', productIds: [productId], status: 'complete', results: {[productId]: assessment},
    });
    const assessedPath = dailyPath + '/products?recommended=true&analysisId=' + analysisId;
    assert.equal((await json(await call(assessedPath, cookie))).rows[0].assessment.score, 82);
    assert.equal((await call(assessedPath, other)).status, 404);
    assert.deepEqual(await json(await call(dailyPath + '/analyses', other)), []);

    const destination = {productId, shopId: 'test-my'};
    const concurrent = await Promise.all([call(dailyPath + '/drafts', cookie, destination), call(dailyPath + '/drafts', cookie, destination)]);
    const created = await Promise.all(concurrent.map(response => json(response, 201)));
    assert.equal(created[0].draftId, created[1].draftId);
    assert.equal(created.filter(item => !item.existing).length, 1);
    const draftId = created[0].draftId;
    const draftPath = '/localization/drafts/' + draftId;
    assert.equal((await call(draftPath, other)).status, 404);
    const draft = await json(await call(draftPath, cookie));
    assert.equal(draft.shop.currency, 'MYR');
    assert.equal(draft.description, '');
    assert.equal(draft.variants[0].price, null);
    assert.deepEqual(draft.images, [product.image]);
    const provenance = await json(await call(root + '/drafts/' + draftId + '/origin', cookie));
    assert.equal(provenance.copy, 'unconfigured');
    assert.deepEqual(provenance.referenceImages, [product.image]);
    assert.equal(provenance.canApplyReferenceImages, true);
    assert.equal(provenance.product.image, product.image);
    const saved = await json(await call(draftPath, cookie, {...draft, title: 'Edited title', specificationNames: ['颜色'], variants: [
      {sku: 'WHITE', options: ['白色'], price: 2, stock: 4}, {sku: 'BLUE', options: ['蓝色'], price: 3, stock: 5},
    ]}, 'PUT'));
    const repeated = await json(await call(weeklyPath + '/drafts', cookie, destination), 201);
    assert.equal(repeated.draftId, draftId);
    assert.equal(repeated.existing, true);
    assert.equal((await json(await call(draftPath, cookie))).revision, saved.revision);
    assert.equal((await json(await call(root + '/drafts/' + draftId + '/origin', cookie))).datasetId, daily.id);
    const another = await json(await call(weeklyPath + '/drafts', cookie, {...destination, shopId: 'test-ph'}), 201);
    assert.notEqual(another.draftId, draftId);
    assert.equal((await json(await call('/localization/drafts/' + another.draftId, cookie))).shop.currency, 'PHP');
    const preview = await json(await call(draftPath + '/preview', cookie, {}), 201);
    assert.equal(preview.canPublish, false);
    assert.ok(!preview.issues.includes('添加可用商品图片'));
    assert.deepEqual(preview.draft.images, [product.image]);
    assert.equal(preview.draft.variants.length, 2);
  } finally {
    await app.close();
    upstream.close();
    await once(upstream, 'close');
    rmSync(directory, {recursive: true, force: true});
  }
});
