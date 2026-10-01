// Substation · 订阅转 sing-box / Clash(Mihomo) / dae / Surge / QuantumultX / URI 列表 —— Cloudflare Worker
// 输出目标：
//   singbox        sing-box 1.14+ JSON（默认）
//   singbox-legacy sing-box 1.11–1.13 JSON（?v=1.13）
//   clash          Clash / Mihomo YAML（?t=clash），规则用 MetaCubeX .mrs（?t=clash&proxies=1 只出 proxies 节）
//   dae            dae (Linux eBPF) 配置（?t=dae），远程订阅走 /fetch 签名链接（?static=1 改为内嵌节点）
//   surge          Surge / Surfboard 配置（?t=surge），规则用 blackmatrix7 .list
//   qx             Quantumult X 配置（?t=qx），规则用 blackmatrix7 .list（QX 版）
//   uri            base64 分享链接列表（?t=uri），v2rayN/NG、Shadowrocket、Loon、NekoBox 等通用

const SB_UA = "SFA/1.14.2 (sing-box 1.14.2; Substation)";
const GH_RAW = "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat";
const STREAM = ["youtube", "netflix", "disney", "spotify", "tiktok"];
// Surge / QX 用 blackmatrix7（star 最多、持续维护）；下表 tag 与上面两套对齐，路径形如 <dir>/<file>.list
const BM7 = (flavor, dir, file) => `https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/rule/${flavor}/${dir}${file ? "/" + file : ""}.list`;
const BM7_RULE_SETS = [
  { tag: "ads", surge: BM7("Surge", "Advertising", "Advertising"), qx: BM7("QuantumultX", "Advertising", "Advertising") },
  { tag: "ai", surge: BM7("Surge", "OpenAI", "OpenAI"), qx: BM7("QuantumultX", "OpenAI", "OpenAI") },
  { tag: "ai-claude", surge: BM7("Surge", "Claude", "Claude"), qx: BM7("QuantumultX", "Claude", "Claude") },
  { tag: "ai-gemini", surge: BM7("Surge", "Gemini", "Gemini"), qx: BM7("QuantumultX", "Gemini", "Gemini") },
  { tag: "ai-copilot", surge: BM7("Surge", "Copilot", "Copilot"), qx: BM7("QuantumultX", "Copilot", "Copilot") },
  { tag: "ai-cn", surge: null, qx: null }, // blackmatrix7 无此集；国内 AI 域名已在 ChinaMax 主集里（deepseek/kimi/baichuan 各数百条）
  { tag: "telegram-sites", surge: BM7("Surge", "Telegram", "Telegram"), qx: BM7("QuantumultX", "Telegram", "Telegram") },
  ...STREAM.map((t) => {
    const D = { youtube: "YouTube", netflix: "Netflix", disney: "Disney", spotify: "Spotify", tiktok: "TikTok" }[t]; // blackmatrix7 目录是驼峰
    return { tag: t, surge: BM7("Surge", D, D), qx: BM7("QuantumultX", D, D) };
  }),
  { tag: "games", surge: BM7("Surge", "Game", "Game"), qx: BM7("QuantumultX", "Game", "Game") },
  { tag: "game-download", surge: BM7("Surge", "Game/GameDownloadCN", "GameDownloadCN"), qx: BM7("QuantumultX", "Game/GameDownloadCN", "GameDownloadCN") },
  { tag: "crypto", surge: BM7("Surge", "Cryptocurrency", "Cryptocurrency"), qx: BM7("QuantumultX", "Cryptocurrency", "Cryptocurrency") },
  { tag: "speedtest", surge: BM7("Surge", "Speedtest", "Speedtest"), qx: BM7("QuantumultX", "Speedtest", "Speedtest") },
  { tag: "apple-cn", surge: BM7("Surge", "Apple", "Apple"), qx: BM7("QuantumultX", "Apple", "Apple") },
  { tag: "microsoft-cn", surge: BM7("Surge", "Microsoft", "Microsoft"), qx: BM7("QuantumultX", "Microsoft", "Microsoft") },
  { tag: "proxy-domains", surge: BM7("Surge", "Global", "Global"), qx: BM7("QuantumultX", "Proxy", "Proxy") },
  { tag: "cn-domains", surge: BM7("Surge", "ChinaMax", "ChinaMax_Domain"), qx: null },
  { tag: "cn-rules", surge: BM7("Surge", "ChinaMax", "ChinaMax"), qx: BM7("QuantumultX", "ChinaMaxNoIP", "ChinaMaxNoIP") },
  { tag: "cn-ip", surge: BM7("Surge", "ChinaIPs", "ChinaIPs"), qx: BM7("QuantumultX", "ChinaIPs", "ChinaIPs") },
  { tag: "private-ip", surge: BM7("Surge", "Lan", "Lan"), qx: BM7("QuantumultX", "Lan", "Lan") },
];
// QX 的 AI 组：meta-rules-dat 的 category-ai-chat-!cn 在 blackmatrix7 拆成了 OpenAI/Claude/Gemini/Copilot
const QX_AI_TAGS = ["ai", "ai-claude", "ai-gemini", "ai-copilot"];
// QX 没有域名后缀集格式，cn 主集 ChinaMaxNoIP 自带 HOST 系规则（11 万行）
// 直连补充集（除 cn-domains/cn-ip 外）：国内 AI、测速站、游戏（含外服）/游戏下载 CDN、苹果/微软在华域名
// 注：这些域名基本不在 geosite:cn / geolocation-!cn 里，不显式列出会被兜底规则送进代理
// 谷歌不做 google@cn 直连：v2fly 的 google@cn 含 www.gstatic.com / fonts.gstatic.com 等实际被墙的域名，
// 直连会导致 YouTube 图标 / AI Studio 静态资源全部超时（gstatic 不在 geosite:cn 里，兜底自动进代理）
const DIRECT_SETS = ["ai-cn", "speedtest", "games", "game-download", "apple-cn", "microsoft-cn"];
const SING_RULE_SETS = [
  { tag: "ads", url: "https://anti-ad.net/anti-ad-sing-box.srs" },
  { tag: "geosite-ads", url: `${GH_RAW}/sing/geo/geosite/category-ads-all.srs` },
  { tag: "ai", url: `${GH_RAW}/sing/geo/geosite/category-ai-chat-%21cn.srs` },
  { tag: "ai-cn", url: `${GH_RAW}/sing/geo/geosite/category-ai-cn.srs` },
  { tag: "telegram-sites", url: `${GH_RAW}/sing/geo/geosite/telegram.srs` },
  { tag: "telegram-ip", url: `${GH_RAW}/sing/geo/geoip/telegram.srs` },
  ...STREAM.map((t) => ({ tag: t, url: `${GH_RAW}/sing/geo/geosite/${t}.srs` })),
  { tag: "games", url: `${GH_RAW}/sing/geo/geosite/category-games-%21cn.srs` },
  { tag: "game-download", url: `${GH_RAW}/sing/geo/geosite/category-game-platforms-download.srs` },
  { tag: "crypto", url: `${GH_RAW}/sing/geo/geosite/category-cryptocurrency.srs` },
  { tag: "speedtest", url: `${GH_RAW}/sing/geo/geosite/category-speedtest.srs` },
  { tag: "apple-cn", url: `${GH_RAW}/sing/geo/geosite/apple%40cn.srs` },
  { tag: "microsoft-cn", url: `${GH_RAW}/sing/geo/geosite/microsoft%40cn.srs` },
  { tag: "proxy-domains", url: `${GH_RAW}/sing/geo/geosite/geolocation-%21cn.srs` },
  { tag: "cn-domains", url: `${GH_RAW}/sing/geo/geosite/cn.srs` },
  { tag: "cn-ip", url: `${GH_RAW}/sing/geo/geoip/cn.srs` },
  { tag: "private-ip", url: `${GH_RAW}/sing/geo/geoip/private.srs` },
];
// Clash(mihomo) 用同一仓库 meta 分支的 .mrs；anti-AD 没有 mrs，广告只留 geosite 一路
const CLASH_RULE_SETS = [
  { tag: "ads", url: `${GH_RAW}/meta/geo/geosite/category-ads-all.mrs`, behavior: "domain" },
  { tag: "ai", url: `${GH_RAW}/meta/geo/geosite/category-ai-chat-%21cn.mrs`, behavior: "domain" },
  { tag: "ai-cn", url: `${GH_RAW}/meta/geo/geosite/category-ai-cn.mrs`, behavior: "domain" },
  { tag: "telegram-sites", url: `${GH_RAW}/meta/geo/geosite/telegram.mrs`, behavior: "domain" },
  { tag: "telegram-ip", url: `${GH_RAW}/meta/geo/geoip/telegram.mrs`, behavior: "ipcidr" },
  ...STREAM.map((t) => ({ tag: t, url: `${GH_RAW}/meta/geo/geosite/${t}.mrs`, behavior: "domain" })),
  { tag: "games", url: `${GH_RAW}/meta/geo/geosite/category-games-%21cn.mrs`, behavior: "domain" },
  { tag: "game-download", url: `${GH_RAW}/meta/geo/geosite/category-game-platforms-download.mrs`, behavior: "domain" },
  { tag: "crypto", url: `${GH_RAW}/meta/geo/geosite/category-cryptocurrency.mrs`, behavior: "domain" },
  { tag: "speedtest", url: `${GH_RAW}/meta/geo/geosite/category-speedtest.mrs`, behavior: "domain" },
  { tag: "apple-cn", url: `${GH_RAW}/meta/geo/geosite/apple%40cn.mrs`, behavior: "domain" },
  { tag: "microsoft-cn", url: `${GH_RAW}/meta/geo/geosite/microsoft%40cn.mrs`, behavior: "domain" },
  { tag: "proxy-domains", url: `${GH_RAW}/meta/geo/geosite/geolocation-%21cn.mrs`, behavior: "domain" },
  { tag: "cn-domains", url: `${GH_RAW}/meta/geo/geosite/cn.mrs`, behavior: "domain" },
  { tag: "cn-ip", url: `${GH_RAW}/meta/geo/geoip/cn.mrs`, behavior: "ipcidr" },
  { tag: "private-ip", url: `${GH_RAW}/meta/geo/geoip/private.mrs`, behavior: "ipcidr" },
];
const GROUPS = [
  { tag: "流媒体", sets: STREAM },
  { tag: "AI", sets: ["ai"] },
  { tag: "加密货币", sets: ["crypto"] },
  { tag: "电报", sets: ["telegram-sites", "telegram-ip"] },
];
// 地区分组：AI 组按地区分层（AI Studio / Gemini / ChatGPT 对 HK 等落地不友好，走美国/日本）。
// 关键词覆盖机场常见命名：emoji 旗帜 / 中文简繁 / 英文全称 / 主要城市；两字母缩写（us/jp）用词边界匹配，
// 避免 Australia 命中 "us"、Russia 类误判；dae 的 name(keyword:) 只能子串匹配，生成 dae 时会剔除两字母缩写。
const REGIONS = {
  US: ["🇺🇸", "美国", "美國", "united states", "america", "usa", "us", "los angeles", "洛杉矶", "san jose", "圣何塞", "seattle", "西雅图", "dallas", "达拉斯", "chicago", "芝加哥", "new york", "纽约", "phoenix", "凤凰城", "fremont", "硅谷"],
  JP: ["🇯🇵", "日本", "日本", "japan", "jp", "tokyo", "东京", "東京", "osaka", "大阪"],
};
const AI_REGIONS = ["US", "JP"];
function regionTags(nodes, region) {
  const words = REGIONS[region];
  return nodes.filter((n) => {
    const t = n.tag.toLowerCase();
    return words.some((k) => {
      const kw = k.toLowerCase();
      return /^[a-z]{2}$/.test(kw) ? new RegExp(`(^|[^a-z])${kw}([^a-z]|$)`).test(t) : t.includes(kw);
    });
  }).map((n) => n.tag);
}
// AI 的地区子组 [{ region, tags }]，没匹配到节点的地区剔除；全空则 AI 退回普通全节点组
function aiRegionGroups(nodes) {
  return AI_REGIONS.map((region) => ({ region, tags: regionTags(nodes, region) })).filter((g) => g.tags.length);
}
// dae 的组名用 ASCII（配置文件里是标识符）；分组用 name(keyword:) 过滤节点名。
// keyword 大小写行为未明确，每个词同时给原样 + 全小写两行；多行 filter 是“或”关系。
const DAE_EXPIRE_FILTER = "!name(keyword: 'ExpireAt:') && !name(keyword: '剩余') && !name(keyword: '到期')";
const DAE_KEYWORD_GROUPS = [
  { group: "Streaming", keywords: ["YouTube", "Netflix", "Disney", "Spotify", "TikTok", "HBO", "Prime Video", "流媒体"] },
  { group: "Telegram", keywords: ["Telegram", "电报"] },
];
const DEFAULT_SECRET = "substation-public-converter";

