#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
山野修仙记 V90.37 -> V90.38 构建器（寿元续命放开限制 + 寿尽时可看广告 +15 年）

基线：V90.37（字节哈希，按 CRLF 归一）

用户需求（2026-10-21）：
  1. 增加寿元，不再限制「最后 15 年」
     → `simulatedLifeAdReady()` 里 `game.lifeYears<=15` 这道门槛去掉；
       顶部「续命+10」按钮改成随时可用（仍要求：活着、不在斗法中、非死亡引导）。
  2. 战斗失败/寿命终结时不要直接清档，同样给一次看广告 +15 年寿元的机会
     → `flush()` 遇到 `s.ended` 时先判 `lifeRescueReady()`：
        有资格 → 弹 `life-rescue` 弹窗（不清档、不 settle）；
        没资格 → 原流程（persist → 清档 settle → permadeath 弹窗）。
       救援按钮 `ad-life-rescue`（TapTap 包会真播广告，浏览器直接发放），
       给满 15 年寿元、气血回到 35%、`life.rescued=true`（每世一次）。
       另一个按钮 `life-giveup` 才是「接受轮回」，走原结算拿轮回玉。

设计取舍：救援**每世一次**，避免无限广告把轮回/轮回玉体系架空；
随时续命（+10 年、不限次数）仍然保留，那是另一条线。

