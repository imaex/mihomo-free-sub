import fs from 'node:fs';
import path from 'node:path';

import yaml from 'js-yaml';

import { sources } from './sources.js';
import type { FetchResult, ParsedConfig, Proxy, Source } from './types.js';

const TIMEOUT = 30_000;
const ROOT = path.resolve(import.meta.dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');

async function fetchSource(source: Source): Promise<FetchResult | null> {
  try {
    const res = await fetch(source.url, {
      signal: AbortSignal.timeout(TIMEOUT),
      headers: { 'User-Agent': 'clash.meta' },
    });
    if (!res.ok) {
      console.error(`  ✗ ${source.name}: HTTP ${res.status}`);
      return null;
    }
    const text = await res.text();
    const config = yaml.load(text) as ParsedConfig;
    if (!config?.proxies?.length) {
      console.error(`  ✗ ${source.name}: 无节点`);
      return null;
    }
    console.log(`  ✓ ${source.name}: ${config.proxies.length} 节点`);
    return { source, config };
  } catch (e) {
    console.error(`  ✗ ${source.name}: ${(e as Error).message}`);
    return null;
  }
}

function proxyKey(p: Proxy): string {
  return `${p.type}|${p.server}|${p.port}`;
}

function dedupCategory(results: FetchResult[], category: string): Proxy[] {
  const seen = new Set<string>();
  const proxies: Proxy[] = [];
  const nameCounter = new Map<string, number>();

  for (const { source, config } of results) {
    if (source.category !== category) continue;
    for (const proxy of config.proxies) {
      const key = proxyKey(proxy);
      if (seen.has(key)) continue;
      seen.add(key);

      const baseName = proxy.name;
      const count = nameCounter.get(baseName) || 0;
      if (count > 0) proxy.name = `${baseName}_${count}`;
      nameCounter.set(baseName, count + 1);

      proxies.push(proxy);
    }
  }
  return proxies;
}

function dedup(results: FetchResult[]): {
  acl4ssr: Proxy[];
  freesub: Proxy[];
  all: Proxy[];
  templateAcl4ssr: ParsedConfig | null;
  templateFreesub: ParsedConfig | null;
} {
  const acl4ssr = dedupCategory(results, 'acl4ssr');
  const freesub = dedupCategory(results, 'freesub');

  // all: global dedup across everything
  const seenAll = new Set<string>();
  const all: Proxy[] = [];
  const nameCounter = new Map<string, number>();
  for (const { config } of results) {
    for (const proxy of config.proxies) {
      const key = proxyKey(proxy);
      if (seenAll.has(key)) continue;
      seenAll.add(key);

      const baseName = proxy.name;
      const count = nameCounter.get(baseName) || 0;
      if (count > 0) proxy.name = `${baseName}_${count}`;
      nameCounter.set(baseName, count + 1);

      all.push(proxy);
    }
  }

  let templateAcl4ssr: ParsedConfig | null = null;
  let templateFreesub: ParsedConfig | null = null;
  for (const { source, config } of results) {
    if (source.category === 'acl4ssr' && !templateAcl4ssr) templateAcl4ssr = config;
    if (source.category === 'freesub' && !templateFreesub) templateFreesub = config;
  }

  return { acl4ssr, freesub, all, templateAcl4ssr, templateFreesub };
}

function buildNodesOnly(proxies: Proxy[]): { proxies: Proxy[] } {
  return { proxies };
}

function writeYaml(filePath: string, data: unknown): void {
  const content = yaml.dump(data, {
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false,
  });
  fs.writeFileSync(filePath, content, 'utf-8');
}

async function main() {
  console.log(`拉取 ${sources.length} 个源...\n`);

  const results = (await Promise.all(sources.map(fetchSource))).filter(
    (r): r is FetchResult => r !== null,
  );

  console.log(`\n成功 ${results.length}/${sources.length} 个源`);

  const { acl4ssr, freesub, all, templateAcl4ssr, templateFreesub } = dedup(results);

  console.log(`\n去重后: ACL4SSR ${acl4ssr.length}, freeSub ${freesub.length}, 全部 ${all.length}`);

  // save intermediate data
  fs.mkdirSync(DATA_DIR, { recursive: true });

  writeYaml(path.join(DATA_DIR, 'all-raw.yaml'), buildNodesOnly(all));
  writeYaml(path.join(DATA_DIR, 'acl4ssr-raw.yaml'), buildNodesOnly(acl4ssr));
  writeYaml(path.join(DATA_DIR, 'freesub-raw.yaml'), buildNodesOnly(freesub));

  // save templates
  if (templateAcl4ssr) {
    writeYaml(path.join(DATA_DIR, 'template-acl4ssr.yaml'), {
      'proxy-groups': templateAcl4ssr['proxy-groups'],
      rules: templateAcl4ssr.rules,
      'rule-providers': templateAcl4ssr['rule-providers'],
      dns: templateAcl4ssr.dns,
    });
  }
  if (templateFreesub) {
    writeYaml(path.join(DATA_DIR, 'template-freesub.yaml'), {
      'proxy-groups': templateFreesub['proxy-groups'],
      rules: templateFreesub.rules,
      'rule-providers': templateFreesub['rule-providers'],
      dns: templateFreesub.dns,
    });
  }

  console.log('\n数据已保存到 data/ 目录');
}

main();
