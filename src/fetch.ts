import fs from 'node:fs';
import path from 'node:path';

import yaml from 'js-yaml';

import { sources } from './sources.js';
import type { FetchResult, ParsedConfig, Proxy, Source } from './types.js';
import { DATA_DIR, extractCountryCode, writeYaml } from './utils.js';

const TIMEOUT = 30_000;

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

const AD_PATTERNS = [
  /机场推荐[:：]\S+/g,
  /[Jj]oin[+\s]?[Tt]elegram[:：]?@[\w.-]+/g,
  /[Tt]elegram[:：]?@[\w.-]+/g,
  /频道[:：]?\S+/g,
  /订阅[:：]?\S+/g,
  /免费节点/g,
  /[丨|]?[\w.-]+\.(com|de|org|net|me|cc|top|xyz|io)\b/g,
  /\([^)]*节点[^)]*\)/g,
  /\([^)]*分享[^)]*\)/g,
  /\([^)]*推荐[^)]*\)/g,
];

function normalizeName(proxy: Proxy): void {
  // dalazhi: remove "op" prefix
  if (proxy.name.startsWith('op')) {
    proxy.name = proxy.name.slice(2);
  }
  // freeSub: remove "_github.com/Ruk1ng001_"
  proxy.name = proxy.name.replace(/_github\.com\/Ruk1ng001_/g, '_');
  // replace 🟢🟡🔴⚪ circle prefix with trailing |优|良|差|未知
  const circleMap: Record<string, string> = {
    '\u{1F7E2}': '|优',
    '\u{1F7E1}': '|良',
    '\u{1F534}': '|差',
    '⚪': '|未知',
  };
  for (const [circle, suffix] of Object.entries(circleMap)) {
    if (proxy.name.includes(circle)) {
      proxy.name = proxy.name.replace(circle, '') + suffix;
      break;
    }
  }
  // remove 🏳️ (white flag, used with ⚪ for unknown region)
  proxy.name = proxy.name.replace(/\u{1F3F3}\u{FE0F}?/gu, '');
  // strip ad/promo text from name (keep the node)
  for (const pat of AD_PATTERNS) {
    proxy.name = proxy.name.replace(pat, '');
  }
  // clean up leftover whitespace and separators
  proxy.name = proxy.name.replace(/\s{2,}/g, ' ').replace(/^[\s\-|]+|[\s\-|]+$/g, '').trim();
}

function proxyKey(p: Proxy): string {
  return `${p.type}|${p.server}|${p.port}`;
}

function collectProxies(
  results: FetchResult[],
  filter: (source: Source, proxy: Proxy) => boolean,
): Proxy[] {
  const seen = new Set<string>();
  const proxies: Proxy[] = [];
  const nameCounter = new Map<string, number>();

  for (const { source, config } of results) {
    for (const proxy of config.proxies) {
      if (!filter(source, proxy)) continue;
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

const CURATED_SOURCES = new Set(['FreeSubsCheck', 'shaoyouvip', 'dalazhi', 'getnode', 'yahr601']);
const CURATED_COUNTRIES = new Set(['HK', 'JP', 'US', 'TW', 'SG', 'KR']);

function matchCuratedCountry(name: string): boolean {
  const code = extractCountryCode(name);
  return code ? CURATED_COUNTRIES.has(code) : false;
}

const USEFUL_TAGS_RE = /\|(?:GPT⁺?|GM|YT|优|良|差|未知)/;

function isCuratedQualified(name: string): boolean {
  const lossMatch = name.match(/\|(\d+)%/);
  if (lossMatch && parseInt(lossMatch[1], 10) > 10) return false;
  if (/\|(?:History|Succeed)/.test(name) && !USEFUL_TAGS_RE.test(name)) return false;
  const hasSpeed = /\d+(?:\.\d+)?\s*[MK]B\/s/.test(name);
  if (!hasSpeed && !USEFUL_TAGS_RE.test(name) && !lossMatch) return false;
  return true;
}

function dedup(results: FetchResult[]): {
  acl4ssr: Proxy[];
  freesub: Proxy[];
  curated: Proxy[];
  all: Proxy[];
  templateAcl4ssr: ParsedConfig | null;
  templateFreesub: ParsedConfig | null;
} {
  // normalize all names once upfront
  for (const { config } of results) {
    for (const proxy of config.proxies) {
      normalizeName(proxy);
    }
  }

  const acl4ssr = collectProxies(results, (s) => s.category === 'acl4ssr');
  const freesub = collectProxies(results, (s) => s.category === 'freesub');
  const curated = collectProxies(results, (s, p) =>
    CURATED_SOURCES.has(s.name) && matchCuratedCountry(p.name) && isCuratedQualified(p.name),
  );
  const all = collectProxies(results, () => true);

  let templateAcl4ssr: ParsedConfig | null = null;
  let templateFreesub: ParsedConfig | null = null;
  for (const { source, config } of results) {
    if (source.category === 'acl4ssr' && !templateAcl4ssr) templateAcl4ssr = config;
    if (source.category === 'freesub' && !templateFreesub) templateFreesub = config;
  }

  return { acl4ssr, freesub, curated, all, templateAcl4ssr, templateFreesub };
}

function buildNodesOnly(proxies: Proxy[]): { proxies: Proxy[] } {
  return { proxies };
}

async function main() {
  console.log(`拉取 ${sources.length} 个源...\n`);

  const results = (await Promise.all(sources.map(fetchSource))).filter(
    (r): r is FetchResult => r !== null,
  );

  console.log(`\n成功 ${results.length}/${sources.length} 个源`);

  const { acl4ssr, freesub, curated, all, templateAcl4ssr, templateFreesub } = dedup(results);

  console.log(`\n去重后: ACL4SSR ${acl4ssr.length}, freeSub ${freesub.length}, 精选 ${curated.length}, 全部 ${all.length}`);

  // save intermediate data
  fs.mkdirSync(DATA_DIR, { recursive: true });

  writeYaml(path.join(DATA_DIR, 'all-raw.yaml'), buildNodesOnly(all));
  writeYaml(path.join(DATA_DIR, 'acl4ssr-raw.yaml'), buildNodesOnly(acl4ssr));
  writeYaml(path.join(DATA_DIR, 'freesub-raw.yaml'), buildNodesOnly(freesub));
  writeYaml(path.join(DATA_DIR, 'curated-raw.yaml'), buildNodesOnly(curated));

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