三条硬断言：基线哈希 / 替换次数 / data-a 集合只增不减。
"""
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE = RELEASES / "山野修仙记_V90.37_战斗日志分段版.html"
OUT_NAME = "山野修仙记_V90.38_续命放开版.html"
BASE_SHA = "919D4CB26C9842CD5A8F47915A812862EDA62B2ED095DCAD17EAE70A492FE0A8"

# A. 续命门槛
OLD_READY = ("function simulatedLifeAdReady(){return !!(game&&!game.s.ended&&!deathBoot&&game.s.life&&"
             "game.lifeYears>0&&game.lifeYears<=15&&!game.s.combat);}")
NEW_READY = ("function simulatedLifeAdReady(){return !!(game&&!game.s.ended&&!deathBoot&&game.s.life&&"
             "game.lifeYears>0&&!game.s.combat);}")

# B. 死亡救援
OLD_FLUSH = (" if(game.s.ended){stop();panel=null;travelOpen=false;mapOpen=false;persist();render();"
             "showModal({kind:'permadeath'});return result;}")
NEW_FLUSH = (" if(game.s.ended){stop();panel=null;travelOpen=false;mapOpen=false;"
             "if(lifeRescueReady()){showModal({kind:'life-rescue'});render();return result;}"
             "persist();render();showModal({kind:'permadeath'});return result;}")

OLD_REWARD_TAIL = "modal=null;renderModal();render();notify('本世寿元+10年','ok');\n}"
NEW_REWARD_TAIL = ("modal=null;renderModal();render();notify('本世寿元+10年','ok');\n}\n"
                   "/* V90.38 寿尽救援：本世终结时给一次 +15 年的机会（每世一次） */\n"
                   "function lifeRescueReady(){return !!(game&&game.s.ended&&game.s.life&&!game.s.life.rescued);}\n"
                   "function simulatedLifeRescue(){\n"
                   " if(!lifeRescueReady()){notify('当前没有可续命的结算','warn');return false;}\n"
                   " const ended=game.s.ended,hp=game.s.hp,left=game.s.life.left,used=game.s.life.rescued;\n"
                   " game.s.ended=false;game.s.hp=Math.max(1,Math.round(game.s.maxHp*0.35));\n"
                   " game.s.life.left=15*D.LIFE.yearMinutes;game.s.life.rescued=true;game.s.combat=null;\n"
                   " if(!persist()){game.s.ended=ended;game.s.hp=hp;game.s.life.left=left;game.s.life.rescued=used;"
                   "notify('保存未成功，未发放续命寿元','warn');return false;}\n"
                   " modal=null;renderModal();render();notify('逆命续年 · 本世寿元+15年','ok');return true; }")

# C. 弹窗
OLD_MODAL_HOOK = "else if(modal.kind==='permadeath')body="
NEW_MODAL_HOOK = ("else if(modal.kind==='life-rescue')body=`<div class=\"kicker\">${game.character.name} · 寿元耗尽</div>"
                  "<h2>还有一线生机</h2><p>本世已到尽头（第 ${game.day} 日 · ${esc(game.realm)}）。"
                  "完整看完激励视频可逆命续年：寿元 +15 年，本世进度全部保留，每世只有一次这样的机会。</p>"
                  "<p class=\"micro\">选择「接受轮回」才会结算本世并领取轮回玉；结算后本档主存档与自动备份会被清除。</p>"
                  "<div class=\"inline-buttons\"><button class=\"btn primary\" data-a=\"ad-life-rescue\">看广告续命 · 寿元+15年</button>"
                  "<button class=\"btn\" data-a=\"life-giveup\">接受轮回</button></div>`; "
                  "else if(modal.kind==='permadeath')body=")

# D. 事件处理（放在 ended 守卫之前）
OLD_GUARD = (" if(frontPage||!activeRole)return;\n if(game.s.ended||deathBoot)return;\n")
NEW_GUARD = (" if(a==='ad-life-rescue'&&modal?.kind==='life-rescue'){simulatedLifeRescue();return;}\n"
             " if(a==='life-giveup'&&modal?.kind==='life-rescue'){modal=null;renderModal();persist();render();"
             "showModal({kind:'permadeath'});return;}\n"
             " if(frontPage||!activeRole)return;\n if(game.s.ended||deathBoot)return;\n")

# E. 存档字段
OLD_FRESH = "life:{left:c.years*D.LIFE.yearMinutes,losses:0,elixirs:0,adYearsClaimed:false}"
NEW_FRESH = "life:{left:c.years*D.LIFE.yearMinutes,losses:0,elixirs:0,adYearsClaimed:false,rescued:false}"
OLD_NORM = "n.life={left:o.life.left,losses:integer(o.life.losses,0,999),elixirs:integer(o.life.elixirs,0,D.LIFE.elixirLimit),adYearsClaimed:o.life.adYearsClaimed===true};"
NEW_NORM = ("n.life={left:o.life.left,losses:integer(o.life.losses,0,999),elixirs:integer(o.life.elixirs,0,D.LIFE.elixirLimit),"
            "adYearsClaimed:o.life.adYearsClaimed===true,rescued:o.life.rescued===true};")
OLD_NORM_OLD = "n.life={left:Math.max(8,D.LIFE.initialYears+boosts-penalties)*D.LIFE.yearMinutes,losses:Math.min(2,integer(o.stats?.defeats,0,10000)),elixirs:0};"
NEW_NORM_OLD = ("n.life={left:Math.max(8,D.LIFE.initialYears+boosts-penalties)*D.LIFE.yearMinutes,"
                "losses:Math.min(2,integer(o.stats?.defeats,0,10000)),elixirs:0,rescued:false};")

# F. 文案
OLD_TIP = 'title="寿元不足时可续寿10年"'
NEW_TIP = 'title="随时可续寿10年（本世不限次数）"'
OLD_TEXT = "当前寿元 ${game.lifeYears.toFixed(1)} 年。可通过模拟激励获得10年寿元，本世不限次数；领取后需再次降到15年以内才能继续领取。"
NEW_TEXT = "当前寿元 ${game.lifeYears.toFixed(1)} 年。可通过模拟激励获得10年寿元，本世不限次数，任何寿元状态都可以领取。"


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


def actions(t):
    return set(re.findall(r'data-a="([a-z0-9-]+)"', t))


def main():
    raw = BASE.read_bytes()
    norm = raw.replace(b"\r\n", b"\n").replace(b"\n", b"\r\n")
    if sha(norm) != BASE_SHA:
        raise SystemExit(f"[ABORT] 基线哈希不符：{sha(norm)}")
    text = raw.decode("utf-8").replace("\r\n", "\n")
    ok("基线校验", f"{len(raw):,} B")
    before = actions(text)
    ok("基线动作集合", f"{len(before)} 个 data-a")

    text = rep(text, "<title>山野修仙记 V90.37 · 战斗日志分段</title>",
               "<title>山野修仙记 V90.38 · 续命放开</title>", "标题版本号")
    text = rep(text, "subtitle='人妖异途 · V90.37'", "subtitle='人妖异途 · V90.38'", "副标题版本号")
    text = rep(text, "V90.37 · ${game.character.name}", "V90.38 · ${game.character.name}", "设置页版本号")
    text = rep(text, "山野修仙记_V90.37_本机飞升资质榜.json", "山野修仙记_V90.38_本机飞升资质榜.json",
               "资质榜导出文件名")
    text = rep(text, "当前版本 V90.37：", "当前版本 V90.38：", "帮助页版本说明")

    text = rep(text, OLD_READY, NEW_READY, "续命去掉 15 年门槛")
    text = rep(text, OLD_FLUSH, NEW_FLUSH, "寿尽先给救援机会")
    text = rep(text, OLD_REWARD_TAIL, NEW_REWARD_TAIL, "新增模拟救援实现")
    text = rep(text, OLD_MODAL_HOOK, NEW_MODAL_HOOK, "新增救援弹窗")
    text = rep(text, OLD_GUARD, NEW_GUARD, "新增救援按钮处理")
    text = rep(text, OLD_FRESH, NEW_FRESH, "fresh 增加 rescued")
    text = rep(text, OLD_NORM, NEW_NORM, "normalize 保留 rescued")
    text = rep(text, OLD_NORM_OLD, NEW_NORM_OLD, "旧版迁移分支补 rescued")
    text = rep(text, OLD_TIP, NEW_TIP, "顶部按钮提示语")
    text = rep(text, OLD_TEXT, NEW_TEXT, "模拟激励弹窗文案")

    for needle, what in (("game.lifeYears>0&&!game.s.combat);}", "续命条件"),
                         ("if(lifeRescueReady()){showModal({kind:'life-rescue'})", "寿尽救援分支"),
                         ("function simulatedLifeRescue()", "救援实现"),
                         ("modal.kind==='life-rescue'", "救援弹窗"),
                         ("data-a=\"ad-life-rescue\"", "救援按钮"),
                         ("rescued:false", "存档字段")):
        if needle not in text:
            raise SystemExit(f"[ABORT] 产物缺少：{what}")
    ok("产物标记", "条件/分支/实现/弹窗/按钮/字段 齐全")

    after = actions(text)
    added = after - before
    removed = before - after
    if removed:
        raise SystemExit(f"[ABORT] 动作被删除：{sorted(removed)}")
    ok("动作集合只增不减", f"+{sorted(added) if added else '无'}")

    eol = "\r\n" if b"\r\n" in raw[:4000] else "\n"
    out = text.replace("\n", eol).encode("utf-8")
    (RELEASES / OUT_NAME).write_bytes(out)
    (ROOT / "index.html").write_bytes(out)
    ok("产物一致性", "index.html == release")

    print(f"\n  releases/{OUT_NAME}")
    print(f"  字节数 : {len(out):,}")
    print(f"  SHA256 : {sha(out)}")


if __name__ == "__main__":
    main()
