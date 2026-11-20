import {Logger, ServiceUnavailableException} from '@nestjs/common';
import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import {parseWorkbook, type Product} from './fastmoss';
import type {Period} from './period';
import {fingerprint, stableId} from './store';

export type Dataset = {
  id: string;
  filename: string;
  period: Period;
  createdAt: string;
  digest: string;
  rows: Product[];
};

const sources: {filename: string; period: Period; exportedAt: string}[] = [
  {filename: '18日榜商品搜索_TT销量榜_20261119_172028.xlsx', period: {type: 'day', value: '2026-11-18'}, exportedAt: '2026-11-19T17:20:28+08:00'},
  {filename: '46 周榜商品搜索_TT销量榜_20261119_172108.xlsx', period: {type: 'week', value: '2026-11-09'}, exportedAt: '2026-11-19T17:21:08+08:00'},
  {filename: '10 月榜商品搜索_TT销量榜_20261119_172133.xlsx', period: {type: 'month', value: '2026-10'}, exportedAt: '2026-11-19T17:21:33+08:00'},
];
const logger = new Logger('FastMoss');
let loaded: Promise<Dataset[]> | undefined;

async function loadDatasets(): Promise<Dataset[]> {
  // Test compilation inserts a src directory inside dist-test.
  const directory = [resolve(__dirname, '../../../../../fastmoss'), resolve(__dirname, '../../../../../../fastmoss')].find(existsSync);
  if (!directory) throw new Error('Missing fastmoss directory');
  return Promise.all(sources.map(async ({filename, period, exportedAt}) => {
    const {rows, errors} = await parseWorkbook(await readFile(join(directory, filename)));
    if (errors.length || !rows.length) throw new Error(`${filename}: invalid rows ${errors.map(error => error.row).join(', ')}`);
    const digest = fingerprint(rows);
    // Match the ID assigned to the same file and period by the former import flow.
    return {id: stableId([filename, digest, period]), filename, period, digest, rows, createdAt: new Date(exportedAt).toISOString()};
  }));
}

export function builtInDatasets() {
  loaded ??= loadDatasets().catch((error: unknown) => {
    loaded = undefined;
    logger.error(error instanceof Error ? error.message : String(error));
    throw new ServiceUnavailableException('暂时无法读取 FastMoss 榜单，请重试');
  });
  return loaded;
}
