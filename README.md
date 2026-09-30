# ssub

订阅转 sing-box 配置的在线转换网站，跑在 Cloudflare Workers 上。导入 GitHub 仓库一键部署，打开网页粘贴订阅 → 生成链接 → 填进 SFA，之后自动更新；分流规则由 SFA 每 24h 自动刷新。

无需配置任何变量：打开就是网页，粘贴订阅链接即用。

## 功能

- **网页界面**：粘贴订阅 → 生成 sing-box (SFA) 可用的 Remote 订阅链接，可一键复制、在线预览节点/分组/流量
- **面板原生配置清洗**：带 sing-box UA 拉订阅，面板返回的 JSON 自动去掉 `//` 注释、适配目标版本字段（`store_rdrc`→`store_dns`、`download_detour`→`http_clients`、新旧 DNS server 格式互转）
- **URI 列表解析**：base64 / 明文订阅自动识别，支持 `ss` / `vmess` / `vless`(含 reality) / `trojan` / `hysteria2` / `tuic` / `anytls`
- **完整配置生成**（URI 模式）：分组（节点选择 / 自动选择(urltest) / 流媒体 / AI / 电报 / 国内）+ 分流 + FakeIP + clash_api + tun/mixed 双入站
- **双版本输出**：默认 sing-box 1.14 格式；`&v=1.13` 输出 1.11–1.13 兼容格式（经 1.12.4 与 1.14.2 双内核 `sing-box check` 验证）

## 部署（Cloudflare 导入仓库，3 分钟）

1. Fork 本仓库到你的 GitHub
2. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages → Create → Workers → Import a repository** → 授权 GitHub 选本仓库 → Deploy（构建配置自动读 `wrangler.toml`）
3. 国内直连建议绑自定义域名：**Settings → Domains & Routes → Add → Custom domain**（`*.workers.dev` 在国内被污染的概率较大）
4. 之后每次 `git push` 自动重新部署

## 使用

打开 `https://<worker域名>/`，粘贴订阅链接 → 生成链接；也可直接拼 URL：

```
https://<worker域名>/?url=<订阅链接urlencode>            # 默认 1.14 格式
https://<worker域名>/?url=<订阅链接urlencode>&v=1.13      # 旧版 sing-box (1.11–1.13) 格式
```

SFA（sing-box for Android）：Profiles → `+` → Type: **Remote** → URL 填转换后的链接 → Save。以后下拉刷新订阅、规则自动更新。

> ⚠️ 这是开放转换器：生成的链接请自用——转换链接等同于订阅本身，泄露即泄露节点。自用建议部署自己的实例 + 绑自己的域名。

## 分流规则（URI 模式生成的配置；全部远程 rule-set，SFA 每 24h 自动更新）

规则仓库用 star 最多、持续维护的两个源：

### [MetaCubeX/meta-rules-dat](https://github.com/MetaCubeX/meta-rules-dat)（5.3k★，`sing` 分支）

v2fly 社区域名库的自动化构建，每日更新，`.srs` 二进制格式：

| rule-set tag | 内容 | 动作 |
|---|---|---|
| `ai` | `category-ai-chat-!cn`：OpenAI / Claude / Gemini / Perplexity 等 | → AI 组 |
| `telegram-sites` | `geosite/telegram` | → 电报组 |
| `telegram-ip` | `geoip/telegram` | → 电报组 |
| `youtube` | YouTube 全域 | → 流媒体组 |
| `netflix` | Netflix 全域 | → 流媒体组 |
| `disney` | Disney+ 全域 | → 流媒体组 |
| `spotify` | Spotify 全域 | → 流媒体组 |
| `tiktok` | TikTok 全域 | → 流媒体组 |
| `proxy-domains` | `geolocation-!cn`：全部非中国大陆域名 | → 节点选择 |
| `cn-domains` | `geosite/cn`：中国大陆域名 | → 直连 |
| `cn-ip` | `geoip/cn`：中国大陆 IP | → 直连 |
| `private-ip` | `geoip/private`：局域网/保留地址 | → 直连 |

### [anti-AD](https://github.com/privacy-protection-tools/anti-AD)（anti-ad.net，4k+★）

国内圈最流行的广告域名库，每日更新，多源聚合：

| rule-set tag | 内容 | 动作 |
|---|---|---|
| `ads` | anti-AD 全量广告/追踪域名 | → **REJECT** |
| `geosite-ads` | MetaCubeX `category-ads-all`（v2fly 广告分类，与 anti-AD 互补） | → **REJECT** |

### 匹配优先级

```
sniff → DNS 劫持 → 局域网直连 → 广告 REJECT(ads + geosite-ads)
→ 国内直连(cn-domains + cn-ip) → 流媒体 → AI → 电报 → 国外代理(geolocation-!cn) → 兜底节点选择
```

DNS：国内域名走阿里 DoH（223.5.5.5）直连解析，其余走 Google DoH（8.8.8.8）经代理解析，FakeIP 收尾。

## 本地验证

```bash
./test.sh
# 依赖: node、sing-box 内核（SB / SB_LEGACY 环境变量可覆盖路径）
# 默认路径: /tmp/sing-box-1.14.2-linux-amd64/sing-box、/tmp/sing-box-1.12.4-linux-amd64/sing-box
# 测试输入: ../data/singbox_revx.json（面板样例）、/tmp/sub.txt（URI 样例）
# 产出: 面板/URI × 新/旧版本 四份配置，分别过对应版本 sing-box check
```

## 参考

- [Toperlock/sing-box-subscribe](https://github.com/Toperlock/sing-box-subscribe)：同类项目（Python/Flask，需自部署），本项目为其 Cloudflare Worker 精简重写
- [SagerNet/sing-box](https://github.com/SagerNet/sing-box) 文档：[sing-box.sagernet.org](https://sing-box.sagernet.org/)
