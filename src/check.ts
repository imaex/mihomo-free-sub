import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import yaml from 'js-yaml';

import type { Proxy } from './types.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const TEMP_DIR = path.join(ROOT, '.check-tmp');

const TIMEOUT = 2000;
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
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
}

function cleanupTempDir(): void {
  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  }
}

function buildConfig(proxies: Proxy[]): string {
  const nameCount = new Map<string, number>();
  const namedProxies = proxies.map(p => {
    const count = (nameCount.get(p.name) || 0) + 1;
    nameCount.set(p.name, count);
    const uniqueName = count > 1 ? `${p.name}_${count}` : p.name;
    return { ...p, name: uniqueName };
  });

  const config = {
    'allow-lan': false,
    'external-controller': `127.0.0.1:${API_PORT}`,
    'log-level': 'error',
    proxies: namedProxies,
    'proxy-groups': [
      {
        name: 'PROXY',
        type: 'select',
        proxies: namedProxies.map(p => p.name),
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

  const nameCount = new Map<string, number>();
  const nameMap = new Map<string, number>(); // uniqueName -> original index
  const uniqueNames: string[] = [];

  for (let i = 0; i < proxies.length; i++) {
    const p = proxies[i];
    const count = (nameCount.get(p.name) || 0) + 1;
    nameCount.set(p.name, count);
    const uniqueName = count > 1 ? `${p.name}_${count}` : p.name;
    uniqueNames.push(uniqueName);
    nameMap.set(uniqueName, i);
  }

  const configContent = buildConfig(proxies);
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
          const idx = nameMap.get(result.name);
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

function readYaml<T>(filePath: string): T {
  return yaml.load(fs.readFileSync(filePath, 'utf-8')) as T;
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
  const binary = findMihomoBinary();
  console.log(`使用内核: ${binary}`);

  ensureTempDir();

  try {
    const categories = [
      { name: '全部', file: 'all-raw.yaml' },
      { name: 'ACL4SSR', file: 'acl4ssr-raw.yaml' },
      { name: 'freeSub', file: 'freesub-raw.yaml' },
    ];

    console.log(`\n协议握手测试 (超时 ${TIMEOUT}ms, 并发 ${CONCURRENCY})\n`);

    for (const cat of categories) {
      const filePath = path.join(DATA_DIR, cat.file);
      const proxies = readYaml<{ proxies: Proxy[] }>(filePath).proxies;
      console.log(`${cat.name}节点 (${proxies.length}):`);
      const alive = await testBatch(proxies, binary);
      console.log(`  结果: ${alive.length}/${proxies.length} (${Math.round((alive.length / (proxies.length || 1)) * 100)}%)`);
      writeYaml(filePath, { proxies: alive });
    }

    console.log(`\n已更新 data/ 目录（仅保留存活节点）`);
  } finally {
    cleanupTempDir();
  }
}

main();