// ---------- 编解码 ----------

function b64dec(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  s += "=".repeat((4 - (s.length % 4)) % 4);
  return new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));
}

function b64enc(s) {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function stripComments(text) {
  return text.split(/\r?\n/).filter((l) => !l.trim().startsWith("//")).join("\n");
}

// 去掉 JSON 里的行尾 `//` 注释；按字符串感知扫描，不会误伤 "https://..." 这类字符串内容
function stripJsonComments(text) {
  let out = "", inStr = false, esc = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      out += c;
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; out += c; continue; }
    if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      out += "\n";
      continue;
    }
    out += c;
  }
  return out;
}

// /fetch?s=<token> 用：AES-GCM 把订阅 URL 藏进 token（SECRET 环境变量可换密钥）
// secret 先过 SHA-256 派生成 32 字节密钥，任意长度的 SECRET 都能用
const te = new TextEncoder();
async function aesKey(secret) {
  const digest = await crypto.subtle.digest("SHA-256", te.encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}
function b64url(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unb64url(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  s += "=".repeat((4 - (s.length % 4)) % 4);
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
async function seal(secret, url) {
  const key = await aesKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, te.encode(url)));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return b64url(out);
}
async function unseal(secret, token) {
  const raw = unb64url(token);
  if (raw.length <= 12) return null;
  const key = await aesKey(secret);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: raw.slice(0, 12) }, key, raw.slice(12));
  return new TextDecoder().decode(pt);
}

// ---------- URI / 面板订阅 → 内部节点模型 ----------
// 模型字段：{type, tag, server, server_port, ...type 专属}
//   ss: method,password,plugin?,plugin_opts?
//   vmess: uuid,security,alter_id,tls?,transport?
//   vless: uuid,flow?,tls?(reality/utls),transport?
//   trojan: password,tls?,transport?
//   hysteria2: password,obfs?,tls?
//   tuic: uuid,password,congestion_control,tls?
//   anytls: password,tls?

function uriToNode(uri) {
  let u;
  try {
    u = new URL(uri.replace(/^ss:/, "http:").replace(/^(vmess|vless|trojan|hysteria2|hy2|tuic|anytls):/, "http:"));
  } catch { return null; }
  const name = () => (u.hash ? decodeURIComponent(u.hash.slice(1)) : `${u.hostname}:${u.port}`);
  const scheme = uri.split(":")[0];
  const tlsPart = (sni, insecure) => ({
    enabled: true,
    server_name: sni || u.hostname,
    ...(insecure ? { insecure: true } : {}),
  });
  const q = u.searchParams;
  if (scheme === "ss") {
    let body = uri.slice(5).split("#")[0].split("?")[0];
    const at = body.lastIndexOf("@");
    let method, password, host, port;
    if (at >= 0) {
      let info = body.slice(0, at);
      if (!info.includes(":")) { try { info = b64dec(info); } catch { return null; } }
      const d = decodeURIComponent(info);
      const c = d.indexOf(":");
      if (c < 0) return null;
      method = d.slice(0, c);
      password = d.slice(c + 1);
      const hp = body.slice(at + 1);
      const colon = hp.lastIndexOf(":");
      host = hp.slice(0, colon);
      port = parseInt(hp.slice(colon + 1));
    } else {
      let d;
      try { d = b64dec(body); } catch { return null; }
      const c = d.indexOf(":");
      const colon = d.lastIndexOf(":");
      if (c < 0 || colon < 0) return null;
      method = d.slice(0, c);
      password = d.slice(c + 1, colon);
      const hp = d.slice(colon + 1);
      const p = hp.lastIndexOf(":");
      host = hp.slice(0, p);
      port = parseInt(hp.slice(p + 1));
    }
    if (!host || !port || !method || password === undefined) return null;
    const node = { type: "shadowsocks", tag: name(), server: host, server_port: port, method, password };
    const plugin = q.get("plugin");
    if (plugin) {
      const m = plugin.match(/obfs-local[^;]*;obfs=([^;]+);obfs-host=([^;]+)/) || plugin.match(/simple-obfs[^;]*;obfs=([^;]+);obfs-host=([^;]+)/);
      if (m) { node.plugin = "obfs-local"; node.plugin_opts = `obfs=${m[1]};obfs-host=${m[2]}`; }
      const v2 = plugin.match(/v2ray-plugin(;.*)?$/);
      if (v2) { node.plugin = "v2ray-plugin"; node.plugin_opts = v2[1] ? v2[1].replace(/^;/, "") : ""; }
    }
    return node;
  }
  if (scheme === "vmess") {
    let j;
    try { j = JSON.parse(b64dec(uri.slice(8))); } catch { return null; }
    if (!j || !j.add || !j.port || !j.id) return null;
    const node = {
      type: "vmess", tag: j.ps || `${j.add}:${j.port}`, server: j.add,
      server_port: +j.port, uuid: j.id, security: j.scy || "auto", alter_id: +(j.aid || 0),
    };
    if (j.tls === "tls" || j.tls === "reality") node.tls = tlsPart(j.sni || j.host, j.allowInsecure === "1" || j.verify_cert === "false");
    if (j.tls === "reality") node.tls.reality = { enabled: true, public_key: j.pbk || "", short_id: j.sid || "" };
    if (j.net === "ws") node.transport = { type: "ws", path: j.path || "/", ...(j.host ? { headers: { Host: j.host } } : {}) };
    else if (j.net === "grpc") node.transport = { type: "grpc", service_name: j.path || "" };
    else if (j.net === "http") node.transport = { type: "http", ...(j.host ? { host: [j.host] } : {}), path: j.path || "/" };
    return node;
  }
  if (scheme === "vless") {
    if (!u.username || !u.port) return null;
    const node = { type: "vless", tag: name(), server: u.hostname, server_port: +u.port, uuid: u.username };
    if (q.get("flow")) node.flow = q.get("flow");
    const sec = q.get("security");
    if (sec === "tls" || sec === "reality") {
      node.tls = tlsPart(q.get("sni"), q.get("allowInsecure") === "1");
      if (sec === "reality") {
        node.tls.reality = { enabled: true, public_key: q.get("pbk") || "", short_id: q.get("sid") || "" };
        node.tls.utls = { enabled: true, fingerprint: q.get("fp") || "chrome" };
      }
    }
    const net = q.get("type") || "tcp";
    if (net === "ws") node.transport = { type: "ws", path: q.get("path") || "/", ...(q.get("host") ? { headers: { Host: q.get("host") } } : {}) };
    else if (net === "grpc") node.transport = { type: "grpc", service_name: q.get("serviceName") || "" };
    else if (net === "http" || net === "h2") node.transport = { type: "http", ...(q.get("host") ? { host: [q.get("host")] } : {}), path: q.get("path") || "/" };
    return node;
  }
  if (scheme === "trojan") {
    if (!u.port) return null;
    const node = {
      type: "trojan", tag: name(), server: u.hostname, server_port: +u.port,
      password: decodeURIComponent(u.username || ""),
      tls: tlsPart(q.get("sni"), q.get("allowInsecure") === "1"),
    };
    const net = q.get("type") || "tcp";
    if (net === "ws") node.transport = { type: "ws", path: q.get("path") || "/", ...(q.get("host") ? { headers: { Host: q.get("host") } } : {}) };
    else if (net === "grpc") node.transport = { type: "grpc", service_name: q.get("serviceName") || "" };
    return node;
  }
  if (scheme === "hysteria2" || scheme === "hy2") {
    if (!u.port && !q.get("mport")) return null;
    return {
      type: "hysteria2", tag: name(), server: u.hostname,
      server_port: +u.port || parseInt(q.get("mport")) || 443,
      password: decodeURIComponent(u.username || ""),
      ...(q.get("obfs") ? { obfs: { type: "salamander", password: q.get("obfs-password") || "" } } : {}),
      tls: tlsPart(q.get("sni"), q.get("insecure") === "1"),
    };
  }
  if (scheme === "tuic") {
    if (!u.username || !u.port) return null;
    return {
      type: "tuic", tag: name(), server: u.hostname, server_port: +u.port,
      uuid: u.username, password: decodeURIComponent(u.password || ""),
      congestion_control: q.get("congestion_control") || "cubic",
      tls: tlsPart(q.get("sni"), q.get("allow_insecure") === "1" || q.get("insecure") === "1"),
    };
  }
  if (scheme === "anytls") {
    if (!u.port) return null;
    return {
      type: "anytls", tag: name(), server: u.hostname, server_port: +u.port,
      password: decodeURIComponent(u.username || ""),
      tls: tlsPart(q.get("sni"), q.get("insecure") === "1"),
    };
  }
  return null;
}

