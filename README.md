# sub2singbox

通用订阅 → sing-box 配置转换的 Cloudflare Worker。部署一次，SFA 里填 URL 自动更新；规则用 MetaCubeX / anti-ad 的远程 rule-set（24h 自动刷新），节点配置在 SFA 里点“检查更新”即可。

## 部署（Cloudflare 网页，5 分钟）

1. GitHub 登录 [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages → Create → Workers → Create Worker**，随便起个名（如 `sub2singbox`）→ Deploy
2. 进入该 Worker → **Edit code**：全选删掉示例代码，把 `worker.js` 内容粘贴进去 → **Deploy**
3. **Settings → Variables and Secrets** 添加：
   - `SUB_URL`（你的订阅链接，自用推荐）
   - `TOKEN`（自定义一串随机字符，防止链接被扫）
4. 想绑定自己的域名：**Settings → Domains & Routes → Add → Custom domain**（国内直连可用，绕开 workers.dev 被墙问题）

## 使用

```
https://<worker域名>/?token=<TOKEN>                          # 用环境变量 SUB_URL
https://<worker域名>/?token=<TOKEN>&url=<订阅链接urlencode>   # 转任意订阅
https://<worker域名>/?token=<TOKEN>&v=1.13                   # 兼容旧版 sing-box (1.11–1.13)
```

- SFA（sing-box for Android）：Profiles → + → Type: Remote → URL 填上面链接
- 每次更新订阅时 Worker 实时拉最新内容转换；规则集由 SFA 运行时每 24h 自动更新

## 输出内容

- 面板原生 sing-box JSON（带 sing-box UA 拉取）→ 清洗注释 + 目标版本字段适配（`store_rdrc`/`store_dns`、`download_detour`/`http_clients`、旧/新 DNS server 格式）
- URI 列表（base64 或明文）→ 完整配置：`ss` / `vmess` / `vless`(含 reality) / `trojan` / `hysteria2` / `tuic` / `anytls` 解析 + 分组（节点选择 / 自动选择 / 流媒体 / AI / 电报 / 国内）+ 分流（广告 REJECT、国内直连、代理、FakeIP、clash_api）

## 规则源

| 规则 | 来源 |
|---|---|
| 广告 | anti-ad.net + MetaCubeX `category-ads-all` |
| 国内 | MetaCubeX `geosite/cn` + `geoip/cn` |
| 国外 | `geolocation-!cn` |
| AI | `category-ai-chat-!cn` |
| 流媒体 | youtube / netflix / disney / spotify / tiktok |
| Telegram | geosite + geoip telegram |

全部 remote rule-set，`update_interval: 24h`，SFA 自动拉新。

## 本地验证

```bash
node --experimental-vm-modules -e "..."
# 或直接用 sing-box check 验证产物（见 repo 测试脚本 test.sh）
```
