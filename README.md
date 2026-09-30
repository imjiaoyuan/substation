# Substation

订阅转换网站，跑在 Cloudflare Workers 上。导入 GitHub 仓库一键部署，打开网页粘贴订阅 → 生成对应内核可直接用的链接或配置，无需任何环境变量。

支持三种输出目标：

| 目标 | 产物 | 用法 |
|---|---|---|
| **sing-box**（默认） | Remote 订阅链接 `?url=…`，1.14 格式 | 填进 SFA（sing-box for Android），之后自动更新 |
| **sing-box 旧版** | `?url=…&v=1.13`，1.11–1.13 兼容格式 | 老版本 sing-box / SFA |
| **Clash / Mihomo** | `?t=clash`，完整 YAML（含 .mrs rule-set） | `proxy-providers` 填链接，或直接下载整份配置 |
| **dae** | `?t=dae`，完整 dae 配置（订阅走签名 `/fetch` 链接） | 存为 `/etc/dae/config.d/substation.dae` 后 reload |

## 功能

- **网页界面**：粘贴订阅 → 生成链接/配置，一键复制、在线预览节点/分组/流量；自动适配系统深浅色
- **面板原生配置清洗**：带 sing-box UA 拉订阅，面板返回的 JSON 自动去掉 `//` 注释、适配目标版本字段（`store_rdrc`→`store_dns`、`download_detour`→`http_clients`、新旧 DNS server 格式互转）
- **URI 列表解析**：base64 / 明文订阅自动识别，支持 `ss` / `vmess` / `vless`(含 reality) / `trojan` / `hysteria2` / `tuic` / `anytls`
- **完整配置生成**（URI 模式）：分组（节点选择 / 自动选择(urltest) / 流媒体 / AI / 游戏 / 加密货币 / 电报 / 国内）+ 分流 + FakeIP + clash_api + tun/mixed 双入站（dae 为 wan_proxy + 独立 DNS 段）
- **双版本输出**：默认 sing-box 1.14 格式；`&v=1.13` 输出 1.11–1.13 兼容格式
- **签名订阅（dae）**：`/fetch?s=<token>`，AES-GCM 加密 + 时间戳防篡改，dae 侧用 `https-file://` 订阅（内容缓存到 persist.d，断网可起）；生成配置里不含节点明文

## 部署（Cloudflare 导入仓库，3 分钟）

1. Fork 本仓库到你的 GitHub
2. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages → Create → Workers → Import a repository** → 授权 GitHub 选本仓库 → Deploy（构建配置自动读 `wrangler.toml`）
3. 国内直连建议绑自定义域名：**Settings → Domains & Routes → Add → Custom domain**（`*.workers.dev` 在国内被污染的概率较大）
4. 之后每次 `git push` 自动重新部署

可选环境变量：`SECRET`（dae 签名订阅密钥；不设用内置公开默认值，自部署建议设）。

## 使用

打开 `https://<worker域名>/`，粘贴订阅链接 → 生成；也可直接拼 URL：

```
https://<worker域名>/?url=<订阅链接urlencode>            # sing-box 1.14（默认）
https://<worker域名>/?url=<订阅链接urlencode>&v=1.13      # sing-box 1.11–1.13
https://<worker域名>/?url=<订阅链接urlencode>&t=clash     # Clash/Mihomo YAML
https://<worker域名>/?url=<订阅链接urlencode>&t=dae       # dae 配置
https://<worker域名>/?url=<订阅链接urlencode>&t=dae&static=1   # dae，节点直接内联（不走 /fetch）
```

dae 配置存到 `/etc/dae/config.d/substation.dae`（主配置 `include config.d/*`），`systemctl reload dae` 生效。
远程订阅首次拉取后缓存到 `persist.d/`，之后断网/订阅挂了也能用缓存起。

> ⚠️ 这是开放转换器：生成的链接请自用——转换链接等同于订阅本身，泄露即泄露节点。自用建议部署自己的实例 + 绑自己的域名 + 设置 `SECRET`。

## 分流规则（URI 模式生成的配置；全部远程规则集，内核定期自动更新）

