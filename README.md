# mihomo-free-sub

免费 Mihomo/Clash 订阅聚合，每小时自动更新。

## 订阅地址

| 文件 | 说明 | 直连 | 加速 |
|------|------|------|------|
| `curated.yaml` | 精选 mihomo 29 组 | `https://raw.githubusercontent.com/imaex/mihomo-free-sub/sub/curated.yaml` | `https://gh-proxy.org/raw.githubusercontent.com/imaex/mihomo-free-sub/sub/curated.yaml` |
| `curated-singbox.json` | 精选 sing-box 格式 | `https://raw.githubusercontent.com/imaex/mihomo-free-sub/sub/curated-singbox.json` | `https://gh-proxy.org/raw.githubusercontent.com/imaex/mihomo-free-sub/sub/curated-singbox.json` |
| `curated-nodes.yaml` | 精选节点列表 | `https://raw.githubusercontent.com/imaex/mihomo-free-sub/sub/curated-nodes.yaml` | `https://gh-proxy.org/raw.githubusercontent.com/imaex/mihomo-free-sub/sub/curated-nodes.yaml` |
| `acl4ssr.yaml` | ACL4SSR 29 组完整配置 | `https://raw.githubusercontent.com/imaex/mihomo-free-sub/sub/acl4ssr.yaml` | `https://gh-proxy.org/raw.githubusercontent.com/imaex/mihomo-free-sub/sub/acl4ssr.yaml` |
| `acl4ssr-nodes.yaml` | ACL4SSR 源节点列表 | `https://raw.githubusercontent.com/imaex/mihomo-free-sub/sub/acl4ssr-nodes.yaml` | `https://gh-proxy.org/raw.githubusercontent.com/imaex/mihomo-free-sub/sub/acl4ssr-nodes.yaml` |
| `freesub.yaml` | freeSub 24 组完整配置 | `https://raw.githubusercontent.com/imaex/mihomo-free-sub/sub/freesub.yaml` | `https://gh-proxy.org/raw.githubusercontent.com/imaex/mihomo-free-sub/sub/freesub.yaml` |
| `freesub-nodes.yaml` | freeSub 源节点列表 | `https://raw.githubusercontent.com/imaex/mihomo-free-sub/sub/freesub-nodes.yaml` | `https://gh-proxy.org/raw.githubusercontent.com/imaex/mihomo-free-sub/sub/freesub-nodes.yaml` |
| `all-nodes.yaml` | 全部节点列表 | `https://raw.githubusercontent.com/imaex/mihomo-free-sub/sub/all-nodes.yaml` | `https://gh-proxy.org/raw.githubusercontent.com/imaex/mihomo-free-sub/sub/all-nodes.yaml` |

## 快速订阅

```bash
mihomo sub add "https://gh-proxy.org/raw.githubusercontent.com/imaex/mihomo-free-sub/sub/curated.yaml" best1
mihomo sub add "https://gh-proxy.org/raw.githubusercontent.com/imaex/mihomo-free-sub/sub/acl4ssr.yaml" best2
mihomo sub add "https://gh-proxy.org/raw.githubusercontent.com/imaex/mihomo-free-sub/sub/freesub.yaml" best3
```

## 源列表

### 精选源（有测速标记）

