#!/usr/bin/env bash
# 本地验证 worker.js 的转换产物：双版本 x 双来源 全部过 sing-box check
# 依赖: node、sing-box 内核（SB / SB_LEGACY 环境变量可覆盖）、../data/singbox_revx.json、/tmp/sub.txt
set -e
cd "$(dirname "$0")"

SB=${SB:-/tmp/sing-box-1.14.2-linux-amd64/sing-box}
SB_LEGACY=${SB_LEGACY:-/tmp/sing-box-1.12.4-linux-amd64/sing-box}
export PANEL=${PANEL:-../data/singbox_revx.json}
export URIS=${URIS:-/tmp/sub.txt}

node --input-type=module << 'EOF'
import { readFileSync, writeFileSync } from 'fs';
writeFileSync('/tmp/.s2s_worker.mjs', readFileSync('worker.js', 'utf8'));
const { convert } = await import('/tmp/.s2s_worker.mjs');
const panel = readFileSync(process.env.PANEL, 'utf8');
const uris = readFileSync(process.env.URIS, 'utf8');
for (const legacy of [false, true]) {
  const v = legacy ? 'legacy' : 'modern';
  writeFileSync(`.out_panel_${v}.json`, JSON.stringify(convert(panel, legacy), null, 2));
  writeFileSync(`.out_uri_${v}.json`, JSON.stringify(convert(uris, legacy), null, 2));
  console.log(`generated panel/${v} uri/${v}`);
}
EOF

for ver in modern legacy; do
  [ $ver = modern ] && BIN=$SB || BIN=$SB_LEGACY
  if [ ! -x "$BIN" ]; then echo "skip $ver: $BIN 不存在"; continue; fi
  for src in panel uri; do
    if $BIN check -c ".out_${src}_${ver}.json" 2> /tmp/.s2s_err; then
      echo "✅ sing-box check [$src/$ver] ($BIN)"
    else
      echo "❌ [$src/$ver]:"; tail -3 /tmp/.s2s_err
    fi
  done
done
rm -f .out_*.json
echo done
