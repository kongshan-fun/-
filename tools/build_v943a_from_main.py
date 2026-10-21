#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
V90.43 第 1a 步（可独立验收）：旧档识别 + 重构提示 + 阶梯补轮回玉 + 从零开始

**不动 VERSION**。用存档里的 `rebuilt:1` 标记区分新旧：
  · 新档由 fresh()/normalize() 自动写入 rebuilt:1
  · 旧档没有 rebuilt → slots.read 返回 {reset:{tier}}，不加载也不删除
下一步（12 境骨架）再把 VERSION 升到 15。

基线：V90.42 发布文件（哈希校验）
"""
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE = RELEASES / "山野修仙记_V90.42_境界分段版.html"
OUT_NAME = "山野修仙记_V90.43a_旧档重置.html"
BASE_SHA = "22C30063DB30DBED044E99F49FE1987BAF488F973A46FF2DBA060ACD776759FC"


def sha(b):
    return hashlib.sha256(b).hexdigest().upper()


def ok(l, d=""):
    print(f"  [OK] {l}" + (f"  {d}" if d else ""))


def rep(t, old, new, label, expect=1):
    n = t.count(old)
    if n != expect:
        raise SystemExit(f"[ABORT] {label}: 期望 {expect} 次，实际 {n}")
    ok(label, f"{n} 处")
    return t.replace(old, new, expect)


# 1) 新档打上 rebuilt 标记
OLD_FRESH = "major:0,daoXp:0,ascended:false,"
NEW_FRESH = "major:0,daoXp:0,ascended:false,rebuilt:1,"

# normalize 产出的档也要带标记（放在 n.level 赋值附近，保证一定执行）
OLD_NORM_TAG = "n.level=integer(o.level,1,18);"
NEW_NORM_TAG = "n.level=integer(o.level,1,18);n.rebuilt=1;"

# 2) slots.read 识别旧档
OLD_READ = ("   try{const obj=JSON.parse(raw);if(obj.version!==14||obj.race!==id||obj.character!==id)"
            "throw Error('种族身份不符');return {game:new Game(obj,261014,id),source};}catch{}")
NEW_READ = ("   try{const obj=JSON.parse(raw);\n"
            "    /* V90.43：重构前的档没有 rebuilt 标记 —— 不加载、不删除，交给重置流程 */\n"
            "    if(obj.version===14&&!obj.rebuilt)return {reset:{tier:this.tierOf(obj),source,race:id,slot:n}};\n"
            "    if(obj.version!==14||obj.race!==id||obj.character!==id)throw Error('种族身份不符');\n"
            "    return {game:new Game(obj,261014,id),source};}catch{}")

# 3) 补偿阶梯
OLD_DEAD = " dead(id,n=1){return !!this.readKey(this.deathKey(id,n));}"
NEW_DEAD = (" dead(id,n=1){return !!this.readKey(this.deathKey(id,n));}\n"
            " /* V90.43 旧档补偿阶梯：飞升 1000 / 大境界≥6 或首领≥8 → 600 / 其余 300 */\n"
            " tierOf(raw){try{if(raw&&raw.ascended)return 1000;"
            "const bosses=(raw&&Array.isArray(raw.cleared))?raw.cleared.filter(Boolean).length:0;"
            "if(Number((raw&&raw.major)||0)>=6||bosses>=8)return 600;}catch{}\n  return 300;}")

# 4) 弹窗
OLD_HOOK = "else if(modal.kind==='permadeath')body="
NEW_MODAL = ("else if(modal.kind==='rebuild-reset')body=`<div class=\"kicker\">境界与修为体系重构</div>"
             "<h2>旧存档无法沿用</h2>"
             "<p>本次重构改动了境界、修为与渡劫的整套结构，旧存档的进度无法直接换算。"
             "涉及档位：${modal.race==='human'?'人族':'妖族'}第 ${String(modal.slot).padStart(3,'0')} 档。</p>"
             "<p>为补偿这段进度，将发放 <strong>${modal.tier} 轮回玉</strong>，直接进入本档账本，本世即可用于开局加点。</p>"
             "<p class=\"micro\">点「从零开始」才会清除这一档的主存档与自动备份；其他档位与另一种族不受影响；本机飞升资质榜成绩保留。</p>"
             "<div class=\"inline-buttons\"><button class=\"btn primary\" data-a=\"reset-confirm\">从零开始 · 领 ${modal.tier} 轮回玉</button>"
             "<button class=\"btn\" data-a=\"modal-close\">暂时不玩</button></div>`; "
             "else if(modal.kind==='permadeath')body=")

# 5) 按钮处理
OLD_GUARD = " if(a==='ad-life-rescue'&&modal?.kind==='life-rescue'){simulatedLifeRescue();return;}"
NEW_GUARD = (" if(a==='reset-confirm'&&modal?.kind==='rebuild-reset'){resetOldSlot();return;}\n"
             " if(a==='ad-life-rescue'&&modal?.kind==='life-rescue'){simulatedLifeRescue();return;}")

# 6) 重置实现
OLD_LOAD = "function load(){game=new QGame();"
NEW_LOAD = ("/* V90.43 旧档重置：删档 → 补轮回玉 → 开新档 */\n"
            "function resetOldSlot(){const m=modal;if(!m||m.kind!=='rebuild-reset')return;\n"
            " try{\n"
            "  const id=m.race,n=m.slot;\n"
            "  localStorage.removeItem(slots.key(id,n));localStorage.removeItem(slots.backupKey(id,n));\n"
            "  const ledger=slots.legacy(id,n);ledger.balance=(ledger.balance||0)+m.tier;slots.putLegacy(id,n,ledger);\n"
            "  const next=slots.newGame(id,261014,n,null);\n"
            "  game=next;activeRole=id;activeSlot=n;saveAvailable=true;\n"
            "  saveStatus='旧档已重置 · 补偿 '+m.tier+' 轮回玉';deathBoot=false;panel=null;modal=null;frontPage=null;\n"
            "  render();notify('旧档已重置，轮回玉 +'+m.tier,'ok');\n"
            " }catch(e){modal=null;renderModal();notify('重置失败：'+e.message,'warn');}\n"
            "}\n"
            "function load(){game=new QGame();")

# 7) 入口弹窗
OLD_ENTRY = "if(!found){beginBirth(id,n);return;}next=found.game;"
NEW_ENTRY = ("if(!found){beginBirth(id,n);return;}\n"
             "   if(found.reset){showModal({kind:'rebuild-reset',race:id,slot:n,tier:found.reset.tier});render();return;}\n"
             "   next=found.game;")


def main():
    raw = BASE.read_bytes()
    norm = raw.replace(b"\r\n", b"\n").replace(b"\n", b"\r\n")
    if sha(norm) != BASE_SHA:
        raise SystemExit(f"[ABORT] 基线哈希不符：{sha(norm)}")
    ok("基线校验", f"{len(raw):,} B")
    text = raw.decode("utf-8").replace("\r\n", "\n")

    text = rep(text, OLD_FRESH, NEW_FRESH, "新档标记 rebuilt:1")
    text = rep(text, OLD_NORM_TAG, NEW_NORM_TAG, "normalize 产出 rebuilt:1")
    text = rep(text, OLD_DEAD, NEW_DEAD, "tierOf() 阶梯补偿")
    text = rep(text, OLD_READ, NEW_READ, "slots.read 识别旧档")
    text = rep(text, OLD_HOOK, NEW_MODAL, "重构提示弹窗")
    text = rep(text, OLD_GUARD, NEW_GUARD, "reset-confirm 处理")
    text = rep(text, OLD_LOAD, NEW_LOAD, "resetOldSlot()")
    text = rep(text, OLD_ENTRY, NEW_ENTRY, "入口识别 reset")

    for needle, what in (("rebuilt:1", "新档标记"), ("tierOf(raw)", "阶梯"),
                         ("kind:'rebuild-reset'", "弹窗"), ("resetOldSlot()", "实现"),
                         ("found.reset", "入口")):
        if needle not in text:
            raise SystemExit(f"[ABORT] 产物缺少：{what}")
    ok("产物标记", "标记/阶梯/弹窗/实现/入口 齐全")
    if "VERSION:15" in text:
        raise SystemExit("[ABORT] 本步不应改 VERSION")

    out = text.replace("\n", "\r\n").encode("utf-8")
    (RELEASES / OUT_NAME).write_bytes(out)
    (ROOT / "index.html").write_bytes(out)
    ok("产物一致性", "index.html == release")
    print(f"\n  releases/{OUT_NAME}")
    print(f"  字节数 : {len(out):,}")
    print(f"  SHA256 : {sha(out)}")


if __name__ == "__main__":
    main()
