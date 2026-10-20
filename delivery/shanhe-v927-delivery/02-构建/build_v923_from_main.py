#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
山野修仙记 V90.22 -> V90.23 构建器（A 方案：战斗不再掉成品装备）

基线：V90.22（字节哈希校验）

问题（实测）：炼制与打怪**共用同一个 rollQuality(zone)**，品质分布完全一样；
打怪还多一层 min=1 保底（首领/秘境），且零材料成本、acceptGear 自动换装 →
采集—炼制循环被旁路。

改动（A 方案）：
  1. 普通怪：删掉 22% 的额外 dropGear（怪物原有的 e.loot 材料照旧）
  2. 首领：改为 dropLoot()，给本境主材 ×2 + 副材 ×1 + 灵尘
  3. 秘境封藏：32% 的成品 createGear → 改为专属灵材 ×1
  4. 保留：一次性奇遇「遗迹寻宝」仍可能给成品（dropGear 只服务这一处）
  5. 同步文案：帮助·炼器章、图鉴装备来源

三条硬断言：基线哈希 / 每处替换次数 / data-a 集合不变（154）。
"""
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE = RELEASES / "山野修仙记_V90.22_评价触发时机版.html"
OUT_NAME = "山野修仙记_V90.23_战斗不再掉成品版.html"
BASE_SHA = "274117D8242E96ED5500D10B941FE2FE6576E8DA1628655D840972F58EB8CB78"

DROPLOOT_JS = """/* 战斗器材掉落：不再产出成品装备，只给本境炼器所需的灵材与灵尘 */
 dropLoot(){
  const z=this.s.zone,st=z>=5?D.ASCENSION_STAGES[z-5]:null;
  const data=st?{[st.primary]:2,[st.secondary]:1}:{ore:2,fiber:1,wood:1};
  data.dust=2+Math.max(0,z-5);
  return this.loot(data,'首领遗材');
 }
"""

OLD_BATTLE = "if(boss||this.random()<.22)this.dropGear(boss?1:0,'击败'+e.name);"
NEW_BATTLE = "if(boss)this.dropLoot();"

OLD_SECRET = ("if(this.random()<.32){const g=this.createGear(cfg.gear,1,'秘境封藏');"
              "const equipped=this.acceptGear(g);"
              "this.log('秘藏：'+D.QUALITIES[g.quality].name+'·'+D.RECIPES.find(q=>q.id===cfg.gear).name"
              "+(equipped?'':'（待领取）'),'good');message+=' · 发现独门遗器';}")
NEW_SECRET = ("if(this.random()<.32){this.loot({[cfg.item]:1},'秘境遗材');message+=' · 发现独门遗材';}")

OLD_HELP = ("\"合适设施只约束生产和精炼；在野外拾到的高级法器可以直接穿戴，不要求先建同阶房间。"
            "装备不是消耗一次的配方标记，每次炼器会生成独立实例，可比较、穿戴与分解。\"")
NEW_HELP = ("\"合适设施只约束生产和精炼；装备成品只能在对应的炼器室炼出——战斗与秘境不再直接掉落成品，"
            "只给灵材、兽皮与灵尘，想要更强的装备就回府炼、回炉精炼。"
            "装备不是消耗一次的配方标记，每次炼器会生成独立实例，可比较、穿戴与分解。\"")

OLD_CODEX = ("${r.secret?D.SECRETS[r.zone].name+'专属灵材，在洞府炼制或秘藏掉落':"
             "D.ZONES[r.zone||0].name+'解锁后在对应阶炼器室炼制或区域掉落'}")
NEW_CODEX = ("${r.secret?D.SECRETS[r.zone].name+'专属灵材，只能在对应阶炼器室炼制':"
             "D.ZONES[r.zone||0].name+'解锁后在对应阶炼器室炼制'}")


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
    if sha(raw) != BASE_SHA:
        raise SystemExit(f"[ABORT] 基线哈希不符：{sha(raw)}")
    text = raw.decode("utf-8").replace("\r\n", "\n")
    ok("基线校验", f"{len(raw):,} B")

    before_actions = actions(text)
    ok("基线动作集合", f"{len(before_actions)} 个 data-a")

    # ---- 版本号 ----
    text = rep(text, "<title>山野修仙记 V90.22 · 评价触发时机</title>",
               "<title>山野修仙记 V90.23 · 战斗不再掉成品</title>", "标题版本号")
    text = rep(text, "subtitle='人妖异途 · V90.22'", "subtitle='人妖异途 · V90.23'", "副标题版本号")
    text = rep(text, 'V90.22 · ${game.character.name}', 'V90.23 · ${game.character.name}', "设置页版本号")
    text = rep(text, "山野修仙记_V90.22_本机飞升资质榜.json", "山野修仙记_V90.23_本机飞升资质榜.json",
               "资质榜导出文件名")
    text = rep(text, "当前版本 V90.22：", "当前版本 V90.23：", "帮助页版本说明")

    # ---- 1. 新增 dropLoot，并把 dropGear 标注为"仅奇遇使用" ----
    text = rep(text, " dropGear(min=0,source='战利品'){",
               DROPLOOT_JS + " /* 成品装备只允许一次性奇遇（遗迹寻宝）调用 */\n dropGear(min=0,source='战利品'){",
               "注入 dropLoot / 标注 dropGear")

    # ---- 2. 战斗不再掉成品 ----
    text = rep(text, OLD_BATTLE, NEW_BATTLE, "战斗掉落改器材")

    # ---- 3. 秘境封藏不给成品 ----
    text = rep(text, OLD_SECRET, NEW_SECRET, "秘境封藏改灵材")

    # ---- 4. 文案同步 ----
    text = rep(text, OLD_HELP, NEW_HELP, "帮助·炼器章")
    text = rep(text, OLD_CODEX, NEW_CODEX, "图鉴·装备来源")

    # ---- 断言 ----
    if "this.random()<.22)this.dropGear" in text:
        raise SystemExit("[ABORT] 战斗仍会 dropGear")
    if "createGear(cfg.gear" in text:
        raise SystemExit("[ABORT] 秘境仍会给成品")
    # dropGear 只应剩：定义 1 次 + 奇遇调用 1 次
    if text.count("dropGear(") != 2:
        raise SystemExit(f"[ABORT] dropGear 调用点异常：{text.count('dropGear(')}")
    if text.count("this.dropLoot()") != 1 or text.count(" dropLoot(){") != 1:
        raise SystemExit("[ABORT] dropLoot 注入异常")
    ok("掉落断言", "战斗/秘境均不产出成品；dropGear 只剩奇遇一处")

    after_actions = actions(text)
    if after_actions != before_actions:
        raise SystemExit(f"[ABORT] 动作集合被改动：{sorted(after_actions ^ before_actions)}")
    ok("动作集合不变", f"{len(after_actions)} 个")

    out = text.replace("\n", "\r\n").encode("utf-8")
    (RELEASES / OUT_NAME).write_bytes(out)
    (ROOT / "index.html").write_bytes(out)
    ok("产物一致性", "index.html == release")

    print(f"\n  releases/{OUT_NAME}")
    print(f"  字节数 : {len(out):,}")
    print(f"  SHA256 : {sha(out)}")


if __name__ == "__main__":
    main()