function parseUriList(text) {
  let lines = text.trim().split(/\r?\n/);
  if (lines.length === 1 && !lines[0].includes("://")) {
    try { lines = b64dec(lines[0]).split(/\r?\n/); } catch { }
  }
  const nodes = [];
  for (const raw of lines) {
    const l = raw.trim();
    if (!l || l.startsWith("#")) continue;
    let n = null;
    try { n = uriToNode(l); } catch { }
    if (n) nodes.push(n);
  }
  return nodes;
}

function uniqueTags(nodes) {
  const seen = new Set();
  for (const n of nodes) {
    let t = n.tag, i = 2;
    while (seen.has(t)) t = `${n.tag} ${i++}`;
    seen.add(t);
    n.tag = t;
  }
  return nodes;
}

// 面板返回的 sing-box JSON → 内部节点模型（不能表达的类型丢弃）
function panelNodes(cfg) {
  const ok = new Set(["shadowsocks", "vmess", "vless", "trojan", "hysteria2", "tuic", "anytls", "hysteria", "ssr", "wireguard", "ssh"]);
  return (cfg.outbounds || []).filter((o) => ok.has(o.type));
}

function panelToNode(o) {
  const base = { tag: o.tag, server: o.server, server_port: o.server_port };
  const tls = o.tls || {};
  const tr = o.transport || {};
  const tlsPart = tls.enabled ? { server_name: tls.server_name, ...(tls.insecure ? { insecure: true } : {}), ...(tls.reality ? { reality: tls.reality } : {}), ...(tls.utls ? { utls: tls.utls } : {}) } : null;
  switch (o.type) {
    case "shadowsocks":
      return { ...base, type: "shadowsocks", method: o.method, password: o.password, ...(o.plugin ? { plugin: o.plugin, plugin_opts: o.plugin_opts || "" } : {}) };
    case "vmess":
      return { ...base, type: "vmess", uuid: o.uuid, security: o.security || "auto", alter_id: o.alter_id || 0, ...(tlsPart ? { tls: tlsPart } : {}), ...(tr.type ? { transport: tr } : {}) };
    case "vless":
      return { ...base, type: "vless", uuid: o.uuid, ...(o.flow ? { flow: o.flow } : {}), ...(tlsPart ? { tls: tlsPart } : {}), ...(tr.type ? { transport: tr } : {}) };
    case "trojan":
      return { ...base, type: "trojan", password: o.password, ...(tlsPart ? { tls: tlsPart } : {}), ...(tr.type ? { transport: tr } : {}) };
    case "hysteria2":
      return { ...base, type: "hysteria2", password: o.password, ...(o.obfs ? { obfs: o.obfs } : {}), ...(tlsPart ? { tls: tlsPart } : {}) };
    case "tuic":
      return { ...base, type: "tuic", uuid: o.uuid, password: o.password, congestion_control: o.congestion_control || "cubic", ...(tlsPart ? { tls: tlsPart } : {}) };
    case "anytls":
      return { ...base, type: "anytls", password: o.password, ...(tlsPart ? { tls: tlsPart } : {}) };
    default:
      return null;
  }
}

// ---------- sing-box 输出 ----------

function adaptPanel(cfg, legacy) {
  const dns = (cfg.dns ||= {});
  if (legacy) {
    for (const s of dns.servers || []) {
      if (s.type && s.type !== "fakeip" && s.type !== "local" && s.server) {
        s.address = `${s.type}://${s.server}${s.path || ""}`;
        delete s.type; delete s.server; delete s.path;
      }
    }
    dns.independent_cache = true;
    const cf = ((cfg.experimental ||= {}).cache_file ||= {});
    if ("store_dns" in cf) { cf.store_rdrc = true; delete cf.store_dns; }
    for (const r of cfg.route?.rule_set || []) {
      if (r.http_client) { r.download_detour = "直连"; delete r.http_client; }
    }
    delete cfg.http_clients;
    if (cfg.route) delete cfg.route.default_http_client;
  } else {
    delete dns.independent_cache;
    const cf = ((cfg.experimental ||= {}).cache_file ||= {});
    if ("store_rdrc" in cf) { cf.store_dns = true; delete cf.store_rdrc; }
    const rs = cfg.route?.rule_set || [];
    if (Array.isArray(rs) && rs.some((r) => r.download_detour)) {
      const detour = rs.find((r) => r.download_detour)?.download_detour || "direct";
      cfg.http_clients = [{ tag: "default", detour }];
      cfg.route.default_http_client = "default";
      for (const r of rs) delete r.download_detour;
    }
  }
  return cfg;
}

