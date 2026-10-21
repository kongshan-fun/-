#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
山野修仙记 V90.35 -> V90.36 构建器（修复：突破指引/试炼页里的按钮点了报「无效操作」）

基线：V90.35（字节哈希，按 CRLF 归一）

玩家反馈：金丹渡劫「无法点击」，界面上条件都显示完成，点了却提示「无效操作」。

定位（真实代码路径）：
  `handle(a,b)` 末尾的兜底是 `run(a,{...})`；`game.act()` 的 switch 里没有对应 case
  就会 `fail('无效操作')`。而下面这些按钮的 UI 分支都带了 panel 守卫：

     if(a==='tribulation-open'&&panel==='cultivate'){...}   // 只在修炼页有效
     if(a==='tribulation-start'&&panel==='tribulation'){...}
     if(a==='tribulation-act'&&panel==='tribulation'){...}
     if(a==='heart-open'&&panel==='cultivate'){...}
     if(a==='heart-start'&&panel==='hearttrial'){...}
     if(a==='heart-act'&&panel==='hearttrial'){...}

  而 `progGuide('core')` 这张「阶段成长指引」卡在**凝丹雷劫页内部**也会渲染，它给出的
  下一步按钮正是 `data-a="tribulation-open"`。可此时 panel==='tribulation'，
  守卫不成立 -> 落到兜底 -> game.act('tribulation-open') -> 没有这个 case -> 「无效操作」。
  元婴问心页（progGuide('heart')）同理。
  另外 `progNext()` 还会给出 `act:'codex-open'`，而 handle()/act() 里**根本没有 codex-open**，
  那个「采集 X（缺 N）」按钮一直点不动。

修复：
  A. 六个试炼按钮改成不带 panel 守卫（在哪儿点都能进对应页/动作）
  B. 新增 codex-open -> 打开图鉴（data-name 指定分类）
  C. act() 补上 tribulation-act / tribulation-start / heart-act / heart-start 的别名，
     就算以后 UI 守卫漏了，点下去也是执行而不是「无效操作」
  D. 试炼页内部不再渲染指向自己的那张按钮（progGuide 增加 noAct 选项）
  E. 新增 tests/v936_tribulation_guide.cjs：静态校验 progNext 给出的每个 act 都有处理端 +
     真机点一遍凝丹雷劫（引雷启劫 / 选项）并断言不出现「无效操作」

