#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
山野修仙记 V90.16 -> V90.17 构建器（图鉴父子页）

基线：V90.16（字节哈希校验）
内容：图鉴默认页由「11 个类别折叠组」改为「品类入口 → 条目 → 详情」。
      原因（实测，不是推测）：图鉴 .book-list 高 582px，与屏宽无关
      （320/360 都是 582，390 是 606），全部来自 12 行 × 42px 的折叠组标题。
      所以 320/360 下的密度压缩必然无效，只有改结构能收敛。

三条硬断言（沿用 V90.11 起的约定）：
  1. 基线字节哈希
  2. 每处替换的出现次数
  3. 动作集合不得减少（data-a 集合比对）
"""
import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE = RELEASES / "山野修仙记_V90.16_窄屏面板密度版.html"
OUT_NAME = "山野修仙记_V90.17_图鉴父子页版.html"
BASE_SHA = "ACEACA63C32FEB14002BCD1A96713D11D461698145E543B21C311A4EEA40D32E"

# ---------------------------------------------------------------- 图鉴父子页

CATS_JS = """function bookCats(){return [['life','灵物'],['mineral','矿材'],['tool','工具'],['bag','永久储物袋'],['food','食物与丹药'],['gear','装备法器'],['enemy','妖兽'],['home','洞府建筑'],['secret','秘境'],['zone','境域'],['realm','修炼']];}
function bookCatLabel(cat){const hit=bookCats().find(c=>c[0]===cat);return hit?hit[1]:'条目';}
function bookHomeBody(){
 const rows=bookRows(),groups={};
 for(const r of rows)(groups[r.cat]=groups[r.cat]||[]).push(r);
 const claimable=D.BOOK_REWARDS.filter(r=>!game.s.codex.claims[r.id]&&game.bookCount>=r.need).length;
 const cells=bookCats().map(([cat,label])=>{const items=groups[cat]||[],known=items.filter(r=>r.known||r.cat==='bag').length;
  return `<button class="book-cat-cell" data-a="book-cat" data-cat="${cat}"><b>${label}</b><small>已识 ${known}/${items.length}</small><i>›</i></button>`;}).join('');
 const rewards=`<details class="book-rewards-fold"><summary><span>图鉴成就 ${game.bookCount}/192</span><span class="book-rewards-flag">${claimable?'可领 '+claimable+' 项':'暂无可领'}</span></summary><div class="book-rewards">${D.BOOK_REWARDS.map(r=>`<div class="reward-line"><span>${r.name} · ${game.bookCount}/${r.need}</span><button class="btn" data-a="claim-book" data-id="${r.id}" ${game.s.codex.claims[r.id]?'disabled':''}>${game.s.codex.claims[r.id]?'已领':game.bookCount>=r.need?'领取':'未达成'}</button></div>`).join('')}</div></details>`;
 return `<div class="book-home"><div class="book-cat-grid">${cells}</div>${rewards}</div>`;
}
"""

LIST_JS = """function bookListBody(){
 let rows=bookRows().filter(r=>filter==='all'||r.cat===filter).filter(r=>!search||((r.known||r.cat==='bag')?r.name:'未发现').includes(search)||r.hint.includes(search));
 rows.sort((a,b)=>Number(b.known)-Number(a.known));
 const known=rows.filter(r=>r.known||r.cat==='bag').length;
 const head=`<div class="book-list-head"><b>${filter==='all'?'搜索结果':bookCatLabel(filter)}</b><span>已识 ${known}/${rows.length}</span></div>`;
 const entry=r=>`<button class="book-entry book-entry-link ${r.known?'vis-book-'+r.cat:'unknown'}" data-a="book-open" data-key="${r.key}"><span class="book-entry-main"><span class="book-entry-title ${r.cat==='gear'?'codex-gear-name':''}">${r.known||r.cat==='bag'?esc(r.name):'未发现'}</span><span class="book-entry-sub">${r.known||r.cat==='bag'?({item:'资源',life:'灵物',mineral:'矿材',tool:'工具',bag:'永久储物袋',food:'食物与丹药',enemy:'妖兽',gear:'装备法器',home:'洞府建筑',secret:'秘境',zone:'境域',realm:'修炼'}[r.cat]||'已发现条目'):'尚未发现 · 点击查看线索'}</span></span><span class="book-entry-arrow">${r.known?'已识':'线索'} ›</span></button>`;
 return `<div class="book-list">${head}${rows.map(entry).join('')||'<div class="empty">没有符合条件的条目</div>'}</div>`;
}
"""

ACTIONS_JS = """ if(a==='book-cat'&&panel==='book'){const cat=String(b.dataset.cat||'');if(!bookCats().some(c=>c[0]===cat))return;filter=cat;search='';bookDetailKey=null;panelScroll.book=0;renderPanel();if($('panel-body'))$('panel-body').scrollTop=0;return;}
 if(a==='book-home'&&panel==='book'){filter='all';search='';bookDetailKey=null;panelScroll.book=0;renderPanel();if($('panel-body'))$('panel-body').scrollTop=0;return;}