function buildConfig(nodes, legacy) {
  const tags = nodes.map((n) => n.tag);
  const aiGroups = aiRegionGroups(nodes);
  const dnsServers = legacy
    ? [
        { tag: "dns-proxy", address: "https://8.8.8.8/dns-query", detour: "节点选择" },
        { tag: "dns-direct", address: "https://223.5.5.5/dns-query" },
        { tag: "dns-local", address: "local" },
        { tag: "fakeip", address: "fakeip" },
      ]
    : [
        { type: "https", tag: "dns-proxy", server: "8.8.8.8", detour: "节点选择" },
        { type: "https", tag: "dns-direct", server: "223.5.5.5" },
        { type: "local", tag: "dns-local" },
        { type: "fakeip", tag: "fakeip", inet4_range: "198.18.0.0/15", inet6_range: "fc00::/18" },
      ];
  const groupOb = GROUPS.map((g) => {
    if (g.tag !== "AI" || !aiGroups.length) return { type: "selector", tag: g.tag, outbounds: ["节点选择", "自动选择", "直连", ...tags] };
    return { type: "selector", tag: g.tag, outbounds: [...aiGroups.map((x) => `AI-${x.region}`), "节点选择", "自动选择", "直连", ...tags] };
  });
  const cfg = {
    log: { level: "warn", timestamp: true },
    experimental: {
      cache_file: { enabled: true, path: "cache.db", store_fakeip: true },
      clash_api: { external_controller: "127.0.0.1:9090", default_mode: "Rule" },
    },
    dns: {
      servers: dnsServers,
      rules: [
        { clash_mode: "Direct", server: "dns-direct" },
        { clash_mode: "Global", server: "dns-proxy" },
        { rule_set: ["cn-domains", ...DIRECT_SETS], server: "dns-direct" },
        { query_type: ["A", "AAAA"], server: "fakeip", disable_cache: true },
      ],
      final: "dns-proxy",
      strategy: "prefer_ipv4",
    },
    inbounds: [
      { type: "tun", tag: "tun-in", address: ["172.19.0.1/30", "fdfe:dcba:9876::1/126"], mtu: 9000, auto_route: true, strict_route: true },
      { type: "mixed", tag: "mixed-in", listen: "::", listen_port: 7890 },
    ],
    outbounds: [
      { type: "selector", tag: "节点选择", outbounds: ["自动选择", "直连", ...tags], default: "自动选择" },
      { type: "urltest", tag: "自动选择", outbounds: tags, url: "https://www.gstatic.com/generate_204", interval: "5m", tolerance: 50 },
      ...aiGroups.map((x) => ({ type: "urltest", tag: `AI-${x.region}`, outbounds: x.tags, url: "https://www.gstatic.com/generate_204", interval: "5m", tolerance: 50 })),
      ...groupOb,
      ...nodes,
      { type: "direct", tag: "直连" },
    ],
    route: {
      rule_set: SING_RULE_SETS.map(({ tag, url }) => ({
        type: "remote", tag, format: "binary", url, update_interval: "24h",
        ...(legacy ? { download_detour: "直连" } : {}),
      })),
      rules: [
        { action: "sniff" },
        { protocol: "dns", action: "hijack-dns" },
        { ip_is_private: true, rule_set: ["private-ip"], outbound: "直连" },
        { rule_set: ["ads", "geosite-ads"], action: "reject" },
        { rule_set: ["cn-domains", "cn-ip", ...DIRECT_SETS], outbound: "直连" },
        // 境外 QUIC(UDP 443) 常被链路黑洞或节点 UDP 不通 → 显式 reject 让浏览器立刻回退 TCP；
        // 放在国内直连之后，国内 App 的 HTTP/3 不受影响
        { network: "udp", port: 443, action: "reject" },
        { rule_set: STREAM, outbound: "流媒体" },
        { rule_set: ["ai"], outbound: "AI" },
        { rule_set: ["crypto"], outbound: "加密货币" },
        { rule_set: ["telegram-sites", "telegram-ip"], outbound: "电报" },
        { rule_set: ["proxy-domains"], outbound: "节点选择" },
      ],
      final: "节点选择",
      auto_detect_interface: true,
      default_domain_resolver: { server: "dns-direct", strategy: "prefer_ipv4" },
    },
  };
  if (legacy) {
    cfg.experimental.cache_file.store_rdrc = true;
    cfg.route.default_domain_resolver = { server: "dns-direct" };
  } else {
    cfg.experimental.cache_file.store_dns = true;
    cfg.http_clients = [{ tag: "default", detour: "直连" }];
    cfg.route.default_http_client = "default";
  }
  return cfg;
}

// ---------- Clash / Mihomo 输出（proxiesOnly=true 时只出 proxies 节，供 proxy-providers 引用） ----------

function clashTransport(tr) {
  if (!tr || !tr.type) return {};
  if (tr.type === "ws")
    return { network: "ws", "ws-opts": { path: tr.path || "/", ...(tr.headers?.Host ? { headers: { Host: tr.headers.Host } } : {}) } };
  if (tr.type === "grpc")
    return { network: "grpc", "grpc-opts": { "grpc-service-name": tr.service_name || "" } };
  if (tr.type === "http")
    return { network: "h2", "h2-opts": { ...(tr.host?.length ? { host: tr.host } : {}), path: tr.path || "/" } };
  return {};
}

function clashTls(n) {
  const t = n.tls;
  if (!t || !t.enabled) return {};
  const out = { tls: true, ...(t.server_name ? { servername: t.server_name } : {}), ...(t.insecure ? { "skip-cert-verify": true } : {}) };
  if (t.reality) out["reality-opts"] = { "public-key": t.reality.public_key || "", "short-id": t.reality.short_id || "" };
  if (t.utls?.fingerprint) out["client-fingerprint"] = t.utls.fingerprint;
  return out;
}

function clashNode(n) {
  const base = { name: n.tag, server: n.server, port: n.server_port, udp: true };
  switch (n.type) {
    case "shadowsocks": {
      const out = { ...base, type: "ss", cipher: n.method, password: n.password };
      if (n.plugin === "obfs-local") {
        const m = Object.fromEntries((n.plugin_opts || "").split(";").map((p) => p.split("=")));
        out.plugin = "obfs";
        out["plugin-opts"] = { mode: m.obfs || "http", ...(m["obfs-host"] ? { host: m["obfs-host"] } : {}) };
      } else if (n.plugin === "v2ray-plugin") {
        const opts = (n.plugin_opts || "").split(";").filter(Boolean);
        out.plugin = "v2ray-plugin";
        out["plugin-opts"] = { mode: "websocket", ...(opts.includes("tls") ? { tls: true } : {}), ...(opts.includes("mux") ? { mux: true } : {}) };
        for (const kv of opts) {
          const i = kv.indexOf("=");
          if (i > 0) out["plugin-opts"][kv.slice(0, i)] = kv.slice(i + 1);
        }
      }
      return out;
    }
    case "vmess":
      return {
        ...base, type: "vmess", uuid: n.uuid, alterId: n.alter_id || 0, cipher: n.security || "auto",
        ...clashTls(n), ...clashTransport(n.transport),
      };
    case "vless":
      return {
        ...base, type: "vless", uuid: n.uuid, ...(n.flow ? { flow: n.flow } : {}),
        ...clashTls(n), ...clashTransport(n.transport),
      };
    case "trojan":
      return {
        ...base, type: "trojan", password: n.password,
        ...clashTls(n), ...clashTransport(n.transport),
      };
    case "hysteria2":
      return {
        ...base, type: "hysteria2", password: n.password,
        ...(n.obfs ? { obfs: n.obfs.type, "obfs-password": n.obfs.password || "" } : {}),
        ...clashTls(n),
      };
    case "tuic":
      return { ...base, type: "tuic", uuid: n.uuid, password: n.password, alpn: ["h3"], "congestion-controller": n.congestion_control || "cubic", ...clashTls(n) };
    case "anytls":
      return { ...base, type: "anytls", password: n.password, ...clashTls(n) };
    default:
      return null;
  }
}

// --- 极简 YAML dumper（只覆盖本配置用到的形状；测试里用 PyYAML 回读校验） ---

function yamlScalar(v) {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  const s = String(v);
  const plain = /^[A-Za-z0-9_./:+=@^-][A-Za-z0-9_./:+=@^\s-]*$/.test(s)
    && !/^[\s]|[\s]$/.test(s)
    && !/^(true|false|null|yes|no|on|off|~)$/i.test(s.trim())
    && !/^\d[\d.]*$/.test(s.trim())
    && !s.includes(": ") && !s.includes(" #");
  return plain ? s : JSON.stringify(s);
}

function yamlLines(obj, ind) {
  const pad = "  ".repeat(ind);
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) {
      if (!v.length) { out.push(`${pad}${k}: []`); continue; }
      if (v.every((x) => typeof x !== "object" || x === null)) {
        out.push(`${pad}${k}:`);
        for (const it of v) out.push(`${pad}  - ${yamlScalar(it)}`);
      } else {
        out.push(`${pad}${k}:`);
        for (const it of v) {
          const sub = yamlLines(it, ind + 2);
          sub[0] = `${pad}  - ${sub[0].slice((ind + 2) * 2)}`;
          out.push(...sub);
        }
      }
    } else if (typeof v === "object") {
      if (!Object.keys(v).length) { out.push(`${pad}${k}: {}`); continue; }
      out.push(`${pad}${k}:`);
      out.push(...yamlLines(v, ind + 1));
    } else {
      out.push(`${pad}${k}: ${yamlScalar(v)}`);
    }
  }
  return out;
}

function buildClash(nodes, proxiesOnly = false) {
  const tags = nodes.map((n) => n.tag);
  const aiGroups = aiRegionGroups(nodes);
  const proxies = nodes.map(clashNode).filter(Boolean);
  if (proxiesOnly) return { proxies };
  return {
    "mixed-port": 7890,
    "allow-lan": false,
    mode: "rule",
    "log-level": "warning",
    ipv6: true,
    "unified-delay": true,
    "tcp-concurrent": true,
    "external-controller": "127.0.0.1:9090",
    dns: {
      enable: true,
      listen: "127.0.0.1:1053",
      ipv6: true,
      "enhanced-mode": "fake-ip",
      "fake-ip-range": "198.18.0.1/16",
      "fake-ip-filter": ["*.lan", "*.local"],
      "default-nameserver": ["223.5.5.5", "8.8.8.8"],
      nameserver: ["https://223.5.5.5/dns-query"],
      fallback: ["https://8.8.8.8/dns-query"],
      "fallback-filter": { geoip: true, "geoip-code": "CN" },
    },
    tun: {
      enable: true,
      stack: "mixed",
      "auto-route": true,
      "auto-detect-interface": true,
      "dns-hijack": ["any:53"],
    },
    proxies,
    "proxy-groups": [
      { name: "节点选择", type: "select", proxies: ["自动选择", "DIRECT", ...tags] },
      { name: "自动选择", type: "url-test", proxies: tags, url: "https://www.gstatic.com/generate_204", interval: 300, tolerance: 50 },
      ...GROUPS.map((g) => {
        if (g.tag !== "AI" || !aiGroups.length) return { name: g.tag, type: "select", proxies: ["节点选择", "自动选择", "DIRECT", ...tags] };
        return { name: g.tag, type: "select", proxies: [...aiGroups.map((x) => `AI-${x.region}`), "节点选择", "自动选择", "DIRECT", ...tags] };
      }),
      ...aiGroups.map((x) => ({ name: `AI-${x.region}`, type: "url-test", proxies: x.tags, url: "https://www.gstatic.com/generate_204", interval: 300, tolerance: 50 })),
    ],
    "rule-providers": Object.fromEntries(CLASH_RULE_SETS.map(({ tag, url, behavior }) => [
      tag, { type: "http", behavior, format: "mrs", url, path: `./ruleset/${tag}.mrs`, interval: 86400 },
    ])),
    rules: [
      "RULE-SET,private-ip,DIRECT,no-resolve",
      "RULE-SET,ads,REJECT",
      "RULE-SET,cn-domains,DIRECT",
      ...DIRECT_SETS.map((t) => `RULE-SET,${t},DIRECT`),
      "RULE-SET,cn-ip,DIRECT,no-resolve",
      ...STREAM.map((s) => `RULE-SET,${s},流媒体`),
      "RULE-SET,ai,AI",
      "RULE-SET,crypto,加密货币",
      "RULE-SET,telegram-sites,电报",
      "RULE-SET,telegram-ip,电报,no-resolve",
      "RULE-SET,proxy-domains,节点选择",
      "MATCH,节点选择",
    ],
  };
}

