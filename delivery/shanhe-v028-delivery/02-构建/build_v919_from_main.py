#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
山野修仙记 V90.18 -> V90.19 构建器（一次性「评价 + 加群」悬浮标点）

用户需求：做成一个小的悬浮标点引导玩家点击，点一次就够了，之后不再出现；
         内容 = 提醒去评价（纯文字引导，不跳转）+ 展示 QQ 群号。

设计：
  - 引擎侧（不是适配层）：这是游戏 UI，不是平台能力。评价只做文字引导，
    因此不需要任何 tap.* 接口，也就不必等平台 API 确认。
  - 一次性标记用**全局** localStorage 键 shanye-promo-v1（玩家级，不是角色级），
    不进任何 slot 存档，避免动 normalize / 100 档回归 / 云存档 payload。
  - 显示门槛：在游戏中、无面板、非战斗、非前页、且已有洞府或第 2 日起；
    点开后立刻标记已读 → 之后永不再出现（点一次就够）。
  - 悬浮标点放在 #promo-root（absolute，z-index 5，低于 .panel-overlay 的 10
    与 .modal-backdrop 的 70），所以永远不会压住面板/弹窗。

三条硬断言：基线哈希 / 每处替换次数 / data-a 集合不减少。
"""
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE = RELEASES / "山野修仙记_V90.18_轮回玉广告奖励版.html"
OUT_NAME = "山野修仙记_V90.19_评价与加群提示版.html"
BASE_SHA = "311F4500040091EBA1E3697E8E5B51A8A0DE37DDFDE77E8A81B4AA2C405492B8"

GROUP = "854720768"

PROMO_CSS = """
/* V90.19 一次性「评价 + 加群」入口（点过即消失）
   位置：场景卡标题行内（标题与危险度徽章之间）的一个小圆角标点。
   为什么不用贴边悬浮：320 宽实测 HUD 每个像素都被占用（资源格第 6 列到 x=308），
   贴在右缘会实打实盖住一颗资源；放进标题行则由 flex 天然让位，永不重叠。 */
#promo-slot{flex:none;display:flex;align-items:center}
#promo-slot .promo-chip{height:20px;padding:0 6px;border:1px solid var(--line-strong,#777);
 border-radius:4px;background:var(--panel-bg,#fff);color:var(--ink,#222);font-size:9.5px;
 line-height:1;white-space:nowrap;flex:none;letter-spacing:.01em}
#promo-slot .promo-chip:active{background:#eee}
#scene-content .location-head h1{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.modal .promo-group{display:flex;align-items:center;justify-content:space-between;gap:10px;
 border:1px solid #777;border-radius:6px;background:#fff;padding:10px 12px;margin:10px 0;font-size:12px}
.modal .promo-group b{font:650 20px/1.1 "Songti SC","SimSun",serif;letter-spacing:.08em}
"""

PROMO_JS = """/* ===== V90.19 一次性「评价 + 加群」提示 ===== */
const PROMO={key:'shanye-promo-v1',group:'__GROUP__'};
function promoSeen(){try{return localStorage.getItem(PROMO.key)==='1';}catch{return true;}}
function promoMark(){try{localStorage.setItem(PROMO.key,'1');}catch{}}
function promoVisible(){return !promoSeen()&&!!game&&!!activeRole&&!frontPage&&!deathBoot&&!panel&&!game.s.combat&&(game.camp||game.day>=2);}
let promoShown=null;
function renderPromo(){
 const slot=document.getElementById('promo-slot');
 if(!slot){promoShown=null;return;}
 const show=promoVisible();
 if(promoShown===show)return;
 promoShown=show;
 slot.innerHTML=show?`<button class="promo-chip" data-a="promo-open" aria-label="评价与玩家群">★ 评价</button>`:'';
}
function copyPromoGroup(){
 const done=()=>notify('群号已复制：'+PROMO.group,'ok');
 const fail=()=>notify('复制失败，请手动记下群号 '+PROMO.group,'warn');
 try{const p=navigator.clipboard&&navigator.clipboard.writeText(PROMO.group);if(p&&p.then)p.then(done).catch(fail);else fail();}catch(e){fail();}
}
function openPromo(){promoMark();promoShown=null;showModal({kind:'promo'});render();}
"""

PROMO_MODAL = """ else if(modal.kind==='promo')body=`<div class="kicker">人间烟火 · 只提这一次</div><h2>给个评价，或来群里坐坐</h2><p>在 TapTap 搜索《山野修仙记》，进详情页点「评价」，说说真实感受就行——好评差评都会看，也不会有任何奖励交换。</p><div class="promo-group"><span>玩家交流群（QQ）</span><b>${PROMO.group}</b></div><p><small>这个提示只出现一次，关掉后不再打扰。</small></p><div class="inline-buttons"><button class="btn" data-a="promo-copy">复制群号</button><button class="btn primary" data-a="promo-close">知道了</button></div>`;
"""

PROMO_ACTIONS = """ if(a==='promo-open'){openPromo();return;}
 if(a==='promo-copy'){copyPromoGroup();return;}
 if(a==='promo-close'){promoMark();closeModal();render();return;}
