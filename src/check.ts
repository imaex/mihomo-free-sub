import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import yaml from 'js-yaml';

import type { Proxy } from './types.js';
import { DATA_DIR, extractCountryCode, parseMultiplier, readYaml, ROOT, writeYaml } from './utils.js';

const TEMP_DIR = path.join(ROOT, '.check-tmp');

const TIMEOUT = 5000;
const CONCURRENCY = 100;
const API_PORT = 19090;
const API_BASE = `http://127.0.0.1:${API_PORT}`;
const TEST_URL = 'http://www.gstatic.com/generate_204';

function findMihomoBinary(): string {
  const candidates = [
    path.join(ROOT, 'mihomo'),
    path.join(process.env.HOME || '~', '.mihomo-cli', 'kernel', 'mihomo'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('未找到 mihomo 二进制，请先下载内核');
}

function ensureTempDir(): void {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

function cleanupTempDir(): void {
  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  }
}

function assignUniqueNames(proxies: Proxy[]): { uniqueNames: string[]; indexMap: Map<string, number> } {
  const nameCount = new Map<string, number>();
  const uniqueNames: string[] = [];
  const indexMap = new Map<string, number>();

  for (let i = 0; i < proxies.length; i++) {
    const count = (nameCount.get(proxies[i].name) || 0) + 1;
    nameCount.set(proxies[i].name, count);
    const uniqueName = count > 1 ? `${proxies[i].name}_${count}` : proxies[i].name;
    uniqueNames.push(uniqueName);
    indexMap.set(uniqueName, i);
  }

  return { uniqueNames, indexMap };
}

function buildConfig(proxies: Proxy[], uniqueNames: string[]): string {
  const namedProxies = proxies.map((p, i) => ({ ...p, name: uniqueNames[i] }));

  const config = {
    'allow-lan': false,
    'external-controller': `127.0.0.1:${API_PORT}`,
    'log-level': 'error',
    proxies: namedProxies,
    'proxy-groups': [
      {
        name: 'PROXY',
        type: 'select',
        proxies: uniqueNames,
      },
    ],
    rules: ['MATCH,PROXY'],
  };

  return yaml.dump(config, { lineWidth: -1, noRefs: true });
}

async function startMihomo(configPath: string, binary: string): Promise<ChildProcess> {
  const logPath = path.join(TEMP_DIR, 'mihomo.log');
  const logFd = fs.openSync(logPath, 'w');

  const child = spawn(binary, ['-f', configPath], {
    detached: true,
    stdio: ['ignore', logFd, logFd],
  });
  fs.closeSync(logFd);
  child.unref();

  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 500));
    try {
      const res = await fetch(`${API_BASE}/version`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return child;
    } catch {
      // not ready yet
    }
    if (child.exitCode !== null) {
      const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8').slice(-500) : '';
      throw new Error(`mihomo 启动失败\n${log}`);
    }
  }
  throw new Error('mihomo 启动超时');
}

function stopMihomo(child: ChildProcess): void {
  try {
    if (child.pid) process.kill(child.pid, 'SIGTERM');
  } catch {
    // already dead
  }
}