// ---------- Surge / Surfboard 输出 ----------
// 语法来源 manual.nssurge.com；规则集用 blackmatrix7 Surge 版（.list，免策略名）。
// 节点协议支持度：ss/vmess/trojan/tuic-v5/hysteria2/anytls，vless 不支持（跳过并在注释里标明）。

function surgeKv(n) {
  // Surge 参数值是逗号分隔的 key=value，含 , 或 = 的值必须加引号
  const wrap = (v) => (/[=,]/.test(v) ? `"${v}"` : v);
  const tls = n.tls?.enabled
    ? [...(n.tls.server_name ? [`sni=${n.tls.server_name}`] : []), ...(n.tls.insecure ? ["skip-cert-verify=true"] : [])]
    : [];
  const tr = n.transport;
  const ws = tr?.type === "ws"
    ? [`ws=true`, `ws-path=${tr.path || "/"}`, ...(tr.headers?.Host ? [`ws-headers=Host:${tr.headers.Host}`] : [])]
    : [];
  switch (n.type) {
    case "shadowsocks": {
      const kv = [`encrypt-method=${n.method}`, `password=${n.password}`, "udp-relay=true"];
      if (n.plugin === "obfs-local") {
        const m = Object.fromEntries((n.plugin_opts || "").split(";").map((p) => p.split("=")));
        kv.push(`obfs=${m.obfs || "http"}`, ...(m["obfs-host"] ? [`obfs-host=${m["obfs-host"]}`] : []));
      }
      return [`ss, ${n.server}, ${n.server_port}, ${kv.map((x) => wrap(x)).join(", ")}`];
    }
    case "vmess": {
      const kv = [`username=${n.uuid}`, `encrypt-method=${n.security || "auto"}`, "vmess-aead=true", ...tls, ...ws];
      return [`vmess, ${n.server}, ${n.server_port}, ${kv.map((x) => wrap(x)).join(", ")}`];
    }
    case "trojan": {
      const kv = [`password=${n.password}`, ...tls, ...ws];
      return [`trojan, ${n.server}, ${n.server_port}, ${kv.map((x) => wrap(x)).join(", ")}`];
    }
    case "hysteria2": {
      const kv = [`password=${n.password}`, ...(n.obfs ? [`salamander-password=${n.obfs.password || ""}`] : []), ...(n.tls?.insecure ? ["skip-cert-verify=true"] : [])];
      return [`hysteria2, ${n.server}, ${n.server_port}, ${kv.map((x) => wrap(x)).join(", ")}`];
    }
    case "tuic": {
      const kv = [`uuid=${n.uuid}`, `password=${n.password}`, `alpn=h3`, ...(n.tls?.insecure ? ["skip-cert-verify=true"] : [])];
      return [`tuic-v5, ${n.server}, ${n.server_port}, ${kv.map((x) => wrap(x)).join(", ")}`];
    }
    case "anytls": {
      const kv = [`password=${n.password}`, ...tls];
      return [`anytls, ${n.server}, ${n.server_port}, ${kv.map((x) => wrap(x)).join(", ")}`];
    }
    default:
      return null;
  }
}

// 节点名清洗：Surge 策略名不允许含 , 或（逗号是参数分隔符）
function surgeName(tag) {
  return tag.replace(/,/g, "，");
}

function buildSurge(nodes) {
  const usable = nodes.map((n) => ({ n, line: surgeKv(n) })).filter((x) => x.line);
  const dropped = nodes.length - usable.length;
  const names = usable.map(({ n }) => surgeName(n.tag));
  const nameOf = (n) => surgeName(n.tag);
  const rs = Object.fromEntries(BM7_RULE_SETS.map((r) => [r.tag, r.surge]));
  const hasClude = usable.some(({ n }) => /claude/i.test(n.tag));
  const aiSets = hasClude ? ["ai", "ai-claude"] : ["ai"];
  const aiGroups = aiRegionGroups(usable.map(({ n }) => n));
  const L = [];
  L.push(`#!MANAGED-CONFIG interval=86400 strict=false`);
  L.push(``);
  L.push(`[General]`);
  L.push(`loglevel = notify`);
  L.push(`dns-server = 223.5.5.5, 119.29.29.29`);
  L.push(`encrypted-dns-server = https://223.5.5.5/dns-query`);
  L.push(`skip-proxy = 127.0.0.1, 192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12, 100.64.0.0/10, localhost, *.local`);
  L.push(`ipv6 = true`);
  L.push(``);
  L.push(`[Proxy]`);
  for (const { n, line } of usable) L.push(`${nameOf(n)} = ${line}`);
  if (dropped) L.push(`# 有 ${dropped} 个节点因协议不支持（vless 等）被跳过`);
  L.push(``);
  L.push(`[Proxy Group]`);
  L.push(`节点选择 = select, 自动选择, DIRECT, ${names.join(", ")}`);
  L.push(`自动选择 = url-test, url=http://www.gstatic.com/generate_204, interval=600, ${names.join(", ")}`);
  for (const g of GROUPS) {
    if (g.tag === "AI" && aiGroups.length) { L.push(`AI = select, ${[...aiGroups.map((x) => `AI-${x.region}`), "节点选择", "自动选择", "DIRECT"].join(", ")}`); continue; }
    L.push(`${g.tag} = select, 节点选择, 自动选择, DIRECT, ${names.join(", ")}`);
  }
  for (const x of aiGroups) L.push(`AI-${x.region} = url-test, url=http://www.gstatic.com/generate_204, interval=600, ${x.tags.map((t) => surgeName(t)).join(", ")}`);
  L.push(``);
  L.push(`[Rule]`);
  L.push(`RULE-SET,${rs["private-ip"]},DIRECT,no-resolve`);
  L.push(`RULE-SET,${rs["ads"]},REJECT`);
  L.push(`DOMAIN-SET,${rs["cn-domains"]},DIRECT`);
  L.push(`RULE-SET,${rs["cn-rules"]},DIRECT,no-resolve`);
  for (const s of DIRECT_SETS) if (rs[s]) L.push(`RULE-SET,${rs[s]},DIRECT${s === "speedtest" || s === "games" ? ",no-resolve" : ""}`);
  for (const s of STREAM) L.push(`RULE-SET,${rs[s]},流媒体`);
  for (const s of aiSets) L.push(`RULE-SET,${rs[s]},AI`);
  L.push(`RULE-SET,${rs["crypto"]},加密货币`);
  L.push(`RULE-SET,${rs["telegram-sites"]},电报`);
  L.push(`RULE-SET,${rs["proxy-domains"]},节点选择`);
  L.push(`GEOIP,CN,DIRECT,no-resolve`);
  L.push(`FINAL,节点选择,dns-failed`);
  return L.join("\n") + "\n";
}

// ---------- Quantumult X 输出 ----------
// 语法来源 crossutility/Quantumult-X sample.conf；不支持 vless / hysteria2 / tuic（跳过并在注释里标明），
// 也不支持 reality（vless 专属，随 vless 一起跳过）。

function qxKv(n) {
  const tr = n.transport;
  const tlsHost = n.tls?.server_name || "";
  switch (n.type) {
    case "shadowsocks": {
      const kv = [`method=${n.method}`, `password=${n.password}`, "udp-relay=true"];
      if (n.plugin === "obfs-local") {
        const m = Object.fromEntries((n.plugin_opts || "").split(";").map((p) => p.split("=")));
        kv.push(`obfs=${m.obfs || "http"}`, ...(m["obfs-host"] ? [`obfs-host=${m["obfs-host"]}`] : []));
      }
      if (tr?.type === "ws") kv.push(n.tls?.enabled ? `obfs=wss` : `obfs=ws`, `obfs-uri=${tr.path || "/"}`, ...(tr.headers?.Host ? [`obfs-host=${tr.headers.Host}`] : []));
      return [`shadowsocks=${n.server}:${n.server_port}, ${kv.join(", ")}`];
    }
    case "vmess": {
      const kv = [`method=${n.security || "auto"}`, `password=${n.uuid}`, "aead=true"];
      if (tr?.type === "ws") kv.push(n.tls?.enabled ? `obfs=wss` : `obfs=ws`, `obfs-uri=${tr.path || "/"}`, ...(tr.headers?.Host || tlsHost ? [`obfs-host=${tr.headers?.Host || tlsHost}`] : []));
      else if (n.tls?.enabled) kv.push(`obfs=over-tls`, ...(tlsHost ? [`obfs-host=${tlsHost}`] : []));
      kv.push("udp-relay=true");
      return [`vmess=${n.server}:${n.server_port}, ${kv.join(", ")}`];
    }
    case "trojan": {
      const kv = [`password=${n.password}`, "udp-relay=true"];
      if (tr?.type === "ws") kv.push(n.tls?.enabled ? `obfs=wss` : `obfs=ws`, `obfs-uri=${tr.path || "/"}`, ...(tr.headers?.Host || tlsHost ? [`obfs-host=${tr.headers?.Host || tlsHost}`] : []));
      else { kv.push("over-tls=true", ...(tlsHost ? [`tls-host=${tlsHost}`] : [])); }
      return [`trojan=${n.server}:${n.server_port}, ${kv.join(", ")}`];
    }
    case "anytls": {
      const kv = [`password=${n.password}`, "over-tls=true", ...(tlsHost ? [`tls-host=${tlsHost}`] : [])];
      return [`anytls=${n.server}:${n.server_port}, ${kv.join(", ")}`];
    }
    default:
      return null;
  }
}

