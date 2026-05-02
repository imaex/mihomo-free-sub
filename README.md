# free-sub

免费 Mihomo/Clash/sing-box 订阅聚合，每小时自动更新。

## 订阅地址

基础 URL：`https://raw.githubusercontent.com/imaex/free-sub/main/`

| 文件 | 说明 |
|------|------|
| `curated.yaml` | 精选 mihomo 完整配置 |
| `curated-singbox.json` | 精选 sing-box 格式 |
| `curated-nodes.yaml` | 精选节点列表 |
| `acl4ssr.yaml` | ACL4SSR 完整配置 |
| `acl4ssr-nodes.yaml` | ACL4SSR 节点列表 |
| `freesub.yaml` | freeSub 完整配置 |
| `freesub-nodes.yaml` | freeSub 节点列表 |
| `all-nodes.yaml` | 全部节点列表 |

国内加速前缀：`https://gh-proxy.org/` + 上述 URL

## 工作方式

1. 每小时拉取 25 个源，清理节点名称，按 `type|server|port` 去重
2. TCP 连通性测试（5s 超时，3 次重试），过滤端口不通的死节点
3. 精选分类按速度/倍率/丢包率排序，取 Top-N（HK 100, US 50, 其他 20）
4. 生成完整配置、节点列表和 sing-box 格式，推送到 main 分支
