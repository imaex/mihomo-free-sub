# free-sub

Free Mihomo/Clash/sing-box subscription aggregator, updated hourly.

## Subscriptions

| Description | URL |
|-------------|-----|
| Curated mihomo config | `https://raw.githubusercontent.com/imaex/free-sub/sub/curated.yaml` |
| Curated sing-box config | `https://raw.githubusercontent.com/imaex/free-sub/sub/curated-singbox.json` |
| Curated nodes only | `https://raw.githubusercontent.com/imaex/free-sub/sub/curated-nodes.yaml` |
| ACL4SSR config | `https://raw.githubusercontent.com/imaex/free-sub/sub/acl4ssr.yaml` |
| ACL4SSR nodes only | `https://raw.githubusercontent.com/imaex/free-sub/sub/acl4ssr-nodes.yaml` |
| FreeSub config | `https://raw.githubusercontent.com/imaex/free-sub/sub/freesub.yaml` |
| FreeSub nodes only | `https://raw.githubusercontent.com/imaex/free-sub/sub/freesub-nodes.yaml` |
| All nodes | `https://raw.githubusercontent.com/imaex/free-sub/sub/all-nodes.yaml` |

CN mirror: replace `https://raw.githubusercontent.com/` with `https://gh-proxy.org/raw.githubusercontent.com/`

## How it works

1. Fetch 25 sources hourly, normalize node names, deduplicate by `type|server|port`
2. TCP connectivity test (5s timeout, 3 retries) to filter dead nodes
3. Curated category sorted by speed / multiplier / loss rate, top-N per country (HK 100, US 50, others 20)
4. Generate full configs, node lists and sing-box format, push to sub branch