// QX 节点名不允许含逗号
function qxName(tag) {
  return tag.replace(/,/g, "，");
}

function buildQx(nodes) {
  const usable = nodes.map((n) => ({ n, line: qxKv(n) })).filter((x) => x.line);
  const dropped = nodes.length - usable.length;
  const names = usable.map(({ n }) => qxName(n.tag));
  const rs = Object.fromEntries(BM7_RULE_SETS.map((r) => [r.tag, r.qx]));
  const aiGroups = aiRegionGroups(usable.map(({ n }) => n));
  const L = [];
  L.push(`[general]`);
  L.push(`server_check_url = http://www.gstatic.com/generate_204`);
  L.push(`dns_exclusion_list = *.cmpassport.com, *.jegotrip.com.cn, *.icitymobile.mobi, id6.me`);
  L.push(``);
  L.push(`[dns]`);
  L.push(`server = 223.5.5.5`);
  L.push(`server = 119.29.29.29`);
  L.push(`doh-server = https://223.5.5.5/dns-query, https://8.8.8.8/dns-query`);
  L.push(``);
  L.push(`[policy]`);
  L.push(`static = 节点选择, 自动选择, direct, ${names.join(", ")}`);
  L.push(`available = 自动选择, ${names.join(", ")}`);
  for (const g of GROUPS) {
    if (g.tag === "AI" && aiGroups.length) L.push(`static = AI, ${[...aiGroups.map((x) => `AI-${x.region}`), "节点选择", "自动选择", "direct"].join(", ")}`);
    else L.push(`static = ${g.tag}, 节点选择, 自动选择, direct, ${names.join(", ")}`);
  }
  for (const x of aiGroups) L.push(`available = AI-${x.region}, ${x.tags.map((t) => qxName(t)).join(", ")}`);
  L.push(``);
  L.push(`[server_local]`);
  for (const { n, line } of usable) L.push(`${line}, tag=${qxName(n.tag)}`);
  if (dropped) L.push(`# 有 ${dropped} 个节点因协议不支持（vless/hysteria2/tuic）被跳过`);
  L.push(``);
  L.push(`[filter_remote]`);
  const remote = (tag, policy, extra = "") => L.push(`${rs[tag]}, tag=${tag}, force-policy=${policy}${extra ? ", " + extra : ""}`);
  remote("private-ip", "direct");
  remote("ads", "reject");
  remote("cn-rules", "direct");
  for (const s of DIRECT_SETS) if (rs[s]) remote(s, "direct");
  for (const s of STREAM) remote(s, "流媒体");
  for (const s of QX_AI_TAGS) remote(s, "AI");
  remote("crypto", "加密货币");
  remote("telegram-sites", "电报");
  remote("proxy-domains", "节点选择");
  L.push(``);
  L.push(`[filter_local]`);
  L.push(`geoip, cn, direct`);
  L.push(`final, 节点选择`);
  return L.join("\n") + "\n";
}

// ---------- URI 列表输出（base64 分享链接，v2rayN/NG、Shadowrocket、Loon、NekoBox 等通用） ----------

function b64std(s) {
  const bin = b64enc(s); // urlsafe 无填充
  return bin.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - (bin.length % 4)) % 4);
}

function buildUriList(nodes) {
  const uris = nodes.map(toShareURI).filter(Boolean);
  if (!uris.length) throw new Error("订阅中没有可转换的节点");
  return b64std(uris.join("\n") + "\n");
}

// ---------- dae 输出 ----------

function hostPort(n) {
  const host = n.server.includes(":") && !n.server.startsWith("[") ? `[${n.server}]` : n.server;
  return `${host}:${n.server_port}`;
}

// 内部节点 → 分享链接（dae 的 subscription/node 都吃这个格式）
function toShareURI(n) {
  const qp = new URLSearchParams();
  const sni = n.tls?.server_name || "";
  const tr = n.transport;
  if (tr?.type === "ws") {
    qp.set("type", "ws");
    qp.set("path", tr.path || "/");
    if (tr.headers?.Host) qp.set("host", tr.headers.Host);
  } else if (tr?.type === "grpc") {
    qp.set("type", "grpc");
    if (tr.service_name) qp.set("serviceName", tr.service_name);
  } else if (tr?.type === "http") {
    qp.set("type", "http");
    if (tr.host?.length) qp.set("host", tr.host.join(","));
    if (tr.path) qp.set("path", tr.path);
  }
  const tag = n.tag ? `#${encodeURIComponent(n.tag)}` : "";
  const qs = qp.toString();
  switch (n.type) {
    case "shadowsocks": {
      let p = "";
      if (n.plugin) {
        const full = n.plugin_opts ? `${n.plugin};${n.plugin_opts}` : n.plugin;
        p = `?plugin=${encodeURIComponent(full)}`;
      }
      return `ss://${b64enc(`${n.method}:${n.password}`)}@${hostPort(n)}${p}${tag}`;
    }
    case "vmess": {
      const wsHost = tr?.headers?.Host || tr?.host?.[0] || "";
      const j = {
        v: "2", ps: n.tag || "", add: n.server, port: String(n.server_port), id: n.uuid,
        aid: String(n.alter_id || 0), scy: n.security || "auto", net: tr?.type || "tcp", type: "none",
        host: wsHost, path: tr?.path || "", tls: n.tls?.enabled ? "tls" : "", sni,
        allowInsecure: n.tls?.insecure ? 1 : 0,
      };
      return `vmess://${b64enc(JSON.stringify(j))}`;
    }
    case "vless": {
      qp.set("encryption", "none");
      if (n.flow) qp.set("flow", n.flow);
      const sec = n.tls?.reality?.enabled ? "reality" : n.tls?.enabled ? "tls" : "";
      if (sec) {
        qp.set("security", sec);
        if (sni) qp.set("sni", sni);
        if (n.tls.insecure) qp.set("allowInsecure", "1");
        if (n.tls.reality?.enabled) {
          qp.set("pbk", n.tls.reality.public_key || "");
          if (n.tls.reality.short_id) qp.set("sid", n.tls.reality.short_id);
        }
      }
      if (n.tls?.utls?.fingerprint) qp.set("fp", n.tls.utls.fingerprint);
      const s = qp.toString();
      return `vless://${n.uuid}@${hostPort(n)}${s ? `?${s}` : ""}${tag}`;
    }
    case "trojan": {
      if (sni) qp.set("sni", sni);
      if (n.tls?.insecure) qp.set("allowInsecure", "1");
      if (!qp.get("type") && tr?.type) qp.set("type", tr.type);
      const s = qp.toString();
      return `trojan://${encodeURIComponent(n.password || "")}@${hostPort(n)}${s ? `?${s}` : ""}${tag}`;
    }
    case "hysteria2": {
      if (sni) qp.set("sni", sni);
      if (n.tls?.insecure) qp.set("insecure", "1");
      if (n.obfs) { qp.set("obfs", n.obfs.type || "salamander"); qp.set("obfs-password", n.obfs.password || ""); }
      const s = qp.toString();
      return `hysteria2://${encodeURIComponent(n.password || "")}@${hostPort(n)}${s ? `?${s}` : ""}${tag}`;
    }
    case "tuic": {
      if (sni) qp.set("sni", sni);
      if (n.tls?.insecure) qp.set("allow_insecure", "1");
      qp.set("congestion_control", n.congestion_control || "cubic");
      const s = qp.toString();
      return `tuic://${encodeURIComponent(n.uuid)}:${encodeURIComponent(n.password || "")}@${hostPort(n)}${s ? `?${s}` : ""}${tag}`;
    }
    case "anytls": {
      if (sni) qp.set("sni", sni);
      if (n.tls?.insecure) qp.set("insecure", "1");
      const s = qp.toString();
      return `anytls://${encodeURIComponent(n.password || "")}@${hostPort(n)}${s ? `?${s}` : ""}${tag}`;
    }
    default:
      return null;
  }
}

async function buildDae(nodes, { origin = "", secret = DEFAULT_SECRET, staticNodes = false } = {}) {
  const subToken = staticNodes || !origin ? null : await seal(secret, origin); // 占位：真实 URL 由调用方传入
  return buildDaeBody(nodes, { origin, secret, staticNodes, subToken, targetUrl: null });
}

