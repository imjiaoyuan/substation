const SB_UA = "SFA/1.14.2 (sing-box 1.14.2; sbsub)";
const GH_RAW = "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo";
const STREAM = ["youtube", "netflix", "disney", "spotify", "tiktok"];
const RULE_SETS = [
  { tag: "ads", url: "https://anti-ad.net/anti-ad-sing-box.srs" },
  { tag: "geosite-ads", url: `${GH_RAW}/geosite/category-ads-all.srs` },
  { tag: "ai", url: `${GH_RAW}/geosite/category-ai-chat-%21cn.srs` },
  { tag: "telegram-sites", url: `${GH_RAW}/geosite/telegram.srs` },
  { tag: "telegram-ip", url: `${GH_RAW}/geoip/telegram.srs` },
  ...STREAM.map((t) => ({ tag: t, url: `${GH_RAW}/geosite/${t}.srs` })),
  { tag: "proxy-domains", url: `${GH_RAW}/geosite/geolocation-%21cn.srs` },
  { tag: "cn-domains", url: `${GH_RAW}/geosite/cn.srs` },
  { tag: "cn-ip", url: `${GH_RAW}/geoip/cn.srs` },
  { tag: "private-ip", url: `${GH_RAW}/geoip/private.srs` },
];
const GROUPS = [
  { tag: "流媒体", sets: STREAM },
  { tag: "AI", sets: ["ai"] },
  { tag: "电报", sets: ["telegram-sites", "telegram-ip"] },
];

function b64dec(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  s += "=".repeat((4 - (s.length % 4)) % 4);
  return new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));
}

function stripComments(text) {
  return text.split(/\r?\n/).filter((l) => !l.trim().startsWith("//")).join("\n");
}

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
      const v2 = plugin.match(/v2ray-plugin([;论].*)?$/);
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

function panelNodes(cfg) {
  const ok = new Set(["shadowsocks", "vmess", "vless", "trojan", "hysteria2", "tuic", "anytls", "hysteria", "ssr", "wireguard", "ssh"]);
  return (cfg.outbounds || []).filter((o) => ok.has(o.type));
}

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
  const groupOb = GROUPS.map((g) => ({ type: "selector", tag: g.tag, outbounds: ["节点选择", "自动选择", "直连", ...tags] }));
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
        { rule_set: "cn-domains", server: "dns-direct" },
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
      ...groupOb,
      ...nodes,
      { type: "direct", tag: "直连" },
    ],
    route: {
      rule_set: RULE_SETS.map(({ tag, url }) => ({
        type: "remote", tag, format: "binary", url, update_interval: "24h",
        ...(legacy ? { download_detour: "直连" } : {}),
      })),
      rules: [
        { action: "sniff" },
        { protocol: "dns", action: "hijack-dns" },
        { ip_is_private: true, rule_set: ["private-ip"], outbound: "直连" },
        { rule_set: ["ads", "geosite-ads"], action: "reject" },
        { rule_set: ["cn-domains", "cn-ip"], outbound: "直连" },
        { rule_set: STREAM, outbound: "流媒体" },
        { rule_set: ["ai"], outbound: "AI" },
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

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": SB_UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return { text: await res.text(), info: res.headers.get("subscription-userinfo") || "" };
}

export function convert(subText, legacy) {
  const t = stripComments(subText).trim();
  if (t.startsWith("{") || t.startsWith("[")) {
    try {
      const cfg = adaptPanel(JSON.parse(t), legacy);
      if (panelNodes(cfg).length) return cfg;
    } catch { }
  }
  const nodes = uniqueTags(parseUriList(t));
  if (!nodes.length) throw new Error("订阅中没有可解析的节点");
  return buildConfig(nodes, legacy);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (env.TOKEN && url.searchParams.get("token") !== env.TOKEN)
      return new Response("forbidden\n", { status: 403 });
    const target = url.searchParams.get("url") || env.SUB_URL;
    if (!target)
      return new Response("missing url: pass ?url=<encoded> or set SUB_URL\n", { status: 400 });
    const legacy = ["1.11", "1.12", "1.13", "legacy"].includes(url.searchParams.get("v"));
    try {
      const { text, info } = await fetchText(target);
      const cfg = convert(text, legacy);
      return new Response(JSON.stringify(cfg, null, 2), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
          ...(info ? { "subscription-userinfo": info } : {}),
        },
      });
    } catch (e) {
      return new Response(`convert failed: ${e.message}\n`, { status: 502 });
    }
  },
};
