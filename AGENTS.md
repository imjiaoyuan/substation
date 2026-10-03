# AGENTS.md — AI 编码代理指南

单文件 Cloudflare Worker 订阅转换站。给 AI 代理（Claude Code / Codex / Cursor 等）在此仓库工作时的必读约定。

## 项目形态

- **全部代码在 `worker.js` 一个文件里**（约 1500 行）：无构建步骤、无 npm 依赖、无必填环境变量。不要引入框架/依赖/多文件结构。
- `README.md` 是面向用户的文档，改行为时同步更新；`wrangler.toml` 保持最小（name/main/compatibility_date）。
- 部署 = Cloudflare 后台导入 GitHub 仓库，之后每次 `git push` 自动重新部署。无 CI，验证全靠本地手动跑。

## worker.js 地图

| 区段 | 内容 |
|---|---|
| 文件头 + 常量 | `SB_UA`、`GH_RAW`、`STREAM`、`BM7_RULE_SETS`（Surge/QX 规则表）、`SING_RULE_SETS`（sing-box）、`CLASH_RULE_SETS`（clash）、`DIRECT_SETS`、`GROUPS` |
| AI 地区分组 | `REGIONS`/`REGION_CODES`/`flagCode()`/`resolveAiRegions()`：emoji 旗帜 + 文字关键词识别节点地区，URL 参数 `ai=auto/US,JP/0` 控制 |
| URI 解析 | `parseUriList()` 等：ss/vmess/vless/trojan/hysteria2/tuic/anytls → 内部统一节点结构 |
| 产物构建 | `buildConfig()`（sing-box 1.14/1.13 共用，`legacy` 参数区分）、`buildClash()`、`buildSurge()`、`buildQx()`、`buildUriList()`、`buildDaeBody()` |
| 面板清洗 | `adaptPanel()`：sing-box 面板 JSON 去注释 + 新旧字段互转 |
| 网页 UI | `convertTo` 之后、`export default` 之前的模板字符串：表单 + `prev()` 预览 |
| 入口 | `convertTo(text, target, opts)`（可编程调用）与 `export default { fetch }`（HTTP 路由：`/`、`/fetch`） |

## 不变量（改规则前必读）

1. **七种输出行为对齐**：sing-box / clash / dae / surge / qx 的分流语义必须一致（协议支持差异除外：Surge 无 vless，QX 无 vless/hysteria2/tuic，各 builder 已做跳过 + 注释）。改一条规则要同步改所有对应 builder。
2. **规则顺序**：`局域网直连 → 广告 REJECT → 国内直连（域名+IP）→ 境外 QUIC/UDP 443 REJECT → 流媒体 → AI → 加密货币 → 电报 → 国外 → 兜底`。QUIC 拦截必须在**国内直连之后、流媒体/代理域名之前**——放后面会导致 youtube 等先命中流媒体组、其 QUIC 照走 UDP 黑洞。
3. **sing-box 双版本**：1.14 与 1.13 legacy 共用同一份 route 规则数组，一处改动两边生效；版本差异只在字段名（`store_dns`↔`store_rdrc`、`http_clients`↔`download_detour`、DNS server 格式）。
4. **dae 限制**：策略组不能嵌套（AI 地区并为单组）、`name(keyword:)` 无法词边界匹配（`REGION_CODES` 的两字母缩写在 dae 里不用）。
5. **信息节点**：流量/到期/官网等节点名（`NODE_INFO_RE`）不参与地区识别（"剩余流量：100GB" 不能命中 GB）。
6. **UI 转义**：任何拼进 `innerHTML` 的外部数据（节点名、分组名、错误响应体）必须过 `esc()`。节点名是用户订阅提供的不可信输入。
7. **注释与文案用中文**，代码风格保持现状（无分号偏好混乱、无 lint 配置，跟随手改的段落）。

## 自动更新机制（勿重复造轮子）

各内核自行定时拉远程资源，Worker 无状态不参与：
- sing-box：rule_set `update_interval: "24h"`；SFA 定期重新拉订阅链接
- clash：rule-providers `interval: 86400`
- Surge：`#!MANAGED-CONFIG interval=86400`（整份 conf 重下）；规则集默认 86400s
- QX：官方默认所有远程资源 86400s 同步 + 响应头 `profile-update-interval: 24`
- dae：无定时参数，`dae reload` 时重新拉订阅（`https-file://` 成功后自动更新 persist 缓存）

## 本地验证（提交前必跑）

```bash
# 1) 造测试订阅（或用真实订阅），生成七产物
node --input-type=module -e "
import {readFileSync,writeFileSync} from 'fs';
const m = await import('./worker.js');
const uri = readFileSync('/tmp/sub.txt','utf8');
for (const [f,t,o] of [['c.yaml','clash'],['cp.yaml','clash'],['s.json','singbox'],['s13.json','singbox-legacy'],['surge.conf','surge'],['qx.conf','qx'],['d.dae','dae'],['uri.txt','uri']])
  writeFileSync('/tmp/'+f,(await m.convertTo(uri,t,{proxiesOnly:f==='cp.yaml',origin:'https://x.dev'})).body);
"
# 2) 内核校验（装了哪个跑哪个）
python3 -c "import yaml;yaml.safe_load(open('/tmp/c.yaml'));yaml.safe_load(open('/tmp/cp.yaml'))"
chmod 600 /tmp/d.dae && dae validate -c /tmp/d.dae   # dae 在多数开发机可用
sing-box check -c /tmp/s.json && sing-box check -c /tmp/s13.json   # 可选
mihomo -t -f /tmp/c.yaml                              # 可选
# 3) 不变量 grep：QUIC 拦截在流媒体之前
grep -n "443" /tmp/c.yaml /tmp/surge.conf /tmp/qx.conf /tmp/d.dae
```

dae 会因 geosite.dat 缺规则集名报 `code xxx not found`——那是本机资产旧，不是产物错误；仓库用到的新集合名清单见 README。

## 已知坑（历史教训，别再踩）

- 堵 QUIC 修过三轮才齐（sing-box → dae → clash/surge/qx）：**改规则先 grep 所有 builder**，七产物逐一确认，别只改一个内核。
- Surge 规则集与 README 表格必须一致（AI 拆四个：OpenAI/Claude/Gemini/Copilot）。
- QX 节点名不允许逗号（`qxName()` 转全角）；Surge 参数值含 `,`/`=` 要加引号（`surgeKv()` 的 `wrap`）。
- `cdn.v2ex.com` 类案例：域名不在 geosite:cn 也不在 geolocation-!cn，靠兜底进代理——境内不可达的境外域名走 QUIC 黑洞时表现为"文字能开、图片转圈"，先怀疑 UDP 443。

## 参考

- mihomo 逻辑规则：`AND,((NETWORK,UDP),(DST-PORT,443)),REJECT`（MetaCubeX/Meta-Docs）
- Surge：PROTOCOL,UDP 覆盖 QUIC/STUN；DEST-PORT 支持范围/比较符（manual.nssurge.com/rules/）
- QX：UDP 过滤走 `[general] udp_drop_list`（crossutility/Quantumult-X sample.conf）
