import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import yaml from 'js-yaml';

import { sources } from './sources.js';
import type { Proxy, ParsedConfig } from './types.js';
import { ROOT } from './utils.js';

const GH_PROXY = 'https://v6.gh-proxy.org';
const GH_RAW = 'https://raw.githubusercontent.com';

const TEMP_DIR = path.join(ROOT, '.bench-tmp');
const TIMEOUT = 1500;
const CONCURRENCY = 100;
const API_PORT = 29090;
const API_BASE = `http://127.0.0.1:${API_PORT}`;
const TEST_URL = 'http://www.gstatic.com/generate_204';

const c = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  gray: (s: string) => `\x1b[90m${s}\x1b[0m`,
};

interface DownloadedSource {
  name: string;
  proxies: Proxy[];
  proxyGroups: number;
  error?: string;
}

interface SourceResult {
  name: string;
  downloadOk: boolean;
  downloadError?: string;
  totalProxies: number;
  proxyGroups: number;
  alive: number;
  dead: number;
  avgDelay: number;
  minDelay: number;
  medianDelay: number;
}

function proxyUrl(url: string): string {
  return url.replace(GH_RAW, `${GH_PROXY}/raw.githubusercontent.com`);
}

async function downloadSource(source: { name: string; url: string }): Promise<DownloadedSource> {
  const entry: DownloadedSource = { name: source.name, proxies: [], proxyGroups: 0 };
  try {
    const res = await fetch(proxyUrl(source.url), {
      signal: AbortSignal.timeout(30_000),
      headers: { 'User-Agent': 'clash.meta' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (!text.trim()) throw new Error('内容为空');

    const config = yaml.load(text) as ParsedConfig;
    if (!config?.proxies?.length) throw new Error('无节点');

    if (config['proxy-groups']) {
      entry.proxyGroups = (config['proxy-groups'] as unknown[]).length;
    }
    entry.proxies = config.proxies.map(p => ({ ...p, name: `[${source.name}] ${p.name}` }));
  } catch (e) {
    entry.error = (e as Error).message;
  }
  return entry;
}

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

function deduplicateNames(proxies: Proxy[]): Proxy[] {
  const nameCount = new Map<string, number>();
  return proxies.map(p => {
    const count = (nameCount.get(p.name) || 0) + 1;
    nameCount.set(p.name, count);
    return count > 1 ? { ...p, name: `${p.name} #${count}` } : p;
  });
}

function buildConfig(proxies: Proxy[]): string {
  const config = {
    'mixed-port': 17890,
    'allow-lan': false,
    'external-controller': `127.0.0.1:${API_PORT}`,
    'log-level': 'error',
    'geodata-mode': true,
    proxies,
    'proxy-groups': [{ name: 'PROXY', type: 'select', proxies: proxies.map(p => p.name) }],
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
    } catch { /* not ready */ }
    if (child.exitCode !== null) {
      const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8').slice(-500) : '';
      throw new Error(`mihomo 启动失败\n${log}`);
    }
  }
  throw new Error('mihomo 启动超时');
}

function stopMihomo(child: ChildProcess): void {
  try { if (child.pid) process.kill(child.pid, 'SIGTERM'); } catch { /* already dead */ }
}

async function testProxy(name: string): Promise<{ name: string; delay: number | null }> {
  const url = `${API_BASE}/proxies/${encodeURIComponent(name)}/delay?timeout=${TIMEOUT}&url=${encodeURIComponent(TEST_URL)}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT + 3000) });
    const data = (await res.json()) as { delay?: number; message?: string };
    return { name, delay: data.delay && data.delay > 0 ? data.delay : null };
  } catch {
    return { name, delay: null };
  }
}

function computeResult(
  source: DownloadedSource,
  resultsByName: Map<string, number | null>,
  originalToDeduped: Map<Proxy, string>,
): SourceResult {
  const delays: number[] = [];
  for (const p of source.proxies) {
    const dedupedName = originalToDeduped.get(p);
    if (!dedupedName) continue;
    const d = resultsByName.get(dedupedName);
    if (d !== undefined && d !== null) delays.push(d);
  }
  const alive = delays.length;
  const dead = source.proxies.length - alive;

  if (alive === 0) {
    return {
      name: source.name, downloadOk: !source.error, downloadError: source.error,
      totalProxies: source.proxies.length, proxyGroups: source.proxyGroups,
      alive: 0, dead, avgDelay: 0, minDelay: 0, medianDelay: 0,
    };
  }

  delays.sort((a, b) => a - b);
  return {
    name: source.name, downloadOk: true,
    totalProxies: source.proxies.length, proxyGroups: source.proxyGroups,
    alive, dead,
    avgDelay: Math.round(delays.reduce((s, d) => s + d, 0) / alive),
    minDelay: delays[0],
    medianDelay: delays[Math.floor(delays.length / 2)],
  };
}

function formatSourceName(name: string, sourceOrder: Map<string, number>): string {
  return `${String((sourceOrder.get(name) ?? 0) + 1).padStart(2, '0')}-${name}`;
}

function printRanking(results: SourceResult[], sourceOrder: Map<string, number>): void {
  const valid = results
    .filter(r => r.downloadOk && r.alive > 0)
    .sort((a, b) => {
      const rateA = a.alive / a.totalProxies;
      const rateB = b.alive / b.totalProxies;
      if (Math.abs(rateA - rateB) > 0.1) return rateB - rateA;
      return a.medianDelay - b.medianDelay;
    });

  if (valid.length === 0) {
    console.log(c.yellow('没有可用的订阅源'));
    return;
  }

  console.log(c.cyan('排名:\n'));

  const namedResults = valid.map(r => ({
    ...r, displayName: formatSourceName(r.name, sourceOrder),
  }));

  const nameWidth = Math.max(12, ...namedResults.map(r => r.displayName.length));
  const pad = (s: string, w: number) => s + ' '.repeat(Math.max(0, w - s.length));

  console.log(
    `  ${'#'.padStart(3)}  ${pad('名称', nameWidth)}  ${pad('存活率', 8)}  ${pad('存活', 6)}  ${pad('总数', 6)}  ${pad('分组', 6)}  ${pad('中位', 7)}  ${pad('平均', 7)}`,
  );
  console.log(
    `  ${'─'.repeat(3)}  ${'─'.repeat(nameWidth)}  ${'─'.repeat(8)}  ${'─'.repeat(6)}  ${'─'.repeat(6)}  ${'─'.repeat(6)}  ${'─'.repeat(7)}  ${'─'.repeat(7)}`,
  );

  for (let i = 0; i < namedResults.length; i++) {
    const r = namedResults[i];
    const rate = ((r.alive / r.totalProxies) * 100).toFixed(1);
    const rateColor = r.alive / r.totalProxies > 0.3 ? c.green : c.yellow;
    const groups = r.proxyGroups > 0 ? String(r.proxyGroups) : '-';
    console.log(
      `  ${String(i + 1).padStart(3)}  ${r.displayName.padEnd(nameWidth)}  ${rateColor(pad(`${rate}%`, 8))}  ${String(r.alive).padEnd(6)}  ${String(r.totalProxies).padEnd(6)}  ${groups.padEnd(6)}  ${pad(`${r.medianDelay}ms`, 7)}  ${pad(`${r.avgDelay}ms`, 7)}`,
    );
  }

  console.log('');

  const failed = results.filter(r => !r.downloadOk);
  const noAlive = results.filter(r => r.downloadOk && r.alive === 0);
  if (failed.length > 0) {
    const names = failed.map(r => formatSourceName(r.name, sourceOrder));
    console.log(c.gray(`下载失败: ${names.join(', ')}`));
  }
  if (noAlive.length > 0) {
    const names = noAlive.map(r => formatSourceName(r.name, sourceOrder));
    console.log(c.gray(`无存活节点: ${names.join(', ')}`));
  }
}

async function main() {
  const binary = findMihomoBinary();
  console.log(`使用内核: ${binary}`);

  const sourceOrder = new Map(sources.map((s, i) => [s.name, i]));

  console.log(c.cyan(`\n基准测试 ${sources.length} 个免费订阅源`));
  console.log(`超时: ${TIMEOUT}ms  并发: ${CONCURRENCY}\n`);

  fs.mkdirSync(TEMP_DIR, { recursive: true });
  let child: ChildProcess | null = null;

  try {
    console.log(c.cyan('下载订阅...'));
    const downloaded = await Promise.all(sources.map(s => downloadSource(s)));
    for (const d of downloaded) {
      const label = formatSourceName(d.name, sourceOrder);
      if (d.error) {
        console.log(`  ${c.red('✗')} ${label}: ${c.gray(d.error)}`);
      } else {
        const groupsInfo = d.proxyGroups > 0 ? ` ${d.proxyGroups}组` : '';
        console.log(`  ${c.green('✓')} ${label}: ${d.proxies.length} 个节点${groupsInfo}`);
      }
    }

    const allProxies = downloaded.flatMap(d => d.proxies);
    const successCount = downloaded.filter(d => d.proxies.length > 0).length;

    if (allProxies.length === 0) {
      console.log(c.red('\n所有订阅源下载失败或无节点'));
      return;
    }

    console.log(`\n共 ${allProxies.length} 个节点，来自 ${successCount} 个源\n`);

    const dedupedProxies = deduplicateNames(allProxies);
    const originalToDeduped = new Map<Proxy, string>();
    for (let i = 0; i < allProxies.length; i++) {
      originalToDeduped.set(allProxies[i], dedupedProxies[i].name);
    }
    const configContent = buildConfig(dedupedProxies);
    const configPath = path.join(TEMP_DIR, 'config.yaml');
    fs.writeFileSync(configPath, configContent, 'utf-8');

    console.log(c.cyan('启动测试实例...'));
    child = await startMihomo(configPath, binary);
    console.log(`${c.green('已启动')} (端口 17890/${API_PORT})\n`);

    console.log(c.cyan('测试节点延迟...'));
    const allNames = dedupedProxies.map(p => p.name);
    const resultsByName = new Map<string, number | null>();
    let tested = 0;
    let aliveCount = 0;

    for (let i = 0; i < allNames.length; i += CONCURRENCY) {
      const batch = allNames.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(batch.map(n => testProxy(n)));
      for (const r of batchResults) {
        resultsByName.set(r.name, r.delay);
        if (r.delay !== null) aliveCount++;
      }
      tested += batch.length;
      const pct = ((tested / allNames.length) * 100).toFixed(0);
      process.stdout.write(`\r  进度 ${pct}%  已测 ${tested}/${allNames.length}  存活 ${c.green(String(aliveCount))}`);
    }
    process.stdout.write(`\r${' '.repeat(80)}\r`);
    console.log(`测试完成: ${c.green(String(aliveCount))} 存活 / ${allNames.length - aliveCount} 超时 / ${allNames.length} 总计\n`);

    const results = downloaded.map(d => computeResult(d, resultsByName, originalToDeduped));
    printRanking(results, sourceOrder);
  } finally {
    if (child) stopMihomo(child);
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  }
}

main();
