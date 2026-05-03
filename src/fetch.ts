import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';

import yaml from 'js-yaml';

import { sources } from './sources.js';
import type { FetchResult, ParsedConfig, Proxy, Source } from './types.js';
import { DATA_DIR, extractCountryCode, parseMultiplier, writeYaml } from './utils.js';

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

function endpointKey(p: Proxy): string {
  return `${p.server}|${p.port}`;
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

const BEST_SOURCES = new Set(['FreeSubsCheck', 'shaoyouvip', 'dalazhi', 'getnode', 'yahr601', 'NoMoreWalls']);
const BEST_COUNTRIES = new Set(['HK', 'JP', 'US', 'TW', 'SG', 'KR']);

function matchBestCountry(name: string): boolean {
  const code = extractCountryCode(name);
  return code ? BEST_COUNTRIES.has(code) : false;
}

const HAS_SPEED_RE = /\d+(?:\.\d+)?\s*[MK]B\/s/;

function isBest2Qualified(name: string): boolean {
  if (HAS_SPEED_RE.test(name)) return true;
  const mult = parseMultiplier(name);
  if (mult !== 2 && mult !== 1) return false;
  const lossMatch = name.match(/\|(\d+)%/);
  if (lossMatch && parseInt(lossMatch[1], 10) > 10) return false;
  if (/\|History/.test(name)) return false;
  return true;
}

function isBest1Qualified(name: string): boolean {
  return HAS_SPEED_RE.test(name);
}

function dedup(results: FetchResult[]): {
  acl4ssr: Proxy[];
  freesub: Proxy[];
  best1: Proxy[];
  best2: Proxy[];
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
  const best1 = collectProxies(results, (s, p) =>
    BEST_SOURCES.has(s.name) && matchBestCountry(p.name) && isBest1Qualified(p.name),
  );
  const best2 = collectProxies(results, (s, p) =>
    BEST_SOURCES.has(s.name) && matchBestCountry(p.name) && isBest2Qualified(p.name),
  );
  const all = collectProxies(results, () => true);

  let templateAcl4ssr: ParsedConfig | null = null;
  let templateFreesub: ParsedConfig | null = null;
  for (const { source, config } of results) {
    if (source.category === 'acl4ssr' && !templateAcl4ssr) templateAcl4ssr = config;
    if (source.category === 'freesub' && !templateFreesub) templateFreesub = config;
  }

  return { acl4ssr, freesub, best1, best2, all, templateAcl4ssr, templateFreesub };
}

function buildNodesOnly(proxies: Proxy[]): { proxies: Proxy[] } {
  return { proxies };
}

const TCP_TIMEOUT = 5000;
const TCP_CONCURRENCY = 50;
const TCP_RETRIES = 3;
const TCP_RETRY_DELAY = 3000;

function tcpCheckOnce(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port, timeout: TCP_TIMEOUT });
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
    socket.once('error', () => { socket.destroy(); resolve(false); });
  });
}

async function tcpBatch(endpoints: [string, { host: string; port: number }][]): Promise<Set<string>> {
  const aliveSet = new Set<string>();
  let tested = 0;
  for (let i = 0; i < endpoints.length; i += TCP_CONCURRENCY) {
    const batch = endpoints.slice(i, i + TCP_CONCURRENCY);
    const results = await Promise.all(batch.map(async ([key, ep]) => ({ key, ok: await tcpCheckOnce(ep.host, ep.port) })));
    for (const r of results) {
      if (r.ok) aliveSet.add(r.key);
    }
    tested += batch.length;
    const pct = Math.round((tested / endpoints.length) * 100);
    process.stdout.write(`\r    ${tested}/${endpoints.length} (${pct}%)  存活: ${aliveSet.size}`);
  }
  process.stdout.write('\n');
  return aliveSet;
}

async function tcpFilterAll(proxies: Proxy[]): Promise<Set<string>> {
  const uniqueEndpoints = new Map<string, { host: string; port: number }>();
  for (const p of proxies) {
    const key = endpointKey(p);
    if (!uniqueEndpoints.has(key)) uniqueEndpoints.set(key, { host: p.server, port: p.port });
  }

  const allEndpoints = [...uniqueEndpoints.entries()];
  const aliveSet = new Set<string>();
  let remaining = allEndpoints;

  console.log(`\nTCP 连通性测试 (${allEndpoints.length} 个唯一端点, ${TCP_RETRIES} 轮)...`);

  for (let round = 1; round <= TCP_RETRIES; round++) {
    if (remaining.length === 0) break;
    if (round > 1) {
      console.log(`  等待 ${TCP_RETRY_DELAY / 1000}s 后重试...`);
      await new Promise(r => setTimeout(r, TCP_RETRY_DELAY));
    }
    console.log(`  第 ${round} 轮 (${remaining.length} 个端点):`);
    const roundAlive = await tcpBatch(remaining);
    for (const key of roundAlive) aliveSet.add(key);
    remaining = remaining.filter(([key]) => !roundAlive.has(key));
  }

  console.log(`TCP 连通率: ${aliveSet.size}/${allEndpoints.length} (${Math.round((aliveSet.size / allEndpoints.length) * 100)}%)`);
  return aliveSet;
}

function filterByAlive(proxies: Proxy[], aliveSet: Set<string>): Proxy[] {
  return proxies.filter(p => aliveSet.has(endpointKey(p)));
}

async function main() {
  console.log(`拉取 ${sources.length} 个源...\n`);

  const results = (await Promise.all(sources.map(fetchSource))).filter(
    (r): r is FetchResult => r !== null,
  );

  console.log(`\n成功 ${results.length}/${sources.length} 个源`);

  const { acl4ssr, freesub, best1, best2, all, templateAcl4ssr, templateFreesub } = dedup(results);

  console.log(`\n去重后: ACL4SSR ${acl4ssr.length}, freeSub ${freesub.length}, best1 ${best1.length}, best2 ${best2.length}, 全部 ${all.length}`);

  const aliveSet = await tcpFilterAll(all);

  const acl4ssrAlive = filterByAlive(acl4ssr, aliveSet);
  const freesubAlive = filterByAlive(freesub, aliveSet);
  const best1Alive = filterByAlive(best1, aliveSet);
  const best2Alive = filterByAlive(best2, aliveSet);
  const allAlive = filterByAlive(all, aliveSet);

  console.log(`\nTCP 过滤后: ACL4SSR ${acl4ssrAlive.length}, freeSub ${freesubAlive.length}, best1 ${best1Alive.length}, best2 ${best2Alive.length}, 全部 ${allAlive.length}`);

  // save intermediate data
  fs.mkdirSync(DATA_DIR, { recursive: true });

  writeYaml(path.join(DATA_DIR, 'all-raw.yaml'), buildNodesOnly(allAlive));
  writeYaml(path.join(DATA_DIR, 'acl4ssr-raw.yaml'), buildNodesOnly(acl4ssrAlive));
  writeYaml(path.join(DATA_DIR, 'freesub-raw.yaml'), buildNodesOnly(freesubAlive));
  writeYaml(path.join(DATA_DIR, 'best1-raw.yaml'), buildNodesOnly(best1Alive));
  writeYaml(path.join(DATA_DIR, 'best2-raw.yaml'), buildNodesOnly(best2Alive));

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
