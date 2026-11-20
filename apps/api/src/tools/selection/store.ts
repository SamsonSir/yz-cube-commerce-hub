import {createHash, randomUUID} from 'node:crypto';
import {mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';

export function fingerprint(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function stableId(value: unknown) {
  const hex = fingerprint(value);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

const idPattern = /^[a-f0-9-]{36}$/;
type Bucket = 'datasets' | 'analyses' | 'origins';

export class SelectionStore {
  constructor(private readonly root: string) {}

  private directory(owner: string, bucket: Bucket) {
    return join(this.root, fingerprint(owner), bucket);
  }

  read<T>(owner: string, bucket: Bucket, id: string): T | undefined {
    if (!idPattern.test(id)) return;
    try {
      return JSON.parse(readFileSync(join(this.directory(owner, bucket), id + '.json'), 'utf8')) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  list<T>(owner: string, bucket: Bucket): T[] {
    try {
      return readdirSync(this.directory(owner, bucket)).filter(name => name.endsWith('.json'))
        .flatMap(name => {
          const record = this.read<T>(owner, bucket, name.slice(0, -5));
          return record === undefined ? [] : [record];
        });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }

  write(owner: string, bucket: Bucket, id: string, record: unknown) {
    const directory = this.directory(owner, bucket);
    mkdirSync(directory, {recursive: true, mode: 0o700});
    const file = join(directory, id + '.json');
    const temporary = file + '.' + randomUUID() + '.tmp';
    writeFileSync(temporary, JSON.stringify(record), {mode: 0o600});
    renameSync(temporary, file);
  }
}