三条硬断言：基线哈希 / 替换次数 / data-a 集合不变（154）。
"""
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE = RELEASES / "山野修仙记_V90.35_洞府卡片精简版.html"
OUT_NAME = "山野修仙记_V90.36_突破指引修复版.html"
BASE_SHA = "C2E7C2857A7CA8C416B050C1E86CE27593F98A6F49AAF65404E2C0852F545F2F"


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

    text = rep(text, "<title>山野修仙记 V90.35 · 洞府卡片精简</title>",
               "<title>山野修仙记 V90.36 · 突破指引修复</title>", "标题版本号")
    text = rep(text, "subtitle='人妖异途 · V90.35'", "subtitle='人妖异途 · V90.36'", "副标题版本号")
    text = rep(text, "V90.35 · ${game.character.name}", "V90.36 · ${game.character.name}", "设置页版本号")
    text = rep(text, "山野修仙记_V90.35_本机飞升资质榜.json", "山野修仙记_V90.36_本机飞升资质榜.json",
               "资质榜导出文件名")
    text = rep(text, "当前版本 V90.35：", "当前版本 V90.36：", "帮助页版本说明")

    # A. 六个试炼按钮去掉 panel 守卫
    text = rep(text,
               "if(a==='tribulation-open'&&panel==='cultivate'){panelScroll.cultivate=$('panel-body')?.scrollTop||0;panel='tribulation';render();$('panel-body').scrollTop=0;return;}",
               "if(a==='tribulation-open'){if(panel&&panel!=='tribulation')panelScroll[panel]=$('panel-body')?.scrollTop||0;panel='tribulation';render();if($('panel-body'))$('panel-body').scrollTop=0;return;}",
               "tribulation-open 去掉 panel 守卫")
    text = rep(text, "if(a==='tribulation-start'&&panel==='tribulation'){run('core-trial-start');return;}",
               "if(a==='tribulation-start'){panel='tribulation';render();run('core-trial-start');return;}",
               "tribulation-start 去掉 panel 守卫")
    text = rep(text, "if(a==='tribulation-act'&&panel==='tribulation'){run('core-trial-act',{mode:b.dataset.mode});return;}",
               "if(a==='tribulation-act'){panel='tribulation';run('core-trial-act',{mode:b.dataset.mode});return;}",
               "tribulation-act 去掉 panel 守卫")
    text = rep(text,
               "if(a==='heart-open'&&panel==='cultivate'){panelScroll.cultivate=$('panel-body')?.scrollTop||0;panel='hearttrial';render();$('panel-body').scrollTop=0;return;}",
               "if(a==='heart-open'){if(panel&&panel!=='hearttrial')panelScroll[panel]=$('panel-body')?.scrollTop||0;panel='hearttrial';render();if($('panel-body'))$('panel-body').scrollTop=0;return;}",
               "heart-open 去掉 panel 守卫")
    text = rep(text, "if(a==='heart-start'&&panel==='hearttrial'){run('heart-trial-start');return;}",
               "if(a==='heart-start'){panel='hearttrial';render();run('heart-trial-start');return;}",
               "heart-start 去掉 panel 守卫")
    text = rep(text, "if(a==='heart-act'&&panel==='hearttrial'){run('heart-trial-act',{mode:b.dataset.mode});return;}",
               "if(a==='heart-act'){panel='hearttrial';run('heart-trial-act',{mode:b.dataset.mode});return;}",
               "heart-act 去掉 panel 守卫")

    # B. codex-open：指引里「采集 X」那颗按钮
    text = rep(text,
               "if(a==='heart-return'&&panel==='hearttrial'){panel='cultivate';render();$('panel-body').scrollTop=panelScroll.cultivate||0;return;}",
               "if(a==='heart-return'&&panel==='hearttrial'){panel='cultivate';render();$('panel-body').scrollTop=panelScroll.cultivate||0;return;}"
               " if(a==='codex-open'){openPanel(b.dataset.name||'book');return;}",
               "新增 codex-open 处理")

    # C. act() 别名（防御：UI 守卫再漏也不会变成「无效操作」）
    text = rep(text, "case 'core-trial-start':result=this.coreTrialStart();break;case 'core-trial-act':result=this.coreTrialAct(args.mode);break;",
               "case 'core-trial-start':case 'tribulation-start':result=this.coreTrialStart();break;"
               "case 'core-trial-act':case 'tribulation-act':result=this.coreTrialAct(args.mode);break;",
               "act() 增加 tribulation 别名")
    text = rep(text, "case 'heart-trial-start':result=this.heartTrialStart();break;case 'heart-trial-act':result=this.heartTrialAct(args.mode);break;",
               "case 'heart-trial-start':case 'heart-start':result=this.heartTrialStart();break;"
               "case 'heart-trial-act':case 'heart-act':result=this.heartTrialAct(args.mode);break;",
               "act() 增加 heart 别名")

    # D. 试炼页内部不再渲染指向自己的按钮
    text = rep(text, "function progGuide(kind){", "function progGuide(kind,opts){", "progGuide 收 opts")
    text = rep(text, "const btn=next?next.act", "const btn=opts&&opts.noAct?'' : next?next.act", "progGuide 支持 noAct")
    text = rep(text, "${progGuide('core')}<div class=\"trial-intro\">",
               "${progGuide('core',{noAct:true})}<div class=\"trial-intro\">", "雷劫页内不再渲染进入按钮")
    text = rep(text, "${game.realmAt(s.zone-3)}</h3>${progGuide('core')}",
               "${game.realmAt(s.zone-3)}</h3>${progGuide('core',{noAct:true})}",
               "破境条件页内不再重复渲染进入按钮")
    text = rep(text, "${progGuide('heart')}${header}",
               "${progGuide('heart',{noAct:true})}${header}", "问心页内不再渲染进入按钮")

    for needle, what in (("if(a==='tribulation-open'){", "tribulation-open 无守卫"),
                         ("if(a==='codex-open'){openPanel(", "codex-open 处理"),
                         ("case 'tribulation-act':", "act 别名 tribulation"),
                         ("case 'heart-act':", "act 别名 heart"),
                         ("progGuide(kind,opts)", "progGuide noAct"),
                         ("{noAct:true}", "试炼页内抑制按钮")):
        if needle not in text:
            raise SystemExit(f"[ABORT] 产物缺少：{what}")
    ok("产物标记", "守卫/别名/codex-open/noAct 齐全")
    for bad in ("a==='tribulation-open'&&panel", "a==='tribulation-act'&&panel", "a==='heart-open'&&panel"):
        if bad in text:
            raise SystemExit(f"[ABORT] 仍有 panel 守卫：{bad}")
    ok("旧守卫已清除", "试炼相关分支不再依赖 panel")

    after = actions(text)
    if after != before:
        raise SystemExit(f"[ABORT] 动作集合被改动：{sorted(after ^ before)}")
    ok("动作集合不变", f"{len(after)} 个")

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
