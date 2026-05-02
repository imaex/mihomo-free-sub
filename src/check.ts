import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';

import yaml from 'js-yaml';

import type { Proxy } from './types.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const TIMEOUT = 3000;
const CONCURRENCY = 100;

function tcpCheck(host: string, port: number): Promise<boolean> {
  return new Promise(resolve => {
    const socket = new net.Socket();
    socket.setTimeout(TIMEOUT);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
    socket.once('error', () => { socket.destroy(); resolve(false); });
    socket.connect(port, host);
  });
}

async function checkBatch(proxies: Proxy[], concurrency: number): Promise<Proxy[]> {
  const alive: Proxy[] = [];
  let tested = 0;

  for (let i = 0; i < proxies.length; i += concurrency) {
    const batch = proxies.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map(p => tcpCheck(p.server, p.port)),
    );
    for (let j = 0; j < batch.length; j++) {
      if (results[j]) alive.push(batch[j]);
    }
    tested += batch.length;
    const pct = Math.round((tested / proxies.length) * 100);
    process.stdout.write(`\r  测试进度: ${tested}/${proxies.length} (${pct}%)  存活: ${alive.length}`);
  }
  process.stdout.write('\n');
  return alive;
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
  const allProxies = readYaml<{ proxies: Proxy[] }>(path.join(DATA_DIR, 'all-raw.yaml')).proxies;
  const acl4ssrProxies = readYaml<{ proxies: Proxy[] }>(path.join(DATA_DIR, 'acl4ssr-raw.yaml')).proxies;
  const freesubProxies = readYaml<{ proxies: Proxy[] }>(path.join(DATA_DIR, 'freesub-raw.yaml')).proxies;

  console.log(`TCP 连通性测试 (超时 ${TIMEOUT}ms, 并发 ${CONCURRENCY})\n`);

  console.log(`全部节点 (${allProxies.length}):`);
  const allAlive = await checkBatch(allProxies, CONCURRENCY);

  console.log(`ACL4SSR 节点 (${acl4ssrProxies.length}):`);
  const acl4ssrAlive = await checkBatch(acl4ssrProxies, CONCURRENCY);

  console.log(`freeSub 节点 (${freesubProxies.length}):`);
  const freesubAlive = await checkBatch(freesubProxies, CONCURRENCY);

  console.log(`\n结果:`);
  console.log(`  全部: ${allAlive.length}/${allProxies.length} (${Math.round(allAlive.length / allProxies.length * 100)}%)`);
  console.log(`  ACL4SSR: ${acl4ssrAlive.length}/${acl4ssrProxies.length} (${Math.round(acl4ssrAlive.length / acl4ssrProxies.length * 100)}%)`);
  console.log(`  freeSub: ${freesubAlive.length}/${freesubProxies.length} (${Math.round(freesubAlive.length / freesubProxies.length * 100)}%)`);

  // overwrite raw files with alive-only
  writeYaml(path.join(DATA_DIR, 'all-raw.yaml'), { proxies: allAlive });
  writeYaml(path.join(DATA_DIR, 'acl4ssr-raw.yaml'), { proxies: acl4ssrAlive });
  writeYaml(path.join(DATA_DIR, 'freesub-raw.yaml'), { proxies: freesubAlive });

  console.log(`\n已更新 data/ 目录（仅保留存活节点）`);
}

main();
