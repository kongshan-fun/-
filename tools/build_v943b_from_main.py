#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
V90.43b：12 境 × 36 段 的**数据层与映射函数**（不改任何现有行为）

只加两样东西：
  1. D.REALM12 —— 人族/妖族各 12 个境界名
  2. D.realmOfLevel(level, character) —— 36 级 → {index, stage, name, base}
     境 = ceil(level/3)，阶 = (level-1)%3 + 1（初期/中期/后期）
这是后续 1c（把 level 扩到 36、界面切换到新名）的地基；本步不接线，
所以对现有玩法零影响，可独立验收。
"""
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE = RELEASES / "山野修仙记_V90.43_旧档重置.html"
OUT_NAME = "山野修仙记_V90.43b_十二境表.html"
BASE_SHA = "E57D9FAEC5AEEC0B9B475DD296889EEE4F0D889BADEEC65BCE59998A3F0D3D1A"

BLOCK = '''
/* ===== V90.43 十二境 × 三十六段（数据层，未接线） ===== */
D.REALM12={
 human:['凡人','感气','引气','炼气','筑基','金丹','元婴','化神','炼虚','合体','大乘','渡劫'],
 demon:['凡妖','开识','启灵','通脉','妖丹','化形','妖王','妖皇','妖尊','妖圣','妖帝','渡劫']
};
D.STAGE3=['初期','中期','后期'];
/* level 1..36 → 境序(1..12) / 阶序(1..3) / 显示名 */
D.realmOfLevel=function(level,character){
 const lv=Math.max(1,Math.min(36,Math.round(Number(level)||1)));
 const table=D.REALM12[character]||D.REALM12.human;
 const idx=Math.ceil(lv/3), st=(lv-1)%3;
 return {index:idx,stage:st+1,base:table[idx-1],name:table[idx-1]+D.STAGE3[st]};
};
'''


def sha(b):
    return hashlib.sha256(b).hexdigest().upper()


def ok(l, d=""):
    print(f"  [OK] {l}" + (f"  {d}" if d else ""))


def main():
    raw = BASE.read_bytes()
    norm = raw.replace(b"\r\n", b"\n").replace(b"\n", b"\r\n")
    if sha(norm) != BASE_SHA:
        raise SystemExit(f"[ABORT] 基线哈希不符：{sha(norm)}")
    ok("基线校验", f"{len(raw):,} B")
    text = raw.decode("utf-8").replace("\r\n", "\n")

    # 挂到 D 对象初始化之后（找到 REALMS 定义，紧跟其后插入）
    anchor = "if(typeof module!=='undefined'&&module.exports)module.exports=D;"
    if text.count(anchor) != 1:
        raise SystemExit(f"[ABORT] 锚点命中 {text.count(anchor)} 次")
    text = text.replace(anchor, BLOCK.strip() + "\n" + anchor)
    ok("插入 REALM12 + realmOfLevel")

    # 版本号
    text = text.replace("<title>山野修仙记 V90.43 · 旧档重置</title>",
                        "<title>山野修仙记 V90.43b · 十二境表</title>", 1)
    text = text.replace("subtitle='人妖异途 · V90.43'", "subtitle='人妖异途 · V90.43b'", 1)
    text = text.replace("V90.43 · ${game.character.name}", "V90.43b · ${game.character.name}", 1)
    text = text.replace("山野修仙记_V90.43_本机飞升资质榜.json", "山野修仙记_V90.43b_本机飞升资质榜.json", 1)
    ok("版本号 V90.43b")

    for needle in ("D.REALM12=", "D.realmOfLevel=function", "十二境"):
        if needle not in text:
            raise SystemExit(f"[ABORT] 产物缺少 {needle}")
    ok("产物标记", "表/函数/版本 齐全")

    out = text.replace("\n", "\r\n").encode("utf-8")
    (RELEASES / OUT_NAME).write_bytes(out)
    (ROOT / "index.html").write_bytes(out)
    ok("产物一致性", "index.html == release")
    print(f"\n  releases/{OUT_NAME}")
    print(f"  字节数 : {len(out):,}")
    print(f"  SHA256 : {sha(out)}")


if __name__ == "__main__":
    main()
