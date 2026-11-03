#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""V90.81 deterministic build from frozen V90.80 single-file release.
Emits index.html and the identical releases/ artifact.
Source changes are exact-match edits to avoid accidental catch-all replacements.
"""
from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE = RELEASES / "山野修仙记_V90.80_方正纸墨.html"
OUT_NAME = "山野修仙记_V90.81_地图阶级修为修复.html"
BASE_SHA = "3351E8A8509C60A4506BBA1DEC954DAE5C96B2ABCC1B36AD530C33BBEEC057D6"
EDITS = json.loads(r'''[[" xpRatio(kind){const d=D.XP_RATE[kind]||40;return Math.max(1,Math.round(this.realmBaseXp/d));}"," xpRatio(kind){const d=D.XP_RATE[kind]||40;return Math.max(1,Math.round(this.realmBaseXp/d));}\n /* V90.81: map-tier experience. Player realm still controls private cultivation\n    (meditation/pills); exploration, gathering, encounters and quests use zone tier. */\n worldXp(kind,source=null,zone=this.s.zone){\n   const zi=Number.isInteger(zone)?Math.max(0,Math.min(D.ZONES.length-1,zone)):0;\n   const divisor=D.XP_RATE[kind]||40;\n   const base=Math.max(1,Math.round(D.REALM_BASE[zi]/divisor));\n   if(kind==='chore'&&source&&D.RES[source]){\n     const rank=Math.max(1,Math.min(8,Number(D.RES[source].xp)||1));\n     return Math.max(1,Math.round(base*Math.min(1.6,.85+.15*rank)));\n   }\n   if((kind==='mob'||kind==='boss')&&source&&D.ENEMIES[source]){\n     const foeXP=Math.max(1,Number(D.ENEMIES[source].xp)||1);\n     const bossXP=Math.max(1,Number(D.ENEMIES[D.ZONES[zi].boss]?.xp)||foeXP);\n     const anchor=Math.max(1,bossXP/(kind==='boss'?1:4));\n     const factor=Math.max(.65,Math.min(1.4,1+.14*Math.log2(foeXP/anchor)));\n     return Math.max(1,Math.round(base*factor));\n   }\n   return base;\n }\n /* Return credited XP (after birth bonus and rounding), not post-level-up balance. */\n gainWorldXp(kind,source=null,zone=this.s.zone){\n   const reward=this.worldXp(kind,source,zone);\n   const credited=Math.max(0,Math.floor(reward*(1+this.birthEffects.xp/100)+this.s.xpCarry+1e-10));\n   this.xp(reward);\n   return credited;\n }\n",1],["const xpGain=this.xpRatio('chore');this.xp(xpGain);","const xpGain=this.gainWorldXp('chore',k);",1],["if(delta>=3)this.xp(this.xpRatio('chore'));","if(delta>=3)this.gainWorldXp('chore');",1],["this.xp(this.xpRatio('main'));","this.gainWorldXp('main');",8],["const g2=this.xpRatio('main');this.xp(g2);","const g2=this.gainWorldXp('main');",1],["const g8=this.xpRatio('main');this.xp(g8);","const g8=this.gainWorldXp('main');",1],["this.xp(this.xpRatio(String(b.type).startsWith('boss')?'boss':b.training?'chore':'mob'));this.loot(e.loot,'战利品');","const rewardXP=this.gainWorldXp(boss?'boss':'mob',b.type);this.loot(e.loot,'战利品');",1],["this.log('战胜'+e.name+' · 修为+'+e.xp,'good')","this.log('战胜'+e.name+' · 修为+'+rewardXP,'good')",1],["const rewards=['修为 +'+e.xp,","const rewards=['修为 +'+rewardXP,",1],["V90.80","V90.81",6]]''')

def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest().upper()

def main():
    raw = BASE.read_bytes()
    normalized = raw.replace(b"\r\n", b"\n").replace(b"\n", b"\r\n")
    assert sha(normalized) == BASE_SHA, "V90.80 baseline changed; refusing unsafe rebuild"
    line_endings = "\r\n" if b"\r\n" in raw else "\n"
    source = raw.decode("utf-8").replace("\r\n", "\n")
    for old, new, count in EDITS:
        assert source.count(old) == count, f"Patch precondition failed: {old[:72]}"
        source = source.replace(old, new)
    out = source.replace("\n", line_endings).encode("utf-8")
    (RELEASES / OUT_NAME).write_bytes(out)
    (ROOT / "index.html").write_bytes(out)
    print(f"V90.81 build OK: {OUT_NAME} / SHA256 {sha(out)}")

if __name__ == "__main__":
    main()
