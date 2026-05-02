import fs from 'node:fs';
import path from 'node:path';

import yaml from 'js-yaml';

export const ROOT = path.resolve(import.meta.dirname, '..');
export const DATA_DIR = path.join(ROOT, 'data');

export function readYaml<T>(filePath: string): T {
  return yaml.load(fs.readFileSync(filePath, 'utf-8')) as T;
}

export function writeYaml(filePath: string, data: unknown): void {
  const content = yaml.dump(data, {
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false,
  });
  fs.writeFileSync(filePath, content, 'utf-8');
}

export const COUNTRY_CODE_RE = /([A-Z]{2})_\d+/;

export function extractCountryCode(name: string): string | null {
  const m = name.match(COUNTRY_CODE_RE);
  return m ? m[1] : null;
}
