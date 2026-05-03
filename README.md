# free-sub

Free Mihomo/Clash/sing-box subscription aggregator, updated hourly.

## Subscriptions

| Description | URL |
|-------------|-----|
| Best1 mihomo config (speed-tested, capped) | `https://raw.githubusercontent.com/imaex/free-sub/sub/best1.yaml` |
| Best1 sing-box config | `https://raw.githubusercontent.com/imaex/free-sub/sub/best1-singbox.json` |
| Best1 nodes only | `https://raw.githubusercontent.com/imaex/free-sub/sub/best1-nodes.yaml` |
| Best2 mihomo config (all qualified) | `https://raw.githubusercontent.com/imaex/free-sub/sub/best2.yaml` |
| Best2 sing-box config | `https://raw.githubusercontent.com/imaex/free-sub/sub/best2-singbox.json` |
| Best2 nodes only | `https://raw.githubusercontent.com/imaex/free-sub/sub/best2-nodes.yaml` |
| ACL4SSR config | `https://raw.githubusercontent.com/imaex/free-sub/sub/acl4ssr.yaml` |
| ACL4SSR nodes only | `https://raw.githubusercontent.com/imaex/free-sub/sub/acl4ssr-nodes.yaml` |
| FreeSub config | `https://raw.githubusercontent.com/imaex/free-sub/sub/freesub.yaml` |
| FreeSub nodes only | `https://raw.githubusercontent.com/imaex/free-sub/sub/freesub-nodes.yaml` |
| All nodes | `https://raw.githubusercontent.com/imaex/free-sub/sub/all-nodes.yaml` |

CN mirror:
- gh-proxy: replace `https://raw.githubusercontent.com/` with `https://v6.gh-proxy.com/raw.githubusercontent.com/`
- jsdelivr: replace `https://raw.githubusercontent.com/imaex/free-sub/sub/` with `https://testingcf.jsdelivr.net/gh/imaex/free-sub@sub/`

## How it works

1. Fetch sources hourly, normalize node names, deduplicate by `type|server|port`
2. TCP connectivity test (5s timeout, 3 retries) to filter dead nodes
3. Best1: speed-tested nodes only, top-N per country (HK 50, US 30, others 20)
4. Best2: all qualified nodes from selected sources, sorted by quality, no cap
5. Generate full configs, node lists and sing-box format, push to sub branch
