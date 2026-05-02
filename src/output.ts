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
  const acl4ssrProxies = readYaml<{ proxies: Proxy[] }>(path.join(DATA_DIR, 'acl4ssr-raw.yaml')).proxies;
  const freesubProxies = readYaml<{ proxies: Proxy[] }>(path.join(DATA_DIR, 'freesub-raw.yaml')).proxies;
  const allProxies = readYaml<{ proxies: Proxy[] }>(path.join(DATA_DIR, 'all-raw.yaml')).proxies;

  console.log(`ACL4SSR: ${acl4ssrProxies.length}, freeSub: ${freesubProxies.length}, 全部: ${allProxies.length}`);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // ACL4SSR full config
  const acl4ssrTemplatePath = path.join(DATA_DIR, 'template-acl4ssr.yaml');
  if (fs.existsSync(acl4ssrTemplatePath) && acl4ssrProxies.length > 0) {
    const template = readYaml<ParsedConfig>(acl4ssrTemplatePath);
    writeYaml(path.join(OUTPUT_DIR, 'acl4ssr.yaml'), {
      proxies: acl4ssrProxies,
      'proxy-groups': template['proxy-groups'],
      rules: template.rules,
      'rule-providers': template['rule-providers'],
      dns: template.dns,
    });
    console.log(`已写入 output/acl4ssr.yaml (${acl4ssrProxies.length} 节点)`);
  }

  // ACL4SSR nodes only
  if (acl4ssrProxies.length > 0) {
    writeYaml(path.join(OUTPUT_DIR, 'acl4ssr-nodes.yaml'), { proxies: acl4ssrProxies });
    console.log(`已写入 output/acl4ssr-nodes.yaml`);
  }

  // freeSub full config
  const freesubTemplatePath = path.join(DATA_DIR, 'template-freesub.yaml');
  if (fs.existsSync(freesubTemplatePath) && freesubProxies.length > 0) {
    const template = readYaml<ParsedConfig>(freesubTemplatePath);
    writeYaml(path.join(OUTPUT_DIR, 'freesub.yaml'), {
      proxies: freesubProxies,
      'proxy-groups': template['proxy-groups'],
      rules: template.rules,
      'rule-providers': template['rule-providers'],
      dns: template.dns,
    });
    console.log(`已写入 output/freesub.yaml (${freesubProxies.length} 节点)`);
  }

  // freeSub nodes only
  if (freesubProxies.length > 0) {
    writeYaml(path.join(OUTPUT_DIR, 'freesub-nodes.yaml'), { proxies: freesubProxies });
    console.log(`已写入 output/freesub-nodes.yaml`);
  }

  // all nodes
  writeYaml(path.join(OUTPUT_DIR, 'all-nodes.yaml'), { proxies: allProxies });
  console.log(`已写入 output/all-nodes.yaml (${allProxies.length} 节点)`);

  // timestamp
  fs.writeFileSync(path.join(OUTPUT_DIR, 'updated.txt'), new Date().toISOString(), 'utf-8');
}

main();