"""


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
    text = rep(text, "<title>山野修仙记 V90.18 · 轮回玉广告奖励</title>",
               "<title>山野修仙记 V90.19 · 评价与加群提示</title>", "标题版本号")
    text = rep(text, "subtitle='人妖异途 · V90.18'", "subtitle='人妖异途 · V90.19'", "副标题版本号")
    text = rep(text, 'V90.18 · ${game.character.name}', 'V90.19 · ${game.character.name}', "设置页版本号")
    text = rep(text, "山野修仙记_V90.18_本机飞升资质榜.json", "山野修仙记_V90.19_本机飞升资质榜.json",
               "资质榜导出文件名")
    text = rep(text, "当前版本 V90.18：", "当前版本 V90.19：", "帮助页版本说明")

    # ---- 1. 样式 ----
    text = rep(text, "\n</style>\n</head>\n<body>",
               "\n</style>\n<style id=\"v919-promo\">" + PROMO_CSS + "</style>\n</head>\n<body>",
               "注入悬浮标点样式")

    # ---- 2. 入口插槽（场景卡标题行内，flex 自然让位，不压任何内容） ----
    text = rep(text, '<div class="location-head"><h1>${esc(game.name)}</h1><span class="risk',
               '<div class="location-head"><h1>${esc(game.name)}</h1><span id="promo-slot"></span><span class="risk',
               "注入 promo-slot 插槽")

    # ---- 3. 逻辑（放在 renderModal 之前，top-level const 在脚本执行到此即初始化） ----
    text = rep(text, "function renderModal(){",
               PROMO_JS.replace("__GROUP__", GROUP) + "function renderModal(){", "注入 PROMO 逻辑")

    # ---- 4. render() 里刷新标点（P2 适配层锚点只匹配 render 前两行，这里不动它） ----
    text = rep(text, "renderPanel();syncLayers();", "renderPanel();renderPromo();syncLayers();",
               "render 内刷新标点")

    # ---- 5. 动作 ----
    text = rep(text, " if(a==='modal-close'&&modal){closeModal();return;}",
               PROMO_ACTIONS + " if(a==='modal-close'&&modal){closeModal();return;}", "注入三条动作")

    # ---- 6. 弹窗正文 ----
    text = rep(text, " else if(modal.kind==='ranking')body=leaderboardBody();",
               PROMO_MODAL + " else if(modal.kind==='ranking')body=leaderboardBody();", "注入弹窗正文")

    # ---- 断言 ----
    after_actions = actions(text)
    lost = before_actions - after_actions
    if lost:
        raise SystemExit(f"[ABORT] 动作集合减少：{sorted(lost)}")
    new_actions = sorted(after_actions - before_actions)
    if new_actions != ["promo-close", "promo-copy", "promo-open"]:
        raise SystemExit(f"[ABORT] 新增动作异常：{new_actions}")
    ok("动作集合", f"{len(after_actions)} 个（新增 {new_actions}）")

    for token in (GROUP, 'id="promo-slot"', "renderPromo();", "modal.kind==='promo'", "promoMark();"):
        if token not in text:
            raise SystemExit(f"[ABORT] 缺少产物标记：{token}")
    if text.count('id="promo-slot"') != 1:
        raise SystemExit("[ABORT] promo-slot 插槽重复")
    if 'id="promo-root"' in text:
        raise SystemExit("[ABORT] 不应再有 promo-root 悬浮层")
    ok("产物标记", "插槽 / 逻辑 / 动作 / 弹窗 齐全")

    out = text.replace("\n", "\r\n").encode("utf-8")
    (RELEASES / OUT_NAME).write_bytes(out)
    (ROOT / "index.html").write_bytes(out)
    ok("产物一致性", "index.html == release")

    print(f"\n  releases/{OUT_NAME}")
    print(f"  字节数 : {len(out):,}")
    print(f"  SHA256 : {sha(out)}")


if __name__ == "__main__":
    main()
