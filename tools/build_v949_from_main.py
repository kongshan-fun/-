#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
V90.48 -> V90.49：后七境怪物属性对齐十二境表

映射：zone z（5..11）→ 破境后 major=z-3 → 境序 = major+5 = z+2（夹紧 12）
      即 zone5(丹霞)→元婴、zone6→化神 … zone11(渡劫天门)→渡劫
每一境的野怪/首领按 docs/境界与修为阶定义.md §六 的数值覆盖。
"""
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE = RELEASES / "山野修仙记_V90.48_高境属性.html"
OUT_NAME = "山野修仙记_V90.49_怪物对齐.html"
BASE_SHA = "8D63F15491CFC2A0275B15D4EDC98C30D516EA1C578C88741EC0664D7FAEA6A6"

BLOCK = '''/* V90.49 后七境怪物数值（对齐十二境表：野怪 hp/atk/armor，首领 hp/atk/armor） */
(function(){
 const M=[
  /* 境7 元婴  */ {w:[792,180,36],  b:[2904,270,36]},
  /* 境8 化神  */ {w:[1162,282,53], b:[4259,423,53]},
  /* 境9 炼虚  */ {w:[1716,444,78], b:[6292,666,78]},
  /* 境10 合体 */ {w:[2508,696,114],b:[9196,1044,114]},
  /* 境11 大乘 */ {w:[3696,1092,168],b:[13552,1638,168]},
  /* 境12 渡劫 */ {w:[5412,1710,246],b:[19844,2565,246]}
 ];
 for(let z=5;z<=11;z++){
  const idx=Math.min(12,z+2);
  const row=M[Math.min(5,idx-7)];
  const boss=ENEMIES['boss'+z], wild=ENEMIES['realm'+z];
  if(boss){boss.hp=row.b[0];boss.atk=row.b[1];boss.armor=row.b[2];}
  if(wild){wild.hp=row.w[0];wild.atk=row.w[1];wild.armor=row.w[2];}
 }
})();
'''


def sha(b):
    return hashlib.sha256(b).hexdigest().upper()


def ok(l, d=""):
    print(f"  [OK] {l}" + (f"  {d}" if d else ""))


def rep(t, old, new, label):
    n = t.count(old)
    if n != 1:
        raise SystemExit(f"[ABORT] {label}: 命中 {n} 次")
    ok(label)
    return t.replace(old, new, 1)


def main():
    raw = BASE.read_bytes()
    norm = raw.replace(b"\r\n", b"\n").replace(b"\n", b"\r\n")
    if sha(norm) != BASE_SHA:
        raise SystemExit(f"[ABORT] 基线哈希不符：{sha(norm)}")
    ok("基线校验", f"{len(raw):,} B")
    text = raw.decode("utf-8").replace("\r\n", "\n")

    text = rep(text, "<title>山野修仙记 V90.48 · 高境属性</title>",
               "<title>山野修仙记 V90.49 · 怪物对齐</title>", "标题版本号")
    text = rep(text, "subtitle='人妖异途 · V90.48'", "subtitle='人妖异途 · V90.49'", "副标题版本号")
    text = rep(text, "V90.48 · ${game.character.name}", "V90.49 · ${game.character.name}", "设置页版本号")
    text = rep(text, "山野修仙记_V90.48_本机飞升资质榜.json", "山野修仙记_V90.49_本机飞升资质榜.json",
               "导出文件名")

    text = rep(text, "if(typeof module!=='undefined'&&module.exports)module.exports=D;",
               BLOCK + "if(typeof module!=='undefined'&&module.exports)module.exports=D;",
               "插入怪物数值覆盖")

    for needle in ("V90.49 后七境怪物数值", "boss.hp=row.b[0]"):
        if needle not in text:
            raise SystemExit(f"[ABORT] 产物缺少 {needle}")
    ok("产物标记", "覆盖块已插入")

    out = text.replace("\n", "\r\n").encode("utf-8")
    (RELEASES / OUT_NAME).write_bytes(out)
    (ROOT / "index.html").write_bytes(out)
    ok("产物一致性", "index.html == release")
    print(f"\n  releases/{OUT_NAME}\n  字节数 : {len(out):,}\n  SHA256 : {sha(out)}")


if __name__ == "__main__":
    main()