async function testProxy(name: string): Promise<{ name: string; delay: number | null }> {
  const url = `${API_BASE}/proxies/${encodeURIComponent(name)}/delay?timeout=${TIMEOUT}&url=${encodeURIComponent(TEST_URL)}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT + 3000) });
    const data = (await res.json()) as { delay?: number; message?: string };
    if (data.delay && data.delay > 0) {
      return { name, delay: data.delay };
    }
    return { name, delay: null };
  } catch {
    return { name, delay: null };
  }
}

async function testBatch(proxies: Proxy[], binary: string): Promise<Proxy[]> {
  if (proxies.length === 0) return [];

  const { uniqueNames, indexMap } = assignUniqueNames(proxies);

  const configContent = buildConfig(proxies, uniqueNames);
  const configPath = path.join(TEMP_DIR, 'config.yaml');
  fs.writeFileSync(configPath, configContent, 'utf-8');

  const child = await startMihomo(configPath, binary);

  try {
    const alive: Proxy[] = [];
    let tested = 0;

    for (let i = 0; i < uniqueNames.length; i += CONCURRENCY) {
      const batch = uniqueNames.slice(i, i + CONCURRENCY);
      const results = await Promise.all(batch.map(n => testProxy(n)));
      for (const result of results) {
        if (result.delay !== null) {
          const idx = indexMap.get(result.name);
          if (idx !== undefined) alive.push(proxies[idx]);
        }
      }
      tested += batch.length;
      const pct = Math.round((tested / uniqueNames.length) * 100);
      process.stdout.write(`\r  测试进度: ${tested}/${uniqueNames.length} (${pct}%)  存活: ${alive.length}`);
    }
    process.stdout.write('\n');
    return alive;
  } finally {
    stopMihomo(child);
  }
}

const COUNTRY_FLAGS: Record<string, string> = {
  HK: '🇭🇰', JP: '🇯🇵', US: '🇺🇸', TW: '🇨🇳', SG: '🇸🇬', KR: '🇰🇷',
};

const BEST1_LIMITS: Record<string, number> = { HK: 50, US: 30 };
const BEST1_DEFAULT_LIMIT = 20;

function parseSpeed(name: string): number {
  const m = name.match(/(\d+(?:\.\d+)?)\s*(MB|KB)\/s/);
  if (!m) return 0;
  const val = parseFloat(m[1]);
  return m[2] === 'KB' ? val / 1024 : val;
}

function parseLossRate(name: string): number {
  const m = name.match(/\|(\d+)%/);
  return m ? parseInt(m[1], 10) : -1;
}

function countTags(name: string): number {
  const tags = name.match(/\|(?:GPT⁺?|GM|YT)/g) ?? [];
  let score = tags.length;
  if (name.includes('GPT⁺')) score += 0.5;
  return score;
}

function sortScore(name: string): number {
  const speed = parseSpeed(name);
  if (speed > 0) return 100000 + speed;
  const mult = parseMultiplier(name);
  const base = mult === 2 ? 20000 : 10000;
  const loss = parseLossRate(name);
  const lossScore = loss >= 0 ? (100 - loss) * 10 : 0;
  const tagScore = countTags(name);
  return base + lossScore + tagScore;
}

function extractTags(name: string): string {
  const speed = name.match(/\|⬇?[\d.]+\s*[MK]B\/s/)?.[0] ?? '';
  const mult = parseMultiplier(name);
  const multStr = mult > 0 ? `|x${mult}` : '';
  const loss = name.match(/\|(\d+)%/);
  const lossStr = loss ? `|${loss[1]}%` : '';
  return `${speed}${multStr}${lossStr}`;
}

function topByCountry(proxies: Proxy[], limits?: Record<string, number>, defaultLimit?: number): Proxy[] {
  const groups = new Map<string, Proxy[]>();
  for (const p of proxies) {
    const code = extractCountryCode(p.name) ?? '??';
    if (!groups.has(code)) groups.set(code, []);
    groups.get(code)!.push(p);
  }
  const result: Proxy[] = [];
  for (const [code, members] of groups) {
    members.sort((a, b) => sortScore(b.name) - sortScore(a.name));
    let top: Proxy[];
    if (limits && defaultLimit !== undefined) {
      const limit = limits[code] ?? defaultLimit;
      top = members.slice(0, limit);
    } else {
      top = members;
    }
    for (let i = 0; i < top.length; i++) {
      const flag = COUNTRY_FLAGS[code] ?? '';
      const tags = extractTags(top[i].name);
      top[i].name = `${flag}${code}_${i + 1}${tags}`;
    }
    result.push(...top);
  }
  return result;
}

async function main() {
  const binary = findMihomoBinary();
  console.log(`使用内核: ${binary}`);

  ensureTempDir();

  try {
    const categories: Array<{ name: string; file: string; limits?: Record<string, number>; defaultLimit?: number }> = [
      { name: '全部', file: 'all-raw.yaml' },
      { name: 'ACL4SSR', file: 'acl4ssr-raw.yaml' },
      { name: 'freeSub', file: 'freesub-raw.yaml' },
      { name: 'best1', file: 'best1-raw.yaml', limits: BEST1_LIMITS, defaultLimit: BEST1_DEFAULT_LIMIT },
      { name: 'best2', file: 'best2-raw.yaml', limits: {} },
    ];

    console.log(`\nbest Top 筛选\n`);

    for (const cat of categories) {
      const filePath = path.join(DATA_DIR, cat.file);
      let proxies = readYaml<{ proxies: Proxy[] }>(filePath).proxies;
      console.log(`${cat.name}节点 (${proxies.length}):`);
      if (cat.limits) {
        const before = proxies.length;
        proxies = topByCountry(proxies, cat.limits, cat.defaultLimit);
        console.log(`  Top 筛选: ${proxies.length}/${before}`);
      }
      writeYaml(filePath, { proxies });
    }

    console.log(`\n已更新 data/ 目录`);
  } finally {
    cleanupTempDir();
  }
}

main();