function buildDaeBody(nodes, { origin = "", secret = DEFAULT_SECRET, staticNodes = false, subToken = null, targetUrl = null } = {}) {
  const usable = DAE_KEYWORD_GROUPS.filter((g) => {
    const words = g.keywords.flatMap((k) => [k, k.toLowerCase()]);
    return nodes.some((n) => words.some((k) => n.tag.toLowerCase().includes(k.toLowerCase())));
  });
  // AI 组 = 美国+日本并集（dae 组不能嵌套）；两字母缩写在 dae 里无法词边界匹配，剔除防误伤
  const aiKeywords = [...new Set(AI_REGIONS.flatMap((r) => REGIONS[r]).filter((k) => !/^[a-z]{2}$/.test(k)).flatMap((k) => [k, k.toLowerCase()]))];
  const hasAi = nodes.some((n) => aiKeywords.some((k) => n.tag.toLowerCase().includes(k.toLowerCase())));
  const groupName = (g) => (g === "AI" ? (hasAi ? "AI" : "Proxy") : usable.some((u) => u.group === g) ? g : "Proxy");
  const L = [];
  L.push(`global {`);
  L.push(`  wan_interface: auto`);
  L.push(`  log_level: info`);
  L.push(`  tcp_check_url: 'http://cp.cloudflare.com,1.1.1.1'`);
  L.push(`  udp_check_dns: 'dns.google:53,8.8.8.8'`);
  L.push(`  check_interval: 30s`);
  L.push(`  check_tolerance: 50ms`);
  L.push(`  dial_mode: domain`);
  L.push(`  allow_insecure: false`);
  L.push(`}`);
  L.push(``);
  if (staticNodes) {
    L.push(`node {`);
    for (const n of nodes) {
      const u = toShareURI(n);
      if (u) L.push(`  '${u}'`);
    }
    L.push(`}`);
  } else {
    const host = origin.replace(/^https?:\/\//, ""); // dae 的 https-file:// 后面直接跟主机名，不带 scheme
    L.push(`subscription {`);
    L.push(`  sub0: 'https-file://${host}/fetch?s=${subToken}'`);
    L.push(`}`);
    L.push(``);
    L.push(`node {`);
    L.push(`}`);
  }
  L.push(``);
  L.push(`dns {`);
  L.push(`  upstream {`);
  L.push(`    alidns: 'udp://dns.alidns.com:53'`);
  L.push(`    googledns: 'tcp+udp://dns.google:53'`);
  L.push(`  }`);
  L.push(`  routing {`);
  L.push(`    request {`);
  L.push(`      qname(geosite:cn) -> alidns`);
  L.push(`      fallback: googledns`);
  L.push(`    }`);
  L.push(`  }`);
  L.push(`}`);
  L.push(``);
  L.push(`group {`);
  if (staticNodes) {
    L.push(`  Proxy {`);
    L.push(`    policy: min_moving_avg`);
    L.push(`  }`);
  } else {
    L.push(`  Proxy {`);
    L.push(`    filter: subtag(sub0)`);
    L.push(`    policy: min_moving_avg`);
    L.push(`  }`);
  }
  if (hasAi) {
    L.push(`  AI {`);
    for (const k of aiKeywords) L.push(`    filter: name(keyword: '${k}') && ${DAE_EXPIRE_FILTER}`);
    L.push(`    policy: min_moving_avg`);
    L.push(`  }`);
  }
  for (const g of usable) {
    L.push(`  ${g.group} {`);
    for (const k of [...new Set(g.keywords.flatMap((k) => [k, k.toLowerCase()]))]) {
      L.push(`    filter: name(keyword: '${k}') && ${DAE_EXPIRE_FILTER}`);
    }
    L.push(`    policy: min_moving_avg`);
    L.push(`  }`);
  }
  L.push(`}`);
  L.push(``);
  L.push(`routing {`);
  L.push(`  pname(NetworkManager) -> direct`);
  L.push(`  dip(224.0.0.0/3, 'ff00::/8') -> direct`);
  L.push(`  dip(geoip:private) -> direct`);
  L.push(`  domain(geosite:category-ads-all) -> block`);
  L.push(`  dip(geoip:cn) -> direct`);
  L.push(`  domain(geosite:cn) -> direct`);
  for (const g of ["category-ai-cn", "category-speedtest", "category-games-!cn", "category-game-platforms-download", "apple@cn", "microsoft@cn"])
    L.push(`  domain(geosite:${g}) -> direct`);
  // 境外 QUIC(UDP 443) 常被链路黑洞或节点 UDP 不通 → block 让浏览器立刻回退 TCP；放在国内直连之后，国内 App 的 HTTP/3 不受影响
  L.push(`  l4proto(udp) && dport(443) -> block`);
  for (const t of STREAM) L.push(`  domain(geosite:${t}) -> ${groupName("Streaming")}`);
  L.push(`  domain(geosite:category-ai-chat-!cn) -> ${groupName("AI")}`);
  L.push(`  domain(geosite:category-cryptocurrency) -> Proxy`);
  L.push(`  domain(geosite:telegram) -> ${groupName("Telegram")}`);
  L.push(`  domain(geosite:geolocation-!cn) -> Proxy`);
  L.push(`  fallback: Proxy`);
  L.push(`}`);
  return L.join("\n") + "\n";
}

// ---------- 顶层转换入口 ----------

// 返回 { format: "singbox"|"yaml"|"dae", body }
export async function convertTo(text, target, opts = {}) {
  // 先删整行注释（面板 JSON 常用 // 打头写注释），再判是否面板；只有面板才清行尾 //（URI/base64 不能动）
  const stripped = stripComments(text).trim();
  const isPanel = stripped.startsWith("{") || stripped.startsWith("[");
  const t = isPanel ? stripJsonComments(stripped).trim() : stripped;
  if (target === "singbox" || target === "singbox-legacy") {
    const legacy = target === "singbox-legacy";
    if (isPanel) {
      try {
        const cfg = adaptPanel(JSON.parse(t), legacy);
        if (panelNodes(cfg).length) return { format: "singbox", body: cfg };
      } catch { }
    }
    const nodes = uniqueTags(parseUriList(t));
    if (!nodes.length) throw new Error("订阅中没有可解析的节点");
    return { format: "singbox", body: buildConfig(nodes, legacy) };
  }
  let nodes;
  if (isPanel) {
    let cfg;
    try { cfg = JSON.parse(t); } catch { throw new Error("订阅 JSON 解析失败"); }
    nodes = uniqueTags(panelNodes(cfg).map(panelToNode).filter(Boolean));
  } else {
    nodes = uniqueTags(parseUriList(t));
  }
  if (!nodes.length) throw new Error("订阅中没有可解析的节点");
  if (target === "clash") return { format: "yaml", body: yamlLines(buildClash(nodes, opts.proxiesOnly), 0).join("\n") + "\n" };
  if (target === "surge") return { format: "conf", body: buildSurge(nodes) };
  if (target === "qx") return { format: "conf", body: buildQx(nodes) };
  if (target === "uri") return { format: "text", body: buildUriList(nodes) };
  if (target === "dae") {
    const { origin = "", secret = DEFAULT_SECRET, staticNodes = false, url = null } = opts;
    let subToken = null;
    if (!staticNodes && origin) subToken = await seal(secret, url || origin);
    return { format: "dae", body: buildDaeBody(nodes, { origin, secret, staticNodes, subToken, targetUrl: url }) };
  }
  throw new Error(`unknown target: ${target}`);
}

// 兼容旧接口：convert(text, legacy) → sing-box 配置对象
export function convert(subText, legacy) {
  return convertTo(subText, legacy ? "singbox-legacy" : "singbox").then((r) => r.body);
}

// dae 订阅正文：面板 JSON → 节点分享链接列表；URI/base64 原样透传（dae 原生解析）
function daeSubBody(text) {
  const t = stripComments(text).trim();
  if (t.startsWith("{") || t.startsWith("[")) {
    try {
      const nodes = uniqueTags(panelNodes(JSON.parse(t)).map(panelToNode).filter(Boolean));
      if (nodes.length) return nodes.map(toShareURI).filter(Boolean).join("\n") + "\n";
    } catch { }
  }
  return text;
}

// ---------- 网页 ----------

const FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%232f6fed'/%3E%3Cpath d='M17.5 4 8 18h6l-1.5 10L22 14h-6l1.5-10z' fill='%23fff'/%3E%3C/svg%3E";

const PAGE = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" media="(prefers-color-scheme: light)" content="#f5f6f8">
<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0f1115">
<link rel="icon" href="${FAVICON}">
<title>Substation · 订阅转换</title>
<style>
:root{
  color-scheme:light dark;
  --bg:#f5f6f8;--card:#ffffff;--border:#e3e6ec;--input-bg:#fbfbfd;--text:#1b1f27;--muted:#697180;--faint:#9aa2b1;--accent:#2f6fed;
}
@media (prefers-color-scheme: dark){
  :root{--bg:#0f1115;--card:#171a21;--border:#262b36;--input-bg:#0f1115;--text:#e6e6e6;--muted:#8b93a3;--faint:#5b6472}
}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--bg);color:var(--text);font:15px/1.6 system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}
.card{width:min(560px,92vw);background:var(--card);border:1px solid var(--border);border-radius:14px;padding:28px}
h1{font-size:20px;margin:0 0 4px}.card h1 em{color:var(--accent);font-style:normal}
p.sub{margin:0 0 6px;color:var(--muted);font-size:13px}
label{display:block;font-size:13px;color:var(--muted);margin:14px 0 6px}
input,select{width:100%;padding:10px 12px;border-radius:9px;border:1px solid var(--border);background:var(--input-bg);color:var(--text);font-size:14px}
input:focus,select:focus{outline:none;border-color:var(--accent)}
.row{display:flex;gap:10px}.row>div{flex:1}
button{margin-top:18px;width:100%;padding:11px;border:0;border-radius:9px;background:var(--accent);color:#fff;font-size:15px;cursor:pointer}
button.ghost{background:var(--input-bg);color:var(--text);border:1px solid var(--border);margin-top:10px}button:disabled{opacity:.5;cursor:default}
#out,#daeout{margin-top:4px;display:none}
#link{word-break:break-all;background:var(--input-bg);border:1px solid var(--border);border-radius:9px;padding:10px 12px;font-size:13px}
#cfg{width:100%;height:260px;background:var(--input-bg);color:var(--text);border:1px solid var(--border);border-radius:9px;padding:10px 12px;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre;overflow:auto}
#prev{margin-top:10px;font-size:13px;color:var(--muted);line-height:1.8}
.hint{margin-top:10px;font-size:12px;color:var(--faint);line-height:1.7}
.ok{color:#16a34a}.err{color:#dc2626}
@media (prefers-color-scheme: dark){.ok{color:#4ade80}.err{color:#f87171}}
footer{margin-top:18px;font-size:12px;color:var(--faint);line-height:1.7}
</style>
</head>
<body>
<div class="card">
<h1>Substation<em> ·</em> 订阅转换</h1>
<p class="sub">粘贴机场订阅，生成 sing-box / Clash(Mihomo) / dae / Surge / Quantumult X / v2rayN 等可用的订阅链接或配置</p>
<label>订阅链接</label>
<input id="sub" placeholder="https://...">
<label>目标应用</label>
<select id="t">
<option value="sb">sing-box (SFA) 1.14+（默认）</option>
<option value="sb13">sing-box 1.11 – 1.13</option>
<option value="clash">Clash / Mihomo</option>
<option value="dae">dae（Linux eBPF）</option>
<option value="surge">Surge / Surfboard</option>
<option value="qx">Quantumult X</option>
<option value="uri">URI 列表（v2rayN/NG、Shadowrocket、Loon 等）</option>
</select>
<button id="genbtn" onclick="gen()">生成</button>
<div id="out">
<label>转换后的订阅链接（填进对应客户端的 Remote/订阅）</label>
<div id="link"></div>
<button class="ghost" onclick="cp(this)">复制链接</button>
<button class="ghost" onclick="prev(this)">预览节点</button>
<div id="prev"></div>
</div>
<div id="daeout">
<label>/etc/dae/config.d/substation.dae</label>
<textarea id="cfg" readonly spellcheck="false"></textarea>
<button class="ghost" onclick="cpcfg(this)">复制配置</button>
<p class="hint">配置里已内嵌签名订阅链接（https-file，内容缓存到 persist.d，断网也能起）。存到 /etc/dae/config.d/ 后 <code>systemctl reload dae</code>。Node 组默认自动选延迟最低，手动固定改成 <code>policy: fixed(序号)</code>。</p>
</div>
<footer>预览由本 Worker 实时转换，不存储你的订阅链接。生成的链接请自用，泄露等同于泄露订阅。</footer>
</div>
<script>
function gen(){
 var s=document.getElementById('sub').value.trim();
 if(!s){alert('先填订阅链接');return}
 var t=document.getElementById('t').value,base=location.origin;
 var b=document.getElementById('genbtn');
 if(t==='dae'){
  b.disabled=true;b.textContent='生成中…';
  fetch(base+'/?t=dae&url='+encodeURIComponent(s))
   .then(function(r){return r.text().then(function(x){return{ok:r.ok,txt:x}})})
   .then(function(o){
    b.disabled=false;b.textContent='生成';
    if(!o.ok){alert('生成失败：'+o.txt.slice(0,200));return}
    document.getElementById('cfg').value=o.txt;
    document.getElementById('daeout').style.display='block';
    document.getElementById('out').style.display='none';
   })
   .catch(function(e){b.disabled=false;b.textContent='生成';alert(e)});
  return;
 }
 var u=base+'/?url='+encodeURIComponent(s);
 if(t==='sb13')u+='&v=1.13';
 else if(t==='clash')u+='&t=clash';
 else if(t==='surge')u+='&t=surge';
 else if(t==='qx')u+='&t=qx';
 else if(t==='uri')u+='&t=uri';
 document.getElementById('link').textContent=u;
 document.getElementById('out').style.display='block';
 document.getElementById('daeout').style.display='none';
 document.getElementById('prev').textContent='';
}
function cp(b){
 var t=document.getElementById('link').textContent;
 navigator.clipboard.writeText(t).then(function(){b.textContent='已复制 ✓';setTimeout(function(){b.textContent='复制链接'},1500)});
}
function cpcfg(b){
 var t=document.getElementById('cfg').value;
 navigator.clipboard.writeText(t).then(function(){b.textContent='已复制 ✓';setTimeout(function(){b.textContent='复制配置'},1500)});
}
function prev(b){
 var l=document.getElementById('link').textContent;
 if(l.indexOf('t=clash')>=0||l.indexOf('t=surge')>=0||l.indexOf('t=qx')>=0||l.indexOf('t=uri')>=0){alert('预览仅支持 sing-box 链接');return}
 b.disabled=true;b.textContent='拉取中…';
 var p=document.getElementById('prev');p.textContent='';
 fetch(l)
 .then(function(r){var info=r.headers.get('subscription-userinfo')||'';return r.text().then(function(t){return{ok:r.ok,status:r.status,t:t,info:info}})})
 .then(function(o){
  b.disabled=false;b.textContent='预览节点';
  if(!o.ok){p.innerHTML='<span class="err">失败('+o.status+')：'+o.t.slice(0,200)+'</span>';return}
  var j=JSON.parse(o.t),nodes=[],groups=[],pt=['shadowsocks','vmess','vless','trojan','hysteria2','tuic','anytls','hysteria','ssr','wireguard','ssh'];
  j.outbounds.forEach(function(ob){if(pt.indexOf(ob.type)>=0)nodes.push(ob.tag);else groups.push(ob.tag)});
  var line='<span class="ok">共 '+nodes.length+' 个节点</span>';
  if(o.info)line+=' · '+o.info;
  line+='<br>分组：'+groups.join(' / ');
  line+='<br>节点：'+nodes.slice(0,5).join(' / ')+(nodes.length>5?' …':'');
  p.innerHTML=line;
 })
 .catch(function(e){b.disabled=false;b.textContent='预览节点';p.innerHTML='<span class="err">'+e+'</span>'});
}
</script>
</body>
</html>`;

// ---------- HTTP ----------

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": SB_UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return { text: await res.text(), info: res.headers.get("subscription-userinfo") || "" };
}

function targetOf(t) {
  if (t === "clash" || t === "mihomo") return "clash";
  if (t === "dae") return "dae";
  if (t === "surge" || t === "surfboard") return "surge";
  if (t === "qx" || t === "quantumultx" || t === "quantumult-x") return "qx";
  if (t === "uri" || t === "list" || t === "v2ray") return "uri";
  if (["1.11", "1.12", "1.13", "legacy"].includes(t)) return "singbox-legacy";
  return "singbox";
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const q = url.searchParams;
    const origin = `${url.protocol}//${url.host}`;
    const secret = env?.SECRET || DEFAULT_SECRET;

    if (url.pathname === "/fetch") {
      const target = await unseal(secret, q.get("s") || "").catch(() => null);
      if (!target) return new Response("bad token\n", { status: 400 });
      try {
        const { text } = await fetchText(target);
        return new Response(daeSubBody(text), {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "no-store",
            "access-control-allow-origin": "*",
          },
        });
      } catch (e) {
        return new Response(`fetch failed: ${e.message}\n`, { status: 502 });
      }
    }

    if (url.pathname !== "/") return new Response("not found\n", { status: 404 });

    const target = q.get("url");
    if (!target) return new Response(PAGE, { headers: { "content-type": "text/html; charset=utf-8" } });

    const kind = targetOf(q.get("t") ?? q.get("v") ?? "");
    try {
      // dae 风格的 https-file:// 订阅链接也能直接贴
      const { text, info } = await fetchText(target.replace(/^https-file:/, "https:"));
      const out = await convertTo(text, kind, {
        origin,
        secret,
        staticNodes: q.get("static") === "1",
        proxiesOnly: q.get("proxies") === "1",
        url: target.replace(/^https-file:/, "https:"),
      });
      const contentType =
        out.format === "yaml" ? "text/yaml; charset=utf-8"
        : out.format === "conf" ? "text/plain; charset=utf-8"
        : out.format === "dae" ? "text/plain; charset=utf-8"
        : out.format === "text" ? "text/plain; charset=utf-8"
        : "application/json; charset=utf-8";
      const body = out.format === "singbox" ? JSON.stringify(out.body, null, 2) : out.body;
      // 前两个是给订阅客户端显示流量/过期用的；profile-update-interval 是 Surge/QX 托管配置更新频率
      const managed = kind === "surge" || kind === "qx" || kind === "uri";
      return new Response(body, {
        headers: {
          "content-type": contentType,
          "cache-control": "no-store",
          "access-control-allow-origin": "*",
          ...(info && kind !== "dae" ? { "subscription-userinfo": info } : {}),
          ...(managed ? { "profile-update-interval": "24" } : {}),
        },
      });
    } catch (e) {
      return new Response(`convert failed: ${e.message}\n`, { status: 502 });
    }
  },
};
