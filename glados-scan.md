# GlaDOS 订阅地址扫描手册

## URL 格式

```
https://update.glados-config.com/{type}/{userId}/{code}/{port}/glados.yaml
```

| 字段 | 说明 |
|------|------|
| `type` | `mihomo` / `clash` / `v2ray` / `singbox` / `subscribe` |
| `userId` | 数字用户 ID |
| `code` | 7 位 hex（mihomo/clash）或 16 位 hex（v2ray/singbox） |
| `port` | 数字端口 |

变体文件名：`glados.yaml` / `glados-terminal.yaml` / `glados-android.yaml` / `glados-fixed.yaml`

Clash 和 Mihomo 端点可互换 — 同一组 `{userId}/{code}/{port}` 在 `/clash/` 和 `/mihomo/` 都能用。

## Response Header 中的账号信息

```
Subscription-Userinfo: upload=1; download=0; total=10737418240; expire=1777766434
Content-Disposition: attachment; filename="glados.one/xxx@qq.com"
```

| Header | 说明 |
|--------|------|
| `Subscription-Userinfo` | `upload`/`download` 字节数；`total` 总流量字节；`expire` Unix 时间戳 |
| `Content-Disposition` | filename 中含邮箱 |

失效账号特征：返回 200 但 Content-Length 为 623，YAML 内只有 1 个 `127.0.0.1:1080` 的 socks5 dummy proxy。

## 搜索方法

### GitHub（gh CLI）

```bash
# 基础搜索
gh search code "glados-config.com/mihomo" --limit 30
gh search code "update.glados-config.com" --limit 30
gh search code "glados.yaml" --limit 30
gh search code "glados-config.net" --limit 30

# 按语言细分
gh search code "glados-config.com" -l yaml --limit 30
gh search code "glados-config.com" -l python --limit 30
gh search code "glados-config.com" -l shell --limit 30
gh search code "glados-config.com" -l javascript --limit 30

# 其他格式
gh search code "glados-config.com/subscribe" --limit 30
gh search code "glados-config.com/v2ray" --limit 30
gh search code "glados-config.com/singbox" --limit 30
```

找到结果后读取文件内容提取 URL：

```bash
gh api repos/{owner}/{repo}/contents/{path} --jq .content | base64 -d | grep -oE 'https://update.glados-config.com/[^ "'"'"']*'
```

### 批量验证脚本

```bash
check_glados() {
  local url="$1"
  echo "=== $url ==="
  curl -sI --connect-timeout 8 "$url" | grep -iE '(Subscription-Userinfo|Content-Disposition|Content-Length)'
  local count=$(curl -s --connect-timeout 10 "$url" | grep -c "^  - name:")
  echo "节点数: $count"
  echo ""
}

# 用法: check_glados "https://update.glados-config.com/mihomo/{id}/{code}/{port}/glados.yaml"
```

### 解析 header 的 Python 片段

```python
import datetime

def parse_userinfo(header_line):
    """解析 Subscription-Userinfo header"""
    parts = dict(item.strip().split("=") for item in header_line.split(";"))
    upload = int(parts.get("upload", 0))
    download = int(parts.get("download", 0))
    total = int(parts.get("total", 0))
    expire = int(parts.get("expire", 0))
    return {
        "used_gb": (upload + download) / (1024**3),
        "total_gb": total / (1024**3),
        "expire_date": datetime.datetime.fromtimestamp(expire).strftime("%Y-%m-%d"),
        "days_left": (expire - datetime.datetime.now().timestamp()) / 86400,
    }
```

## 节点真实可用性验证（mihomo sub test）

仅靠 header 和节点数不够 — 订阅未过期、能拉到节点不代表能用。必须用 mihomo 实测。

### 方法

```bash
# 先添加订阅
mihomo sub add "<url>" <name>

# 测试节点连通性（延迟测试，默认超时 2000ms，并发 100）
mihomo sub test <name>

# 清理失败节点并自动重启
mihomo sub clean <name>

# 快速测试当前使用中的订阅
mihomo test
```

### 结果解读

- `✓ NodeName 150ms` — 存活，延迟 150ms
- `✗ NodeName Timeout` — 超时，不可用
- `✗ NodeName An error occurred in the delay test` — 连接错误，不可用
- **关键指标**：存活率。0/52 = 完全不可用（即使订阅未过期）；35/48 = 可用

### 经验教训（2026-05-04）

- 订阅未过期 + 能拉到节点 ≠ 节点能用。GitHub 搜到的大量 GlaDOS 订阅虽然 header 显示未过期，但 `mihomo sub test` 全部超时（0 存活）
- 可能原因：账号被限制、密码被重置但 URL 未变、节点服务器屏蔽了凭据
- **必须走完 mihomo sub test 这一步才能确认可用**

## 判断标准

三步验证，缺一不可：

1. **订阅有效**：Content-Length ≠ 623，节点数 > 10，expire 未过期
2. **节点存活**：`mihomo sub test` 存活率 > 50%
3. **延迟可用**：TW/JP 节点 < 200ms，US 节点 < 500ms 为佳

## 扫描流程

1. **GitHub 搜索** — 用上面的 gh 命令搜索，提取所有 URL
2. **去重** — 按 userId 去重
3. **批量验证 header** — 对每个 URL 检查 Content-Length（623 = 失效，直接跳过）
4. **解析账号信息** — 对有效的检查到期时间、流量、节点数
5. **添加到 mihomo 并测试** — `mihomo sub add` + `mihomo sub test`，确认节点真实可用
6. **清理** — 删除不可用的订阅 `mihomo sub remove`

## RailGun 扫描（参考）

RailGun (railgun.info) 是 GlaDOS 的迁移目标，同一团队。URL 格式不同：

```
https://update.railgunx.com/{client}/{hash}/{uuid}/{path}
```

| 字段 | 说明 |
|------|------|
| `client` | `mihomo` / `clash` / `subscribe` / `stash` |
| `hash` | 8 位 hex（per-user） |
| `uuid` | 标准 UUID 格式（per-user password） |
| `path` | `full.yaml` / `minimalist.yaml` / `servers` |

RailGun 的 URL 公网几乎无泄露，hash+UUID 组合比 GlaDOS 纯数字 ID 更难搜到。GitHub 搜索关键词：

```bash
gh search code "update.railgunx.com" --limit 30
gh search code "railgunx.com/mihomo" --limit 30
```
