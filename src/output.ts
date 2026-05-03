import fs from 'node:fs';
import path from 'node:path';

import type { ParsedConfig, Proxy } from './types.js';
import { DATA_DIR, readYaml, ROOT, writeYaml } from './utils.js';

const OUTPUT_DIR = path.join(ROOT, 'output');

// --- sing-box conversion ---

type SingboxOutbound = Record<string, unknown>;

function buildTls(p: Proxy): Record<string, unknown> | undefined {
  const sni = p.sni || p.servername;
  const hasTls = p.tls === true || p['reality-opts'] || p.type === 'trojan' || p.type === 'hysteria2' || p.type === 'tuic';
  if (!hasTls) return undefined;

  const tls: Record<string, unknown> = { enabled: true };
  if (sni) tls.server_name = sni;
  if (p['skip-cert-verify']) tls.insecure = true;
  if (p.alpn) {
    tls.alpn = Array.isArray(p.alpn) ? p.alpn : [p.alpn];
  }
  if (p['client-fingerprint']) {
    tls.utls = { enabled: true, fingerprint: p['client-fingerprint'] };
  }
  const realityOpts = p['reality-opts'] as Record<string, unknown> | undefined;
  if (realityOpts) {
    tls.reality = {
      enabled: true,
      public_key: realityOpts['public-key'],
      short_id: realityOpts['short-id'] || '',
    };
  }
  return tls;
}

function buildTransport(p: Proxy): Record<string, unknown> | undefined {
  const network = p.network as string | undefined;
  if (!network || network === 'tcp') return undefined;

  if (network === 'ws') {
    const wsOpts = (p['ws-opts'] || {}) as Record<string, unknown>;
    const transport: Record<string, unknown> = { type: 'ws' };
    if (wsOpts.path) transport.path = wsOpts.path;
    if (wsOpts.headers) transport.headers = wsOpts.headers;
    return transport;
  }

  if (network === 'grpc') {
    const grpcOpts = (p['grpc-opts'] || {}) as Record<string, unknown>;
    return { type: 'grpc', service_name: grpcOpts['grpc-service-name'] || '' };
  }

  if (network === 'h2' || network === 'http') {
    const opts = (p['h2-opts'] || p['http-opts'] || {}) as Record<string, unknown>;
    const transport: Record<string, unknown> = { type: 'http' };
    if (opts.path) transport.path = Array.isArray(opts.path) ? opts.path[0] : opts.path;
    if (opts.host) transport.host = Array.isArray(opts.host) ? opts.host : [opts.host];
    return transport;
  }

  return undefined;
}

function convertVmess(p: Proxy): SingboxOutbound {
  const out: SingboxOutbound = {
    type: 'vmess',
    tag: p.name,
    server: p.server,
    server_port: p.port,
    uuid: p.uuid,
    security: p.cipher || 'auto',
    alter_id: p.alterId || 0,
  };
  const tls = buildTls(p);
  if (tls) out.tls = tls;
  const transport = buildTransport(p);
  if (transport) out.transport = transport;
  return out;
}

function convertVless(p: Proxy): SingboxOutbound {
  const out: SingboxOutbound = {
    type: 'vless',
    tag: p.name,
    server: p.server,
    server_port: p.port,
    uuid: p.uuid,
    flow: p.flow || '',
  };
  const tls = buildTls(p);
  if (tls) out.tls = tls;
  const transport = buildTransport(p);
  if (transport) out.transport = transport;
  if (!out.flow) delete out.flow;
  return out;
}

function convertSs(p: Proxy): SingboxOutbound {
  const out: SingboxOutbound = {
    type: 'shadowsocks',
    tag: p.name,
    server: p.server,
    server_port: p.port,
    method: p.cipher,
    password: p.password,
  };
  if (p.plugin) {
    const pluginName = p.plugin === 'obfs' ? 'obfs-local' : String(p.plugin);
    out.plugin = pluginName;
    const opts = p['plugin-opts'] as Record<string, unknown> | undefined;
    if (opts) {
      const parts: string[] = [];
      if (pluginName === 'obfs-local') {
        if (opts.mode) parts.push(`obfs=${opts.mode}`);
        if (opts.host) parts.push(`obfs-host=${opts.host}`);
      } else if (pluginName === 'v2ray-plugin') {
        if (opts.tls) parts.push('tls');
        if (opts.mode) parts.push(`mode=${opts.mode}`);
        if (opts.host) parts.push(`host=${opts.host}`);
        if (opts.path) parts.push(`path=${opts.path}`);
      }
      if (parts.length > 0) out.plugin_opts = parts.join(';');
    }
  }
  return out;
}

