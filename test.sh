#!/usr/bin/env bash
# 本地验证 worker.js 的转换产物：sing-box(新/旧) x mihomo x dae 四内核全查
# 依赖: node；可选: sing-box 双内核(SB/SB_LEGACY)、mihomo(MIHOMO)、dae(DAE)、python3+pyyaml
# 测试输入: ../data/singbox_revx.json（面板样例）、/tmp/sub.txt（URI 样例）、/tmp/sub_fake.txt（关键词分组样例，可选）
set -e
cd "$(dirname "$0")"

SB=${SB:-/tmp/sing-box-1.14.2-linux-amd64/sing-box}
SB_LEGACY=${SB_LEGACY:-/tmp/sing-box-1.12.4-linux-amd64/sing-box}
MIHOMO=${MIHOMO:-/tmp/mihomo}
DAE=${DAE:-dae}
export PANEL=${PANEL:-../data/singbox_revx.json}
export URIS=${URIS:-/tmp/sub.txt}
export FAKE=${FAKE:-/tmp/sub_fake.txt}
OUT=/tmp/.s2s_out
mkdir -p $OUT

node --input-type=module << 'EOF'
import { readFileSync, writeFileSync } from 'fs';
writeFileSync('/tmp/.s2s_worker.mjs', readFileSync('worker.js', 'utf8'));
const { convertTo, default: worker } = await import('/tmp/.s2s_worker.mjs');
const { existsSync } = await import('fs');
const env = process.env;
const inputs = { panel: readFileSync(env.PANEL, 'utf8'), uri: readFileSync(env.URIS, 'utf8') };
if (existsSync(env.FAKE)) inputs.fake = readFileSync(env.FAKE, 'utf8');
const secret = 'ssub-public-converter';
const origin = 'https://ssub.example.workers.dev';
// /fetch 回环用：自包含的 data: 订阅（seal 进 token，再从 /fetch 解出来），不依赖外网
const DATA_SUB = `data:text/plain;base64,${Buffer.from('ss://YWVzLTI1Ni1nY206dGVzdC1wYXNzd29yZA==@1.2.3.4:8388#loop-test\n').toString('base64')}`;

// 各种产物
const jobs = [
  ['panel', 'singbox', 'sb_modern', {}],
  ['panel', 'singbox-legacy', 'sb_legacy', {}],
  ['uri', 'singbox', 'sb_uri_modern', {}],
  ['uri', 'singbox-legacy', 'sb_uri_legacy', {}],
  ['panel', 'clash', 'clash_panel', {}],
  ['uri', 'clash', 'clash_uri', {}],
  ['panel', 'dae', 'dae_panel', { origin, secret }],
  ['uri', 'dae', 'dae_uri', { origin, secret, url: DATA_SUB }],
  ['uri', 'dae', 'dae_static', { origin, secret, staticNodes: true }],
];
if (inputs.fake) jobs.push(['fake', 'dae', 'dae_fake', { origin, secret, staticNodes: true }]);
for (const [src, target, name, opts] of jobs) {
  const r = await convertTo(inputs[src], target, opts);
  const ext = r.format === 'singbox' ? 'json' : r.format === 'yaml' ? 'yaml' : 'dae';
  writeFileSync(`/tmp/.s2s_out/${name}.${ext}`, r.format === 'singbox' ? JSON.stringify(r.body, null, 2) : r.body);
  console.log(`generated ${name} (${src} -> ${target})`);
}

// 页面与端点冒烟
const page = await worker.fetch(new Request('https://x.dev/'), {});
const pt = await page.text();
const checks = [
  ['GET / 200', page.status === 200 && page.headers.get('content-type').includes('text/html')],
  ['页面没有残留的 tk 元素（旧 bug）', !pt.includes("'tk'") && !pt.includes('getElementById("tk")')],
  ['gen() 引用的元素都在页面里', ['sub', 't', 'genbtn', 'link', 'out', 'daeout', 'prev', 'cfg'].every((id) => pt.includes(`id="${id}"`))],
  ['暗色模式适配', pt.includes('prefers-color-scheme: dark') && pt.includes('color-scheme:light dark')],
  ['favicon 内联（不再 400/404）', pt.includes('rel="icon"') && pt.includes('data:image/svg+xml')],
];
for (const p of ['/favicon.ico', '/xyz']) {
  const r = await worker.fetch(new Request('https://x.dev' + p), {});
  checks.push([`${p} -> ${r.status}`, r.status === 404]);
}
// /fetch 签名订阅：从生成的 dae 配置里取 token，worker.fetch 解密回 URI 列表（token 内嵌 data: 订阅，自包含）
const daeText = readFileSync('/tmp/.s2s_out/dae_uri.dae', 'utf8');
const m = daeText.match(/\/fetch\?s=([A-Za-z0-9_-]+)/);
const resp = await worker.fetch(new Request(`https://x.dev/fetch?s=${m[1]}`), {});
const body = await resp.text();
checks.push(['/fetch 解密订阅 200', resp.status === 200 && body.split('\n').some((l) => l.startsWith('ss://'))]);
const bad = await worker.fetch(new Request('https://x.dev/fetch?s=broken'), {});
checks.push(['/fetch 坏 token 400', bad.status === 400]);

let fail = 0;
for (const [name, ok] of checks) { console.log(`${ok ? '✅' : '❌'} ${name}`); if (!ok) fail = 1; }
writeFileSync('/tmp/.s2s_out/.smoke', String(fail));
EOF

FAIL=$(cat $OUT/.smoke 2>/dev/null || echo 1)
rm -f $OUT/.smoke

chk() { # chk <说明> <命令...>
  local desc=$1; shift
  if "$@" >/dev/null 2>$OUT/err; then echo "✅ $desc"; else echo "❌ $desc:"; tail -3 $OUT/err; FAIL=1; fi
}

[ -x "$SB" ] && chk "sing-box check 1.14 [panel]" $SB check -c $OUT/sb_modern.json \
  && chk "sing-box check 1.14 [uri]" $SB check -c $OUT/sb_uri_modern.json
[ -x "$SB_LEGACY" ] && chk "sing-box check 1.12 [panel]" $SB_LEGACY check -c $OUT/sb_legacy.json \
  && chk "sing-box check 1.12 [uri]" $SB_LEGACY check -c $OUT/sb_uri_legacy.json

if [ -x "$MIHOMO" ]; then
  chk "mihomo -t [uri]" $MIHOMO -t -f $OUT/clash_uri.yaml
  chk "mihomo -t [panel]" $MIHOMO -t -f $OUT/clash_panel.yaml
  chk "YAML 语法（pyyaml 回读）" python3 -c "import yaml,sys; d=yaml.safe_load(open('$OUT/clash_uri.yaml')); assert d['proxies'] and d['proxy-groups'] and d['rules']"
fi

if command -v "$DAE" >/dev/null; then
  for f in $OUT/dae_*.dae; do chmod 600 "$f"; chk "dae validate $(basename $f)" $DAE validate -c "$f"; done
fi

[ "$FAIL" = 0 ] && echo "all passed" || { echo "FAILED"; exit 1; }
echo done
