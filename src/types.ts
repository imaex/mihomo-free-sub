export interface Source {
  name: string;
  url: string;
  category: 'acl4ssr' | 'freesub' | 'other';
}

export interface Proxy {
  name: string;
  type: string;
  server: string;
  port: number;
  [key: string]: unknown;
}

export interface ParsedConfig {
  proxies: Proxy[];
  'proxy-groups'?: unknown[];
  rules?: string[];
  'rule-providers'?: Record<string, unknown>;
  dns?: unknown;
  [key: string]: unknown;
}

export interface FetchResult {
  source: Source;
  config: ParsedConfig;
}