"""

BOOK_CSS = """
/* V90.17 图鉴父子页：品类入口 → 条目 → 详情
   依据：图鉴原默认页是 12 行 × 42px 的折叠组（582px 固定高度，与屏宽无关），
   320/360 下必然 1.6–2.0 屏；密度压缩对它结构性无效。改为品类入口 + 同质条目列表。 */
#panel-root .book-home{display:flex;flex-direction:column;gap:8px}
#panel-root .book-cat-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
#panel-root .book-cat-cell{display:flex;align-items:center;justify-content:space-between;gap:6px;
 min-height:44px;padding:7px 10px;border:1px solid var(--line,#ddd);border-radius:8px;
 background:var(--surface,#fff);color:var(--ink,#222);text-align:left;cursor:pointer}
#panel-root .book-cat-cell:active{border-color:var(--ink,#222)}
#panel-root .book-cat-cell b{font-size:12.5px;font-weight:600;line-height:1.25;overflow-wrap:anywhere}
#panel-root .book-cat-cell small{flex:none;font-size:9.5px;color:var(--muted,#555);white-space:nowrap;font-variant-numeric:tabular-nums}
#panel-root .book-cat-cell i{flex:none;font-style:normal;font-size:14px;line-height:1;color:var(--muted,#555)}
#panel-root .book-list-head{display:flex;align-items:center;justify-content:space-between;gap:8px;
 padding:0 2px 6px;font-size:10.5px;color:var(--muted,#555);font-variant-numeric:tabular-nums}
#panel-root .book-list-head b{font-size:12px;font-weight:600;color:var(--ink,#222)}
@media (max-width:400px){
  #panel-root .book-cat-cell{min-height:40px;padding:6px 8px;gap:4px}
  #panel-root .book-cat-cell b{font-size:12px}
  #panel-root .book-cat-cell small{font-size:9px}
}
@media (max-width:340px){
  #panel-root .book-home{gap:6px}
  #panel-root .book-cat-grid{gap:5px}
  #panel-root .book-cat-cell{min-height:36px;padding:5px 7px}
  #panel-root .book-cat-cell b{font-size:11.5px}
}
"""


def sha(b):
    return hashlib.sha256(b).hexdigest().upper()


def ok(l, d=""):
    print(f"  [OK] {l}" + (f"  {d}" if d else ""))


def rep(t, old, new, label, expect=1):
    n = t.count(old)
    if n != expect:
        raise SystemExit(f"[ABORT] {label}: 期望 {expect} 次，实际 {n}")
    ok(label)
    return t.replace(old, new, expect)


def slice_between(t, start, end, new, label, must_contain=()):
    """按起止锚点整体替换一段，两端各断言恰好 1 次。"""
    if t.count(start) != 1:
        raise SystemExit(f"[ABORT] {label}: 起点锚点出现 {t.count(start)} 次")
    if t.count(end) != 1:
        raise SystemExit(f"[ABORT] {label}: 终点锚点出现 {t.count(end)} 次")
    i = t.index(start)
    j = t.index(end, i)
    if j <= i:
        raise SystemExit(f"[ABORT] {label}: 锚点顺序异常")
    removed = t[i:j]
    for token in must_contain:
        if token not in removed:
            raise SystemExit(f"[ABORT] {label}: 被替换段里缺少预期特征 {token!r}")
    ok(label, f"替换 {len(removed)} 字符")
    return t[:i] + new + t[j:]


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

    # 1. 版本号与文案
    text = rep(text, "<title>山野修仙记 V90.16 · 窄屏面板密度</title>",
               "<title>山野修仙记 V90.17 · 图鉴父子页</title>", "标题版本号")
    text = rep(text, "subtitle='人妖异途 · V90.16'", "subtitle='人妖异途 · V90.17'", "副标题版本号")
    text = rep(text, 'V90.16 · ${game.character.name}', 'V90.17 · ${game.character.name}', "设置页版本号")
    text = rep(text, "山野修仙记_V90.16_本机飞升资质榜.json", "山野修仙记_V90.17_本机飞升资质榜.json",
               "资质榜导出文件名")
    text = rep(text,
               "当前版本 V90.14：设置按分区进入；炼制按品类与品阶进入；洞府设施回归本体；顶栏与背包的外部入口已收拢。",
               "当前版本 V90.17：设置、炼制、图鉴均按品类进入；洞府设施属于本体，就地展示；顶栏与背包的外部入口已收拢。",
               "帮助页版本说明")

    # 2. 图鉴数据与入口页（插在 bookListBody 之前）
    text = rep(text, "function bookListBody(){", CATS_JS + "function bookListBody(){", "注入品类表与图鉴入口页")

    # 3. 图鉴条目页：去掉折叠组，改为同质平铺列表
    text = slice_between(text,
                         "function bookListBody(){",
                         "function bookDetailBody(){",
                         LIST_JS,
                         "重写图鉴条目页",
                         must_contain=("book-rewards-fold", "book-group", "book-open"))

    # 4. bookBody 分流：详情 / 品类入口 / 条目
    text = rep(text,
               "function bookBody(){return bookDetailKey?bookDetailBody():bookListBody();}",
               "function bookBody(){return bookDetailKey?bookDetailBody():(filter==='all'&&!search?bookHomeBody():bookListBody());}",
               "图鉴视图分流")

    # 5. 面板标题：品类页显示「图鉴 · 妖兽」
    text = rep(text,
               "<strong>${panel==='book'&&bookDetailKey?'图鉴 · 详情':names[panel]}</strong>",
               "<strong>${panel==='book'?(bookDetailKey?'图鉴 · 详情':(filter==='all'&&!search)?'图鉴':'图鉴 · '+bookCatLabel(filter)):names[panel]}</strong>",
               "面板标题（图鉴品类页）")

    # 6. 返回键：品类页显示「← 返回图鉴」
    text = rep(text,
               "panel==='lore'?'<button class=\"panel-back\" data-a=\"panel-back\" aria-label=\"返回主线\">← 返回主线</button>':''}",
               "panel==='lore'?'<button class=\"panel-back\" data-a=\"panel-back\" aria-label=\"返回主线\">← 返回主线</button>':(panel==='book'&&!bookDetailKey&&(filter!=='all'||search))?'<button class=\"panel-back\" data-a=\"book-home\" aria-label=\"返回图鉴\">← 返回图鉴</button>':''}",
               "面板返回键（返回图鉴）")

    # 7. 工具栏：图鉴不再需要品类下拉（品类页已承担），只留搜索
    sel = '<select id="panel-filter" aria-label="图鉴类型">'
    if text.count(sel) != 1:
        raise SystemExit(f"[ABORT] 图鉴品类下拉锚点出现 {text.count(sel)} 次")
    i = text.index(sel)
    j = text.index("</select>", i) + len("</select>")
    dropped = text[i:j]
    for token in ("['realm','修炼']", "['gear','装备法器']", "图鉴类型"):
        if token not in dropped:
            raise SystemExit(f"[ABORT] 待移除段缺少特征 {token!r}")
    if len(dropped) > 600:
        raise SystemExit(f"[ABORT] 待移除段过长（{len(dropped)}），锚点可能错位")
    text = text[:i] + text[j:]
    ok("移除图鉴品类下拉", f"{len(dropped)} 字符")
    if sel in text:
        raise SystemExit("[ABORT] 图鉴下拉未被完全移除")

    # 8. 动作处理：进入品类 / 返回图鉴入口
    text = rep(text, " if(a==='book-open'&&panel==='book'){",
               ACTIONS_JS + " if(a==='book-open'&&panel==='book'){",
               "注入 book-cat / book-home 动作")

    # 9. 样式
    text = rep(text, "\n</style>\n</head>\n<body>",
               "\n</style>\n<style id=\"v917-book-hierarchy\">" + BOOK_CSS + "</style>\n</head>\n<body>",
               "注入图鉴父子页样式")

    # ---- 断言三：动作集合不得减少
    after_actions = actions(text)
    lost = before_actions - after_actions
    if lost:
        raise SystemExit(f"[ABORT] 动作集合减少：{sorted(lost)}")
    ok("动作集合未减少", f"{len(after_actions)} 个（新增 {sorted(after_actions - before_actions) or '无'}）")

    # 断言：图鉴不再有折叠组，且入口页/条目页都在
    checks = {
        '<details class="book-group"': 0,
        'data-a="book-cat"': 1,
        'data-a="book-home"': 1,
        "bookHomeBody": 2,
        "book-list-head": 2,
    }
    for token, want in checks.items():
        n = text.count(token)
        if want == 0 and n != 0:
            raise SystemExit(f"[ABORT] {token} 仍出现 {n} 次")
        if want and n < want:
            raise SystemExit(f"[ABORT] {token} 只出现 {n} 次")
    ok("结构断言", "无折叠组、品类入口/条目页就位")

    out = text.replace("\n", "\r\n").encode("utf-8")
    (RELEASES / OUT_NAME).write_bytes(out)
    (ROOT / "index.html").write_bytes(out)
    ok("产物一致性", "index.html == release")

    print(f"\n  releases/{OUT_NAME}")
    print(f"  字节数 : {len(out):,}")
    print(f"  SHA256 : {sha(out)}")


if __name__ == "__main__":
    main()