function convertTrojan(p: Proxy): SingboxOutbound {
  const out: SingboxOutbound = {
    type: 'trojan',
    tag: p.name,
    server: p.server,
    server_port: p.port,
    password: p.password,
  };
  const tls = buildTls(p);
  if (tls) out.tls = tls;
  const transport = buildTransport(p);
  if (transport) out.transport = transport;
  return out;
}

function convertHysteria2(p: Proxy): SingboxOutbound {
  const out: SingboxOutbound = {
    type: 'hysteria2',
    tag: p.name,
    server: p.server,
    server_port: p.port,
    password: p.password || p.auth,
  };
  if (p.up) out.up_mbps = parseInt(String(p.up), 10) || undefined;
  if (p.down) out.down_mbps = parseInt(String(p.down), 10) || undefined;
  if (p['obfs-password']) {
    out.obfs = { type: 'salamander', password: p['obfs-password'] };
  }
  const tls = buildTls(p);
  if (tls) out.tls = tls;
  return out;
}

function convertTuic(p: Proxy): SingboxOutbound {
  const out: SingboxOutbound = {
    type: 'tuic',
    tag: p.name,
    server: p.server,
    server_port: p.port,
    uuid: p.uuid,
    password: p.password,
    congestion_control: p['congestion-controller'] || 'bbr',
  };
  if (p['udp-relay-mode']) out.udp_relay_mode = p['udp-relay-mode'];
  if (p['reduce-rtt']) out.reduce_rtt = true;
  const tls = buildTls(p);
  if (tls) out.tls = tls;
  return out;
}

function convertHttp(p: Proxy): SingboxOutbound {
  const out: SingboxOutbound = {
    type: 'http',
    tag: p.name,
    server: p.server,
    server_port: p.port,
  };
  if (p.username) out.username = p.username;
  if (p.password) out.password = p.password;
  if (p.tls) {
    out.tls = { enabled: true, server_name: p.sni || p.server };
  }
  return out;
}

function convertSocks5(p: Proxy): SingboxOutbound {
  const out: SingboxOutbound = {
    type: 'socks',
    tag: p.name,
    server: p.server,
    server_port: p.port,
  };
  if (p.username) out.username = p.username;
  if (p.password) out.password = p.password;
  return out;
}

function convertProxy(p: Proxy): SingboxOutbound | null {
  switch (p.type) {
    case 'vmess': return convertVmess(p);
    case 'vless': return convertVless(p);
    case 'ss': return convertSs(p);
    case 'trojan': return convertTrojan(p);
    case 'hysteria2': return convertHysteria2(p);
    case 'tuic': return convertTuic(p);
    case 'http': return convertHttp(p);
    case 'socks5': return convertSocks5(p);
    default: return null;
  }
}

const COUNTRY_GROUPS: Array<{ tag: string; re: RegExp }> = [
  { tag: '🇭🇰 香港', re: /HK_\d+/ },
  { tag: '🇯🇵 日本', re: /JP_\d+/ },
  { tag: '🇺🇸 美国', re: /US_\d+/ },
  { tag: '🇨🇳 台湾', re: /TW_\d+/ },
  { tag: '🇸🇬 新加坡', re: /SG_\d+/ },
  { tag: '🇰🇷 韩国', re: /KR_\d+/ },
];

