#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成「打开即在档」的金丹试炼页面。

- 基线：V90.10 发布文件（哈希校验）
- 在 <body> 之后、游戏脚本之前注入：把存档写入 localStorage 的 001 档位
- 页面加载后自动点进 001 档，直接落地在丹霞雷渊 · 筑基后期
产物：play/jindan/index.html
"""
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
import sys as _sys
_argbase = next((a for a in _sys.argv[1:] if a.endswith('.html')), None)
BASE = Path(_argbase) if _argbase else ROOT / "releases" / "山野修仙记_V90.10_界面密度与检索优化版.html"
SAVE = ROOT / "saves" / "shanhe-v910-jindan-ready.json"
_outdir = next((a for a in _sys.argv[1:] if not a.endswith('.html')), "jindan")
OUT = ROOT / "play" / _outdir / "index.html"

BASE_SHA = "FC024760C3D0FF710ADB2D49D51A84EC3738B3B3F3D8DED77FB227DCE3731AC0"
SLOT_KEY = "qinglan-wendao-v14-human-slot-001"

SEED_TMPL = """
<script id="seed-save" type="application/json">__SAVE__</script>
<script>
/* 打开即在档：先把存档写进 001 档位，再自动进入 */
(function(){
  try{
    var raw = document.getElementById('seed-save').textContent.trim();
    if(!raw) throw new Error('empty seed');
    var force = /[?&]reset=1/.test(location.search);
    var had = localStorage.getItem('__SLOT__');
    if (had && !force) {
      window.__SEEDED__ = false;
      window.__SEED_SKIPPED__ = true;
      console.log('[seed] 已有存档，跳过播种（加 ?reset=1 可回到金丹前一步）');
      return;
    }
    localStorage.setItem('__SLOT__', raw);
    localStorage.setItem('__SLOT__-backup', raw);
    window.__SEEDED__ = true;
    console.log('[seed] 已写入 001 档位，' + raw.length + ' 字符');
  }catch(e){
    window.__SEED_ERR__ = String(e && e.message || e);
    console.error('[seed] 写入失败：' + window.__SEED_ERR__);
  }
})();
</script>
"""

AUTO_TMPL = """
<script>
/* 轮询式自动进入：按钮出现才点，进游戏后自然停止（无副作用） */
(function(){
  var n = 0;
  function has(sel){ return document.querySelector(sel); }
  function tick(){
    if (++n > 60) return;
    if (!has('[data-a="view-slots"]') && !has('[data-a="slot-open"]')) {
      // 落地后再兜底关掉可能的引导/介绍弹窗
      setTimeout(function(){
        var c = document.querySelector('[data-a="modal-close"]') || document.querySelector('[data-a="guide"][data-mode="pause"]');
        if (c) c.click();
      }, 700);
      window.__LANDED__ = true; return;
    }
    if (has('[data-a="view-slots"]')) { has('[data-a="view-slots"]').click(); return setTimeout(tick, 550); }
    if (has('[data-a="slot-open"][data-slot="1"]')) { has('[data-a="slot-open"][data-slot="1"]').click(); return setTimeout(tick, 900); }
    if (has('[data-a="modal-close"]')) { has('[data-a="modal-close"]').click(); }
    setTimeout(tick, 400);
  }
  window.addEventListener('load', function(){ setTimeout(tick, 600); });
})();
</script>
"""


def main():
    print("生成「打开即在档」页面\n")
    if not BASE.exists():
        raise SystemExit(f"缺少基线：{BASE}")
    if not SAVE.exists():
        raise SystemExit(f"缺少存档：{SAVE}")

    raw = BASE.read_bytes()
    _h = hashlib.sha256(raw).hexdigest().upper()
    if BASE.name.count("V90.10") and _h != BASE_SHA:
        raise SystemExit("基线哈希不符")
    print(f"  [OK] 基线 {len(raw):,} B")

    text = raw.decode("utf-8").replace("\r\n", "\n")
    save_text = SAVE.read_text(encoding="utf-8").strip()
    if "</script" in save_text.lower():
        raise SystemExit("存档里含 </script，需要转义")
    # 校验存档可解析且关键字段正确
    import json
    payload = json.loads(save_text)
    assert payload.get("version") == 14, "存档 version 不是 14"
    assert payload.get("zone") == 5 and payload.get("major") == 1, "存档不是 zone5/major1"
    print(f"  [OK] 存档 {len(save_text):,} 字符 / version14 / zone5 / major1")

    seed = SEED_TMPL.replace("__SAVE__", save_text).replace("__SLOT__", SLOT_KEY)
    anchor = '<body>\n<div id="phone"'
    if text.count(anchor) != 1:
        raise SystemExit("注入锚点不唯一")
    text = text.replace(anchor, "<body>\n" + seed + '<div id="phone"', 1)
    print("  [OK] 注入存档播种脚本")

    # 自动进入脚本放在 </body> 前
    if text.count("</body>") != 1:
        raise SystemExit("</body> 不唯一")
    text = text.replace("</body>", AUTO_TMPL + "</body>", 1)
    print("  [OK] 注入自动进入脚本")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    out_bytes = text.replace("\n", "\r\n").encode("utf-8")
    OUT.write_bytes(out_bytes)
    print(f"\n产物：{OUT}")
    print(f"  {len(out_bytes):,} B  SHA256 {hashlib.sha256(out_bytes).hexdigest().upper()}")


if __name__ == "__main__":
    main()
