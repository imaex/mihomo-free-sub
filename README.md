# mihomo-free-sub

免费 Mihomo/Clash 订阅聚合，每小时自动更新。

## 订阅地址

| 文件 | 说明 | 订阅链接 |
|------|------|----------|
| `acl4ssr.yaml` | ACL4SSR 29 组完整配置 | `https://raw.githubusercontent.com/imaex/mihomo-free-sub/sub/acl4ssr.yaml` |
| `acl4ssr-nodes.yaml` | ACL4SSR 源节点列表 | `https://raw.githubusercontent.com/imaex/mihomo-free-sub/sub/acl4ssr-nodes.yaml` |
| `freesub.yaml` | freeSub 24 组完整配置 | `https://raw.githubusercontent.com/imaex/mihomo-free-sub/sub/freesub.yaml` |
| `freesub-nodes.yaml` | freeSub 源节点列表 | `https://raw.githubusercontent.com/imaex/mihomo-free-sub/sub/freesub-nodes.yaml` |
| `all-nodes.yaml` | 全部节点列表 | `https://raw.githubusercontent.com/imaex/mihomo-free-sub/sub/all-nodes.yaml` |

## 源列表

### ACL4SSR 29 组（完整配置）

| 名称 | 仓库 |
|------|------|
| FreeSubsCheck | [kooker/FreeSubsCheck](https://github.com/kooker/FreeSubsCheck) |
| yahr601 | [yahr601-prog/1](https://github.com/yahr601-prog/1) |
| Auto-Sync | [walke2019/Auto-Sync](https://github.com/walke2019/Auto-Sync) |
| ssrsub | [ssrsub/ssr](https://github.com/ssrsub/ssr) |
| shaoyouvip | [shaoyouvip/free](https://github.com/shaoyouvip/free) |
| dalazhi | [dalazhi/v2ray](https://github.com/dalazhi/v2ray) |
| getnode | [limitless-d/getnode](https://github.com/limitless-d/getnode) |

### freeSub 24 组

| 名称 | 仓库 |
|------|------|
| freeSub | [Ruk1ng001/freeSub](https://github.com/Ruk1ng001/freeSub) |

### 其他源

PuddinCat, cn-news, naidounode, v2rayshare, proxypool, chromego, awesome-vpn, V2RayAggregator, Pawdroid, ermaozi, v2rayfree, yudou66, wenode, dongtai-sub, kasesm, Au1rxx, NoMoreWalls

## 工作方式

1. GitHub Actions 每小时拉取所有源
2. 按 `server:port` 去重（不只按名字）
3. TCP 连通性测试（3s 超时），过滤死节点
4. 按分类拆分输出
5. 强推到 `sub` 分支（保持干净，仅一个 commit）
