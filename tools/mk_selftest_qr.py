#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 TapTap MCP 的本地缓存读出「刚上传的草稿版本」的 package_id，直接生成自测二维码。

为什么需要：自测码指向 `version_id`，而 version_id 就是 MCP 里草稿版本的 package_id，
上传成功后只存在于 MCP 缓存里；手抄容易抄错、也容易抄成线上版本的旧 id。

用法:
    python tools/mk_selftest_qr.py             # 默认 app 980929（山野修仙记）
    python tools/mk_selftest_qr.py 980929 <输出.png>
"""
import glob
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_APP = 980929
CACHE = os.path.join(os.environ.get('TEMP', '/tmp'), 'taptap-mcp', 'cache')


def find_app_json(app_id):
    hits = []
    for path in glob.glob(os.path.join(CACHE, '*', 'app.json')):
        try:
            d = json.load(open(path, encoding='utf-8'))
        except Exception:
            continue
        level = d.get('level') or {}
        if level.get('app_id') == app_id:
            hits.append((path, d))
    return hits


def main():
    app_id = int(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_APP
    hits = find_app_json(app_id)
    if not hits:
        raise SystemExit(f'缓存里找不到 app {app_id}：先在 MCP 里 select_app 再上传一次')
    path, d = hits[0]
    level = d['level']
    up = d.get('upload_level') or {}
    miniapp = level.get('miniapp_id')
    online_pid = (level.get('data') or {}).get('package_id')
    draft_pid = ((up.get('form_data') or {}).get('info') or {}).get('package_id')
    if not miniapp:
        raise SystemExit('缓存里没有 miniapp_id')
    if not draft_pid:
        raise SystemExit('缓存里没有草稿版本的 package_id（还没上传？）')
    if draft_pid == online_pid:
        raise SystemExit('草稿 package_id 与线上相同，可能还没换新包')

    out = sys.argv[2] if len(sys.argv) > 2 else None
    if out is None:
        tag = os.environ.get('SHANHE_QR_TAG', 'v952')
        out = str(ROOT / 'visual' / f'taptap-{tag}-selftest-qr.png')

    ver = up.get('version') or '?'
    print(f'  应用 {level.get("app_title")} ({app_id})')
    print(f'  草稿 {ver}（status {up.get("status")}）  package_id = {draft_pid}')
    print(f'  线上 {level.get("version")}（status {level.get("status")}）  package_id = {online_pid}')
    cmd = [sys.executable, '-X', 'utf8', str(ROOT / 'tools' / 'qr_write.py'),
           '--selftest', miniapp, str(draft_pid), out, '4']
    subprocess.run(cmd, check=True, cwd=str(ROOT))
    return 0


if __name__ == '__main__':
    sys.exit(main())