| 名称 | 仓库 | 特点 |
|------|------|------|
| FreeSubsCheck | [kooker/FreeSubsCheck](https://github.com/kooker/FreeSubsCheck) | 测速 + 功能标签，如 `🇯🇵JP_1\|1.7MB/s`、`🇺🇸US_2\|845KB/s\|GPT` |
| shaoyouvip | [shaoyouvip/free](https://github.com/shaoyouvip/free) | 测速，如 `🇸🇬SG_1\|2.6MB/s`、`🇳🇱NL_3\|1.6MB/s` |
| dalazhi | [dalazhi/v2ray](https://github.com/dalazhi/v2ray) | 测速，如 `🇭🇰HK_4\|8.2MB/s`、`🇻🇳VN_1\|1.2MB/s` |
| getnode | [limitless-d/getnode](https://github.com/limitless-d/getnode) | 测速，如 `🇰🇷KR_1\|2.9MB/s`、`🇿🇦ZA_1\|2.9MB/s` |

### ACL4SSR 29 组（全部源）

| 名称 | 仓库 | 特点 |
|------|------|------|
| FreeSubsCheck | [kooker/FreeSubsCheck](https://github.com/kooker/FreeSubsCheck) | 测速 + 功能标签，如 `🇯🇵JP_1\|1.7MB/s`、`🇺🇸US_2\|845KB/s\|GPT` |
| yahr601 | [yahr601-prog/1](https://github.com/yahr601-prog/1) | 倍率 + 功能标签，如 `🇺🇸US²_1\|0%\|GPT⁺\|GM\|YT`、`🇭🇰HK¹-LV⁰_1` |
| Auto-Sync | [walke2019/Auto-Sync](https://github.com/walke2019/Auto-Sync) | 聚合源（含 freeSub 节点），节点多但无自身测速 |
| ssrsub | [ssrsub/ssr](https://github.com/ssrsub/ssr) | 纯节点，无测速/标签 |
| shaoyouvip | [shaoyouvip/free](https://github.com/shaoyouvip/free) | 测速，如 `🇸🇬SG_1\|2.6MB/s`、`🇳🇱NL_3\|1.6MB/s` |
| dalazhi | [dalazhi/v2ray](https://github.com/dalazhi/v2ray) | 测速，如 `🇭🇰HK_4\|8.2MB/s`、`🇻🇳VN_1\|1.2MB/s` |
| getnode | [limitless-d/getnode](https://github.com/limitless-d/getnode) | 测速，如 `🇰🇷KR_1\|2.9MB/s`、`🇿🇦ZA_1\|2.9MB/s` |

### freeSub 24 组

| 名称 | 仓库 | 特点 |
|------|------|------|
| freeSub | [Ruk1ng001/freeSub](https://github.com/Ruk1ng001/freeSub) | 质量标记 + 解锁标签，如 `🇭🇰[🎬🤖📺🔍]_ad073b21\|优`、`🇸🇬[🎬📺🔍]_45a08a51\|差` |

### 其他源（纯节点，无分组模板）

| 名称 | 仓库 |
|------|------|
| PuddinCat | [PuddinCat/BestClash](https://github.com/PuddinCat/BestClash) |
| cn-news | [hello-world-1989/cn-news](https://github.com/hello-world-1989/cn-news) |
| naidounode | [xiaoji235/airport-free](https://github.com/xiaoji235/airport-free) |
| v2rayshare | [xiaoji235/airport-free](https://github.com/xiaoji235/airport-free) |
| proxypool | [snakem982/proxypool](https://github.com/snakem982/proxypool) |
| chromego | [Misaka-blog/chromego_merge](https://github.com/Misaka-blog/chromego_merge) |
| awesome-vpn | [awesome-vpn/awesome-vpn](https://github.com/awesome-vpn/awesome-vpn) |
| V2RayAggregator | [mahdibland/V2RayAggregator](https://github.com/mahdibland/V2RayAggregator) |
| Pawdroid | [Pawdroid/Free-servers](https://github.com/Pawdroid/Free-servers) |
| ermaozi | [ermaozi/get_subscribe](https://github.com/ermaozi/get_subscribe) |
| v2rayfree | [v2raynnodes/v2rayfree](https://github.com/v2raynnodes/v2rayfree) |
| yudou66 | [Barabama/FreeNodes](https://github.com/Barabama/FreeNodes) |
| wenode | [Barabama/FreeNodes](https://github.com/Barabama/FreeNodes) |
| dongtai-sub | [wenxig/dongtai-sub](https://github.com/wenxig/dongtai-sub) |
| kasesm | [kasesm/Free-Config](https://github.com/kasesm/Free-Config) |
| Au1rxx | [Au1rxx/free-vpn-subscriptions](https://github.com/Au1rxx/free-vpn-subscriptions) |
| NoMoreWalls | [peasoft/NoMoreWalls](https://github.com/peasoft/NoMoreWalls) |

## 输出分类说明

| 输出 | 包含源 | 说明 |
|------|--------|------|
| `curated` | FreeSubsCheck, shaoyouvip, dalazhi, getnode | 精选：只保留 HK/JP/US/TW/SG/KR 地区的测速节点 |
| `acl4ssr` | 上述 7 个 ACL4SSR 源 | 全量 29 组，节点多但质量参差 |
| `freesub` | freeSub | 24 组，有解锁标签和质量标记 |
| `all-nodes` | 全部 25 个源 | 纯节点列表，无分组规则 |

## 节点名称处理

- 移除 `op` 前缀（dalazhi 源）
- 移除 `_github.com/Ruk1ng001_`（freeSub 源）
- 圆圈 emoji 替换为尾部标签：🟢→`|优` 🟡→`|良` 🔴→`|差` ⚪→`|未知`
- 清理推广文本（Telegram/机场推荐/域名等），保留节点
- 去重规则：`协议+服务器+端口` 相同视为重复

## 工作方式

1. GitHub Actions 每小时拉取所有 25 个源
2. 清理节点名称（去推广、标准化）
3. 按 `type|server|port` 去重
4. mihomo 协议握手测试（2s 超时，100 并发），过滤不可用节点
5. 按分类生成完整配置、纯节点列表和 sing-box 格式
6. 强推到 `sub` 分支（保持干净，仅一个 commit）