规则仓库用 star 最多、持续维护的 [MetaCubeX/meta-rules-dat](https://github.com/MetaCubeX/meta-rules-dat)（5.3k★，每日更新）：

| 内容 | sing-box (.srs) | clash (.mrs) | dae (geosite/geoip) |
|---|---|---|---|
| 广告 | `geosite/category-ads-all` + anti-AD（`anti-ad-sing-box.srs`） | `geosite/category-ads-all` | `geosite:category-ads-all` → block |
| 国内域名 | `geosite/cn` → 直连 | 同左 | `geosite:cn` → direct |
| 国内 IP | `geoip/cn` → 直连 | 同左 | `geoip:cn` → direct |
| 局域网 | `geoip/private` → 直连 | 同左 | `geoip:private` → direct |
| 流媒体 | youtube / netflix / disney / spotify / tiktok → 流媒体组 | 同左 | 同左（按节点名关键词分组） |
| AI（国外） | `category-ai-chat-!cn` → AI 组 | 同左 | 同左（按节点名关键词分组） |
| AI（国内） | `category-ai-cn` → 直连 | 同左 | `geosite:category-ai-cn` → direct |
| 游戏（国外） | `category-games-!cn` → 游戏组 | 同左 | `geosite:category-games-!cn` → Proxy |
| 游戏（国内/下载） | `category-games-cn` + `-game-platforms-download` → 直连 | 同左 | 同左 → direct |
| 加密货币 | `category-cryptocurrency` → 加密货币组 | 同左 | `geosite:category-cryptocurrency` → Proxy |
| 测速 | `category-speedtest` → 直连 | 同左 | `geosite:category-speedtest` → direct |
| 微软/苹果/谷歌（在华） | `microsoft@cn` + `apple@cn` + `google@cn` → 直连 | 同左 | 同左 → direct |
| 电报 | `geosite/telegram` + `geoip/telegram` → 电报组 | 同左 | `geosite:telegram`（geoip 行默认注释，见下） |
| 国外 | `geolocation-!cn` → 节点选择 | 同左 | 同左 |
| 兜底 | MATCH → 节点选择 | MATCH → 节点选择 | fallback → Proxy |

> 国内域名走 `geosite:cn`（11 万+ 域名，v2fly 全量 `@cn`）+ `geoip:cn`，微信/淘宝/抖音/百度/腾讯云/银行等实测全在列，无需额外规则；`category-*-cn` 各分类里不在 `cn` 的域名仅个位数到二十几个（媒体 4 / 影听 22 / 游戏 5 / 网盘 1 / 社交 0）。

匹配优先级：`局域网直连 → 广告 REJECT → 国内直连（含国内 AI/测速/国服游戏/下载/三大家在华域名）→ 流媒体/AI/游戏/加密货币/电报 → 国外代理 → 兜底`。
DNS（sing-box/clash）：国内域名走阿里 DoH 直连解析，其余走 Google DoH 经代理解析，FakeIP 收尾。

> dae 的 `dip(geoip:telegram)` 一行默认注释：需要含 telegram 分类的 geoip.dat（dae 官方资产或
> Loyalsoldier/v2ray-rules-dat）；发行版自带的 v2fly geoip.dat 只有国家代码，开着会报
> `country code telegram not found`。要启用就换 geoip.dat 再取消注释。

## 本地验证

```bash
./test.sh
# 生成 10 份产物 + 页面/端点冒烟 + 四内核校验，全过输出 all passed
# 依赖: node；可选: sing-box 双内核(SB/SB_LEGACY)、mihomo(MIHOMO)、dae(DAE)、python3+pyyaml
# 默认内核路径: /tmp/sing-box-1.14.2-linux-amd64/sing-box、/tmp/sing-box-1.12.4-linux-amd64/sing-box、/tmp/mihomo、dae
# 测试输入: ../data/singbox_revx.json（面板样例）、/tmp/sub.txt（URI 样例）、/tmp/sub_fake.txt（可选）
```

实测覆盖：`sing-box check`（1.14.2 + 1.12.4）、`mihomo -t`（v1.19.31）、`dae validate`、
页面 JS（DOM mock 跑 `gen()` 全路径）、`/fetch` 签名订阅解密回环。

## 参考

- [Toperlock/sing-box-subscribe](https://github.com/Toperlock/sing-box-subscribe)：同类项目（Python/Flask，需自部署），本项目为其 Cloudflare Worker 精简重写
- [SagerNet/sing-box](https://github.com/SagerNet/sing-box) 文档：[sing-box.sagernet.org](https://sing-box.sagernet.org/)
- [daeuniverse/dae](https://github.com/daeuniverse/dae) 文档（配置语法、`https-file` 订阅缓存）
- [MetaCubeX/mihomo](https://github.com/MetaCubeX/mihomo) 文档（rule-provider `behavior`/`format: mrs`）
