# free-sub

免费 Mihomo/Clash/sing-box 订阅聚合，每小时自动更新。

## 订阅地址

| 说明 | 地址 |
|------|------|
| 精选 mihomo 完整配置 | `https://raw.githubusercontent.com/imaex/free-sub/main/curated.yaml` |
| 精选 sing-box 格式 | `https://raw.githubusercontent.com/imaex/free-sub/main/curated-singbox.json` |
| 精选节点列表 | `https://raw.githubusercontent.com/imaex/free-sub/main/curated-nodes.yaml` |
| ACL4SSR 完整配置 | `https://raw.githubusercontent.com/imaex/free-sub/main/acl4ssr.yaml` |
| ACL4SSR 节点列表 | `https://raw.githubusercontent.com/imaex/free-sub/main/acl4ssr-nodes.yaml` |
| freeSub 完整配置 | `https://raw.githubusercontent.com/imaex/free-sub/main/freesub.yaml` |
| freeSub 节点列表 | `https://raw.githubusercontent.com/imaex/free-sub/main/freesub-nodes.yaml` |
| 全部节点列表 | `https://raw.githubusercontent.com/imaex/free-sub/main/all-nodes.yaml` |

国内加速：将 `https://raw.githubusercontent.com/` 替换为 `https://gh-proxy.org/raw.githubusercontent.com/`

## 工作方式

1. 每小时拉取 25 个源，清理节点名称，按 `type|server|port` 去重
2. TCP 连通性测试（5s 超时，3 次重试），过滤端口不通的死节点
3. 精选分类按速度/倍率/丢包率排序，取 Top-N（HK 100, US 50, 其他 20）
4. 生成完整配置、节点列表和 sing-box 格式，推送到 main 分支
