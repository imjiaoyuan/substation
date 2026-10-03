# Substation

订阅转换网站，跑在 Cloudflare Workers 上。导入 GitHub 仓库一键部署，打开网页粘贴订阅 → 生成对应内核可直接用的链接或配置，无需任何环境变量。

支持七种输出目标：

| 目标 | 产物 | 用法 |
|---|---|---|
| **sing-box**（默认） | Remote 订阅链接 `?url=…`，1.14 格式 | 填进 SFA（sing-box for Android），之后自动更新 |
| **sing-box 旧版** | `?url=…&v=1.13`，1.11–1.13 兼容格式 | 老版本 sing-box / SFA |
| **Clash / Mihomo** | `?t=clash`，完整 YAML（含 .mrs rule-set） | `proxy-providers` 填链接，或直接下载整份配置 |
| **Clash 仅节点** | `?t=clash&proxies=1`，只出 `proxies:` 节 | 已有配置的 `proxy-providers` 引用（`type: http` + `health-check`，无需 override） |
| **dae** | `?t=dae`，完整 dae 配置（订阅走签名 `/fetch` 链接） | 存为 `/etc/dae/config.d/substation.dae` 后 reload |
| **Surge / Surfboard** | `?t=surge`，完整 .conf（`#!MANAGED-CONFIG` 托管，blackmatrix7 规则集） | Surge 「从 URL 安装」；Surfboard 同一语法 |
| **Quantumult X** | `?t=qx`，完整 conf（`[filter_remote]` 规则引用） | QX 「配置文件 → 远程配置」或 iCloud 导入 |
| **URI 列表** | `?t=uri`，标准 base64 分享链接列表 | v2rayN / v2rayNG / Shadowrocket / Loon / NekoBox / Streisand 等通用 |

## 功能

- **网页界面**：粘贴订阅 → 生成链接/配置，一键复制、在线预览节点/分组/流量；自动适配系统深浅色
- **面板原生配置清洗**：带 sing-box UA 拉订阅，面板返回的 JSON 自动去掉 `//` 注释、适配目标版本字段（`store_rdrc`→`store_dns`、`download_detour`→`http_clients`、新旧 DNS server 格式互转）
- **URI 列表解析**：base64 / 明文订阅自动识别，支持 `ss` / `vmess` / `vless`(含 reality) / `trojan` / `hysteria2` / `tuic` / `anytls`
- **完整配置生成**（URI 模式）：分组（节点选择 / 自动选择(urltest) / 流媒体 / AI / 加密货币 / 电报 / 直连）+ 分流 + FakeIP + clash_api + tun/mixed 双入站（dae 为 wan_proxy + 独立 DNS 段；Surge/QX 为各自策略组 + 分流段）
- **AI 分区分组（默认开启，URL 参数 `ai` 控制）**：AI 组按节点地区自动派生 `AI-<国家>` 子组（urltest 自动选最快）——AI Studio / Gemini / ChatGPT 避开港/澳/陆落地。
  - 地区识别两层：① emoji 旗帜反解 ISO 代码（🇺🇸 = U+1F1FA+U+1F1F8 → US，**零表覆盖全部国家**）；② 40 国文字关键词（中文简繁 / 英文全称 / 主要城市 / 词边界两字母缩写，`Australia` 不会误伤 `us`）
  - 剩余流量 / 到期 / 官网等信息节点不参与地区识别（否则「剩余流量：100GB」会命中 GB）
  - `ai=auto`（缺省）：识别到的全部国家，排除 HK/MO/CN；`ai=US,JP`：只生成指定国家；`ai=0`：关闭分区
  - 识别不到任何地区节点时退回普通 AI 组（dae 为按服务名 OpenAI/Claude… 过滤的旧行为）
  - 五种输出（sing-box / clash / dae / surge / qx）行为一致；dae 为全部地区并集单组（dae 组不能嵌套，词表只含旗帜+中文+英文全称）