function mihomoToSingbox(proxies: Proxy[]): Record<string, unknown> {
  const outbounds: SingboxOutbound[] = [];
  const allTags: string[] = [];

  for (const p of proxies) {
    const converted = convertProxy(p);
    if (converted) {
      outbounds.push(converted);
      allTags.push(converted.tag as string);
    }
  }

  const countryGroups: SingboxOutbound[] = [];
  const groupTags: string[] = [];

  for (const { tag, re } of COUNTRY_GROUPS) {
    const members = allTags.filter(t => re.test(t));
    if (members.length === 0) continue;
    countryGroups.push({
      type: 'urltest',
      tag,
      outbounds: members,
      url: 'https://www.gstatic.com/generate_204',
      interval: '3m',
      tolerance: 50,
    });
    groupTags.push(tag);
  }

  const autoGroup: SingboxOutbound = {
    type: 'urltest',
    tag: 'auto',
    outbounds: allTags,
    url: 'https://www.gstatic.com/generate_204',
    interval: '3m',
    tolerance: 50,
  };

  const selector: SingboxOutbound = {
    type: 'selector',
    tag: 'proxy',
    outbounds: ['auto', ...groupTags, ...allTags, 'direct'],
    default: 'auto',
  };

  return {
    log: { level: 'error', timestamp: true },
    experimental: {
      cache_file: { enabled: true, path: 'cache.db', store_fakeip: true, store_rdrc: true },
    },
    dns: {
      servers: [
        { tag: 'dns_proxy', address: 'https://1.1.1.1/dns-query', address_resolver: 'dns_resolver', strategy: 'ipv4_only', detour: 'proxy' },
        { tag: 'dns_direct', address: 'https://dns.alidns.com/dns-query', address_resolver: 'dns_resolver', strategy: 'ipv4_only', detour: 'direct' },
        { tag: 'dns_resolver', address: '223.5.5.5', detour: 'direct' },
        { tag: 'dns_block', address: 'rcode://success' },
      ],
      rules: [
        { outbound: 'any', server: 'dns_resolver' },
        { rule_set: 'geosite-cn', server: 'dns_direct' },
        { rule_set: 'geosite-geolocation-!cn', server: 'dns_proxy' },
      ],
      final: 'dns_direct',
      independent_cache: true,
    },
    inbounds: [
      {
        type: 'tun',
        tag: 'tun-in',
        inet4_address: '172.19.0.1/30',
        auto_route: true,
        strict_route: true,
        stack: 'system',
        sniff: true,
      },
    ],
    outbounds: [
      selector,
      autoGroup,
      ...countryGroups,
      { type: 'direct', tag: 'direct' },
      { type: 'block', tag: 'block' },
      { type: 'dns', tag: 'dns-out' },
      ...outbounds,
    ],
    route: {
      rules: [
        { protocol: 'dns', outbound: 'dns-out' },
        { ip_is_private: true, outbound: 'direct' },
        { rule_set: 'geosite-category-ads-all', outbound: 'block' },
        { rule_set: 'geosite-cn', outbound: 'direct' },
        { rule_set: 'geoip-cn', outbound: 'direct' },
        { rule_set: 'geosite-geolocation-!cn', outbound: 'proxy' },
      ],
      rule_set: [
        { tag: 'geosite-cn', type: 'remote', format: 'binary', url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo/geosite/cn.srs', download_detour: 'direct' },
        { tag: 'geosite-geolocation-!cn', type: 'remote', format: 'binary', url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo/geosite/geolocation-!cn.srs', download_detour: 'direct' },
        { tag: 'geosite-category-ads-all', type: 'remote', format: 'binary', url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo/geosite/category-ads-all.srs', download_detour: 'direct' },
        { tag: 'geoip-cn', type: 'remote', format: 'binary', url: 'https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo/geoip/cn.srs', download_detour: 'direct' },
      ],
      auto_detect_interface: true,
      final: 'proxy',
    },
  };
}

function fixAiName(s: string): string {
  return s.replace('💬 Ai平台', '💬 AI平台').replace('💬 OpenAi', '💬 AI平台');
}

function fixAiGroupName(groups: Record<string, unknown>[]): Record<string, unknown>[] {
  return groups.map(g => ({ ...g, name: fixAiName(String(g.name)) }));
}

function fixAiRules(rules: string[]): string[] {
  return rules.map(fixAiName);
}

// --- main ---

function main() {
  const acl4ssrProxies = readYaml<{ proxies: Proxy[] }>(path.join(DATA_DIR, 'acl4ssr-raw.yaml')).proxies;
  const freesubProxies = readYaml<{ proxies: Proxy[] }>(path.join(DATA_DIR, 'freesub-raw.yaml')).proxies;
  const best1Proxies = readYaml<{ proxies: Proxy[] }>(path.join(DATA_DIR, 'best1-raw.yaml')).proxies;
  const best2Proxies = readYaml<{ proxies: Proxy[] }>(path.join(DATA_DIR, 'best2-raw.yaml')).proxies;
  const allProxies = readYaml<{ proxies: Proxy[] }>(path.join(DATA_DIR, 'all-raw.yaml')).proxies;

  console.log(`ACL4SSR: ${acl4ssrProxies.length}, freeSub: ${freesubProxies.length}, best1: ${best1Proxies.length}, best2: ${best2Proxies.length}, 全部: ${allProxies.length}`);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // ACL4SSR full config
  const acl4ssrTemplatePath = path.join(DATA_DIR, 'template-acl4ssr.yaml');
  const acl4ssrTemplate = fs.existsSync(acl4ssrTemplatePath) ? readYaml<ParsedConfig>(acl4ssrTemplatePath) : null;

  if (acl4ssrTemplate && acl4ssrProxies.length > 0) {
    writeYaml(path.join(OUTPUT_DIR, 'acl4ssr.yaml'), {
      proxies: acl4ssrProxies,
      'proxy-groups': acl4ssrTemplate['proxy-groups'],
      rules: acl4ssrTemplate.rules,
      'rule-providers': acl4ssrTemplate['rule-providers'],
      dns: acl4ssrTemplate.dns,
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

  // best1/best2 outputs (both use acl4ssr template with OpenAi→AI平台 fix)
  const fixedGroups = acl4ssrTemplate ? fixAiGroupName(acl4ssrTemplate['proxy-groups'] as Record<string, unknown>[]) : null;
  const fixedRules = acl4ssrTemplate ? fixAiRules(acl4ssrTemplate.rules as string[]) : null;

  const bestBase = {
    'mixed-port': 7890,
    'allow-lan': false,
    mode: 'rule',
    'log-level': 'warning',
    'unified-delay': true,
    'tcp-concurrent': true,
    profile: { 'store-selected': true },
    dns: {
      enable: true,
      'enhanced-mode': 'fake-ip',
      'fake-ip-range': '198.18.0.1/16',
      'fake-ip-filter': ['*.lan', '*.local', '+.msftconnecttest.com', '+.msftncsi.com', 'localhost.ptlogin2.qq.com'],
      'default-nameserver': ['223.5.5.5', '119.29.29.29'],
      nameserver: ['https://dns.alidns.com/dns-query', 'https://doh.pub/dns-query'],
    },
  };

  const bestGroups: Array<{ label: string; proxies: Proxy[] }> = [
    { label: 'best1', proxies: best1Proxies },
    { label: 'best2', proxies: best2Proxies },
  ];

  for (const { label, proxies } of bestGroups) {
    if (proxies.length === 0) continue;

    if (acl4ssrTemplate && fixedGroups && fixedRules) {
      writeYaml(path.join(OUTPUT_DIR, `${label}.yaml`), {
        ...bestBase,
        proxies,
        'proxy-groups': fixedGroups,
        rules: fixedRules,
        'rule-providers': acl4ssrTemplate['rule-providers'],
      });
      console.log(`已写入 output/${label}.yaml (${proxies.length} 节点)`);
    }

    writeYaml(path.join(OUTPUT_DIR, `${label}-nodes.yaml`), { proxies });
    console.log(`已写入 output/${label}-nodes.yaml`);

    const singboxConfig = mihomoToSingbox(proxies);
    fs.writeFileSync(
      path.join(OUTPUT_DIR, `${label}-singbox.json`),
      JSON.stringify(singboxConfig, null, 2),
      'utf-8',
    );
    const proxyCount = (singboxConfig.outbounds as unknown[]).filter(
      (o: unknown) => !['selector', 'urltest', 'direct', 'block', 'dns'].includes((o as Record<string, string>).type),
    ).length;
    console.log(`已写入 output/${label}-singbox.json (${proxyCount} 节点)`);
  }

  // all nodes
  writeYaml(path.join(OUTPUT_DIR, 'all-nodes.yaml'), { proxies: allProxies });
  console.log(`已写入 output/all-nodes.yaml (${allProxies.length} 节点)`);
}

main();
