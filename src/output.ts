import fs from 'node:fs';
import path from 'node:path';

import yaml from 'js-yaml';

import type { ParsedConfig, Proxy } from './types.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const OUTPUT_DIR = path.join(ROOT, 'output');

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

function main() {
  // read subs-check output (tested nodes)
  const testedPath = path.join(DATA_DIR, 'tested.yaml');
  const rawPath = path.join(DATA_DIR, 'all-raw.yaml');

  // use tested nodes if subs-check was run, otherwise fall back to raw
  const sourcePath = fs.existsSync(testedPath) ? testedPath : rawPath;
  const tested = readYaml<{ proxies: Proxy[] }>(sourcePath);
  const aliveNames = new Set(tested.proxies.map(p => p.name));

  console.log(`存活节点: ${tested.proxies.length}`);

  // read category map
  const categoryMap: Record<string, string> = JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, 'category-map.json'), 'utf-8'),
  );

  // split by category
  const acl4ssrProxies: Proxy[] = [];
  const freesubProxies: Proxy[] = [];

  for (const proxy of tested.proxies) {
    const cat = categoryMap[proxy.name];
    if (cat === 'acl4ssr') acl4ssrProxies.push(proxy);
    else if (cat === 'freesub') freesubProxies.push(proxy);
  }

  console.log(`ACL4SSR: ${acl4ssrProxies.length}, freeSub: ${freesubProxies.length}, 全部: ${tested.proxies.length}`);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // read templates
  const acl4ssrTemplatePath = path.join(DATA_DIR, 'template-acl4ssr.yaml');
  const freesubTemplatePath = path.join(DATA_DIR, 'template-freesub.yaml');

  // ACL4SSR full config
  if (fs.existsSync(acl4ssrTemplatePath) && acl4ssrProxies.length > 0) {
    const template = readYaml<ParsedConfig>(acl4ssrTemplatePath);
    const config: Record<string, unknown> = {
      proxies: acl4ssrProxies,
      'proxy-groups': template['proxy-groups'],
      rules: template.rules,
      'rule-providers': template['rule-providers'],
      dns: template.dns,
    };
    writeYaml(path.join(OUTPUT_DIR, 'acl4ssr.yaml'), config);
    console.log(`已写入 output/acl4ssr.yaml (${acl4ssrProxies.length} 节点)`);
  }

  // ACL4SSR nodes only
  if (acl4ssrProxies.length > 0) {
    writeYaml(path.join(OUTPUT_DIR, 'acl4ssr-nodes.yaml'), { proxies: acl4ssrProxies });
    console.log(`已写入 output/acl4ssr-nodes.yaml`);
  }

  // freeSub full config
  if (fs.existsSync(freesubTemplatePath) && freesubProxies.length > 0) {
    const template = readYaml<ParsedConfig>(freesubTemplatePath);
    const config: Record<string, unknown> = {
      proxies: freesubProxies,
      'proxy-groups': template['proxy-groups'],
      rules: template.rules,
      'rule-providers': template['rule-providers'],
      dns: template.dns,
    };
    writeYaml(path.join(OUTPUT_DIR, 'freesub.yaml'), config);
    console.log(`已写入 output/freesub.yaml (${freesubProxies.length} 节点)`);
  }

  // freeSub nodes only
  if (freesubProxies.length > 0) {
    writeYaml(path.join(OUTPUT_DIR, 'freesub-nodes.yaml'), { proxies: freesubProxies });
    console.log(`已写入 output/freesub-nodes.yaml`);
  }

  // all nodes
  writeYaml(path.join(OUTPUT_DIR, 'all-nodes.yaml'), { proxies: tested.proxies });
  console.log(`已写入 output/all-nodes.yaml (${tested.proxies.length} 节点)`);

  // write timestamp
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'updated.txt'),
    new Date().toISOString(),
    'utf-8',
  );
}

main();