- **双版本输出**：默认 sing-box 1.14 格式；`&v=1.13` 输出 1.11–1.13 兼容格式
- **协议支持差异**：Surge 不支持 `vless`（跳过并注释说明），支持 ss/vmess/trojan/tuic-v5/hysteria2/anytls；QX 不支持 `vless`/`hysteria2`/`tuic`（跳过并注释说明），支持 ss/vmess/trojan/anytls
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
https://<worker域名>/?url=<订阅链接urlencode>&t=clash&proxies=1  # Clash 仅 proxies 节（proxy-providers 用）
https://<worker域名>/?url=<订阅链接urlencode>&t=dae       # dae 配置
https://<worker域名>/?url=<订阅链接urlencode>&t=dae&static=1   # dae，节点直接内联（不走 /fetch）
https://<worker域名>/?url=<订阅链接urlencode>&t=surge     # Surge / Surfboard .conf
https://<worker域名>/?url=<订阅链接urlencode>&t=qx        # Quantumult X conf
https://<worker域名>/?url=<订阅链接urlencode>&t=uri       # base64 分享链接列表（v2rayN/NG、Shadowrocket、Loon 等）
```

dae 配置存到 `/etc/dae/config.d/substation.dae`（主配置 `include config.d/*`），`systemctl reload dae` 生效。
远程订阅首次拉取后缓存到 `persist.d/`，之后断网/订阅挂了也能用缓存起。

> ⚠️ 这是开放转换器：生成的链接请自用——转换链接等同于订阅本身，泄露即泄露节点。自用建议部署自己的实例 + 绑自己的域名 + 设置 `SECRET`。

## 分流规则（URI 模式生成的配置；全部远程规则集，内核定期自动更新）

规则仓库：sing-box / clash 用 [MetaCubeX/meta-rules-dat](https://github.com/MetaCubeX/meta-rules-dat)（5.3k★，每日更新）；**Surge / QX 用 [blackmatrix7/ios_rule_script](https://github.com/blackmatrix7/ios_rule_script)（17k★）**——两者没有二进制规则格式（.srs/.mrs），改用其 .list 规则集，分流策略与上表一致，差异如下：

- Surge 直连域名主集用 `ChinaMax_Domain`（DOMAIN-SET，11 万行）+ `ChinaMax`（含 IP 段，`no-resolve`），QX 用 `ChinaMaxNoIP`（同源）；国内 AI（deepseek/kimi/百川等）已全在主集里，无需单独规则
- 国外兜底域名集：Surge 用 `Global`，QX 用 `Proxy`（同源仓库的不同命名）
- AI 组在 Surge/QX 拆成 OpenAI / Claude / Gemini / Copilot 四个规则集（meta-rules-dat 是合在一起的 `category-ai-chat-!cn`，blackmatrix7 没有对应单集）

| 内容 | sing-box (.srs) | clash (.mrs) | dae (geosite/geoip) |
|---|---|---|---|
| 广告 | `geosite/category-ads-all` + anti-AD（`anti-ad-sing-box.srs`） | `geosite/category-ads-all` | `geosite:category-ads-all` → block |
| 国内域名 | `geosite/cn` → 直连 | 同左 | `geosite:cn` → direct |
| 国内 IP | `geoip/cn` → 直连 | 同左 | `geoip:cn` → direct |
| 局域网 | `geoip/private` → 直连 | 同左 | `geoip:private` → direct |
| 流媒体 | youtube / netflix / disney / spotify / tiktok → 流媒体组 | 同左 | 同左（按节点名关键词分组） |
| AI（国外） | `category-ai-chat-!cn` → AI 组（默认按节点地区派生 AI-XX 子组，`&ai=` 可指定/关闭） | 同左 | 同左（全部地区并集组） |
| AI（国内） | `category-ai-cn` → 直连 | 同左 | `geosite:category-ai-cn` → direct |
| 游戏（含外服/国服/下载） | `category-games-!cn` + `-game-platforms-download` → 直连 | 同左 | 同左 → direct |
| 加密货币 | `category-cryptocurrency` → 加密货币组 | 同左 | `geosite:category-cryptocurrency` → Proxy（dae 无法按分类分组） |
| 测速 | `category-speedtest` → 直连 | 同左 | `geosite:category-speedtest` → direct |
| 微软/苹果（在华） | `microsoft@cn` + `apple@cn` → 直连 | 同左 | 同左 → direct |
| 谷歌（全量走代理） | 不设 google@cn 直连——v2fly 该集含 www.gstatic.com / fonts.gstatic.com 等实际被墙域名，直连会导致 YouTube 图标、AI Studio 静态资源全部超时 | 同左 | 同左 |
| 电报 | `geosite/telegram` + `geoip/telegram` → 电报组 | 同左 | `geosite:telegram`（geoip 行默认注释，见下） |
| 国外 | `geolocation-!cn` → 节点选择 | 同左 | 同左 |
| 兜底 | MATCH → 节点选择 | MATCH → 节点选择 | fallback → Proxy |

> 国内域名走 `geosite:cn`（11 万+ 域名，v2fly 全量 `@cn`）+ `geoip:cn`，微信/淘宝/抖音/百度/腾讯云/银行等实测全在列，无需额外规则；`category-*-cn` 各分类里不在 `cn` 的域名仅个位数到二十几个（媒体 4 / 影听 22 / 游戏 5 / 网盘 1 / 社交 0）。

匹配优先级：`局域网直连 → 广告 REJECT → 国内直连（含国内 AI/测速/游戏/下载/三大家在华域名）→ 境外 QUIC(UDP 443) REJECT → 流媒体/AI/加密货币/电报 → 国外代理 → 兜底`。
> 境外 UDP 443 reject：浏览器对境外图片/视频优先走 HTTP/3(QUIC)，而境外 UDP 443 常被链路黑洞或
> 节点不转发 UDP，表现为文字能开、头像图片转圈（典型：v2ex 头像 cdn.v2ex.com，实测 QUIC 握手有去无回、
> TCP 0.2s 正常）。显式 reject 让客户端立刻回退 TCP，国内域名不受影响（规则位于国内直连之后）。
> 七种输出全部内置：sing-box `{ network: "udp", port: 443, action: "reject" }`、
> clash `AND,((NETWORK,UDP),(DST-PORT,443)),REJECT`、surge `AND,((PROTOCOL,UDP),(DEST-PORT,443)),REJECT`、
> qx `udp_drop_list = QUIC`、dae `l4proto(udp) && dport(443) -> block`。
> 需要境外 QUIC（如 Google Meet）的话删掉对应内核的那条即可。

DNS（sing-box/clash）：国内域名走阿里 DoH 直连解析，其余走 Google DoH 经代理解析，FakeIP 收尾。

> 规则集均为远程源，默认都从 `raw.githubusercontent.com` 拉（sing-box 22 个 / clash 21 个 / surge 21 个 / qx 20 个）。
> 首次加载需联网下载，之后按 24h 缓存；国内直连拉 GitHub 可能失败，拉空的规则集会退化成
> “该分类不匹配 → 落到兜底”，不会报错。拉不动的话自行套代理/换镜像。

> **游戏一律直连**（含外服）：想给外服游戏走代理的用户请自备规则/改 `DIRECT_SETS`（外服游戏多在国内被墙，直连是“够用”而非“最优”的默认）。
> **面板模式不受以上分流影响**：喂 sing-box 面板 JSON 时走 `adaptPanel`，规则沿用面板自带的，只有 URI 模式才会套上这张表。

> dae 的 `dip(geoip:telegram)` 一行默认注释：需要含 telegram 分类的 geoip.dat（dae 官方资产或
> Loyalsoldier/v2ray-rules-dat）；发行版自带的 v2fly geoip.dat 只有国家代码，开着会报
> `country code telegram not found`。要启用就换 geoip.dat 再取消注释。
>
> dae 的 `geosite:xxx` 同样会去 `/usr/share/dae/geosite.dat` 里逐个查规则集名，缺哪个直接报
> `code xxx not found` 起不来。本仓库用到 `category-ai-cn` / `category-speedtest` / `category-games-!cn` /
> `category-game-platforms-download` / `category-cryptocurrency` / `apple@cn` / `microsoft@cn`
> 等较新的名字，请确保 geosite.dat 够新（用 dae 官方资产或 Loyalsoldier/v2ray-rules-dat 的最新版）。

## 本地验证

仓库不再带测试脚本，改用手动三内核校验（产物需自备一份 URI 订阅）：

```bash
# 生成七份产物（需自备 /tmp/sub.txt：base64 或明文 URI 订阅，一行一个）
node --input-type=module -e "
import {readFileSync,writeFileSync} from 'fs';
const m = await import('./worker.js');
const uri = readFileSync('/tmp/sub.txt','utf8');
writeFileSync('/tmp/c.yaml',(await m.convertTo(uri,'clash')).body);
writeFileSync('/tmp/cp.yaml',(await m.convertTo(uri,'clash',{proxiesOnly:true})).body);
writeFileSync('/tmp/s.json',JSON.stringify((await m.convertTo(uri,'singbox')).body));
writeFileSync('/tmp/s13.json',JSON.stringify((await m.convertTo(uri,'singbox-legacy')).body));
writeFileSync('/tmp/d.dae',(await m.convertTo(uri,'dae',{origin:'https://x.dev'})).body);
writeFileSync('/tmp/surge.conf',(await m.convertTo(uri,'surge')).body);
writeFileSync('/tmp/qx.conf',(await m.convertTo(uri,'qx')).body);
writeFileSync('/tmp/uri.txt',(await m.convertTo(uri,'uri')).body);
"

mihomo -t -f /tmp/c.yaml
python3 -c "import yaml;yaml.safe_load(open('/tmp/c.yaml'));yaml.safe_load(open('/tmp/cp.yaml'))"
sing-box check -c /tmp/s.json             # 1.14
sing-box check -c /tmp/s13.json           # 1.12/1.13（legacy）
chmod 600 /tmp/d.dae && dae validate -c /tmp/d.dae
surge -t /tmp/surge.conf                  # Mac 版 Surge CLI（可选）
```

实测覆盖：`sing-box check`（1.14.2 + 1.12.4）、`mihomo -t`（v1.19.31）、`dae validate`（含
geosite 代码存在性；dae 会去 `/usr/share/dae/geosite.dat` 里逐个查找规则集名，缺哪个会直接报
`code xxx not found`）。

## 参考

- [Toperlock/sing-box-subscribe](https://github.com/Toperlock/sing-box-subscribe)：同类项目（Python/Flask，需自部署），本项目为其 Cloudflare Worker 精简重写
- [SagerNet/sing-box](https://github.com/SagerNet/sing-box) 文档：[sing-box.sagernet.org](https://sing-box.sagernet.org/)
- [daeuniverse/dae](https://github.com/daeuniverse/dae) 文档（配置语法、`https-file` 订阅缓存）
- [MetaCubeX/mihomo](https://github.com/MetaCubeX/mihomo) 文档（rule-provider `behavior`/`format: mrs`）
- [Surge 手册](https://manual.nssurge.com/)（策略/策略组/RULE-SET/DOMAIN-SET 语法、`#!MANAGED-CONFIG`）
- [blackmatrix7/ios_rule_script](https://github.com/blackmatrix7/ios_rule_script)（Surge / QuantumultX .list 规则集）
