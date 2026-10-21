#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
V90.44 -> V90.45：境界显示切到「十二境 × 三阶」
基线：releases/山野修仙记_V90.44_十二境表.html（哈希校验）
"""
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE = RELEASES / "山野修仙记_V90.44_十二境表.html"
OUT_NAME = "山野修仙记_V90.45_十二境显示.html"
BASE_SHA = "2BD6FF1F57EB2659CAB8E2E03B374FF0B16EC7BE2A7399687573058B27708883"

DISPLAY = '''/* V90.45 统一取名：level/major/daoXp → 「十二境 × 三阶」 */
D.realmDisplay=function(state){
 const ch=(state&&state.character)||"human";
 const table=D.REALM12[ch]||D.REALM12.human, s3=D.STAGE3;
 const major=Math.max(0,Math.round(Number(state&&state.major)||0));
 if(major<=1){return D.realmOfLevel(state&&state.level,ch).name;}
 const idx=Math.min(12,major+5), base=table[idx-1];
 const stg=D.ASCENSION_STAGES&&D.ASCENSION_STAGES[major-1];
 const need=stg?stg.needDao:(major>=8?(D.ASCENSION_RULE&&D.ASCENSION_RULE.dao)||0:0);
 const done=need?Math.max(0,(Number(state&&state.daoXp)||0)/need):0;
 const st=done>=1?"圆满":done>=2/3?s3[2]:done>=1/3?s3[1]:s3[0];
 return base+st;
};
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

    text = rep(text, "<title>山野修仙记 V90.44 · 十二境表</title>",
               "<title>山野修仙记 V90.45 · 十二境显示</title>", "标题版本号")
    text = rep(text, "subtitle='人妖异途 · V90.44'", "subtitle='人妖异途 · V90.45'", "副标题版本号")
    text = rep(text, "V90.44 · ${game.character.name}", "V90.45 · ${game.character.name}", "设置页版本号")
    text = rep(text, "山野修仙记_V90.44_本机飞升资质榜.json", "山野修仙记_V90.45_本机飞升资质榜.json",
               "导出文件名")

    text = rep(text, "D.realmOfLevel=function(level,character){", DISPLAY + "D.realmOfLevel=function(level,character){",
               "插入 D.realmDisplay")
    text = rep(text, "get realm(){const base=B.realm(this.s);if(this.s.major<2)return base;",
               "get realm(){if(D.realmDisplay)return D.realmDisplay(this.s);const base=B.realm(this.s);if(this.s.major<2)return base;",
               "realm getter 走 realmDisplay")

    if "D.realmDisplay=function" not in text:
        raise SystemExit("[ABORT] 缺少 realmDisplay")
    ok("产物标记", "realmDisplay + getter 已接")

    out = text.replace("\n", "\r\n").encode("utf-8")
    (RELEASES / OUT_NAME).write_bytes(out)
    (ROOT / "index.html").write_bytes(out)
    ok("产物一致性", "index.html == release")
    print(f"\n  releases/{OUT_NAME}\n  字节数 : {len(out):,}\n  SHA256 : {sha(out)}")


if __name__ == "__main__":
    main()
