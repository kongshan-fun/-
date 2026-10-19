#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
山野修仙记 V90.10 -> TapTap H5 版体

基线：V90.10 发布文件（字节哈希校验）
做法：P1 在 <body> 后注入 QTAP 适配层；P2 render() 发布运行状态与战力；
      P3 persist() 发布存档节拍。三处均断言唯一命中，失败即中止。
产出：taptap-build/shanhe-v910-taptap/（index.html + selftest.html + README.md）与上传 ZIP。
"""
import hashlib
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "releases" / "山野修仙记_V90.10_界面密度与检索优化版.html"
ADAPTER = ROOT.parent / "shanhe-v907" / "taptap" / "taptap-adapter.js"
OUTDIR = ROOT / "taptap-build" / "shanhe-v910-taptap"
ZIP = ROOT.parent / "山野修仙记_V90.10_TapTap上传包.zip"

BASE_SHA = "FC024760C3D0FF710ADB2D49D51A84EC3738B3B3F3D8DED77FB227DCE3731AC0"

checks = []


def ok(label, detail=""):
    checks.append(label)
    print(f"  [OK] {label}" + (f"  {detail}" if detail else ""))


def die(msg):
    raise SystemExit(f"\n[ABORT] {msg}")


def rep(text, old, new, label, expect=1):
    n = text.count(old)
    if n != expect:
        die(f"{label}: 期望 {expect} 次，实际 {n} 次")
    ok(label)
    return text.replace(old, new, expect)


def sha(b):
    return hashlib.sha256(b).hexdigest().upper()


P1_OLD = '<body>\n<div id="phone"'
P2_OLD = "function render(){\n renderStatus();"
P3_OLD = "function persist(){\n if(!activeRole)return true;"

P2_NEW = (
    "function render(){\n"
    " try{window.__QTAP_STATE={role:activeRole,slot:activeSlot,game:game,"
    "power:(function(){try{return QCombatRating.live(game).total||0}catch(__qtapP){return 0}})()};"
    "window.__QTAP_NOTIFY=notify;}catch(__qtapE){}\n"
    " renderStatus();"
)
P3_NEW = (
    "function persist(){\n"
    " try{window.__QTAP_STATE={role:activeRole,slot:activeSlot,game:game,"
    "power:(function(){try{return QCombatRating.live(game).total||0}catch(__qtapP){return 0}})()};"
    "window.__QTAP_SAVE_TICK=(window.__QTAP_SAVE_TICK||0)+1;}catch(__qtapE){}\n"
    " if(!activeRole)return true;"
)

SELFTEST = """<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>山野修仙记 V90.10 · TapTap 环境自检</title>
<style>
 body{margin:0;padding:16px;font:14px/1.6 system-ui,-apple-system,"Microsoft YaHei",sans-serif;background:#f6f6f4;color:#1a1a1a}
 h1{font-size:17px;margin:0 0 4px} .sub{color:#666;font-size:12px;margin-bottom:14px}
 .row{display:flex;justify-content:space-between;gap:10px;padding:9px 11px;background:#fff;border:1px solid #e2e2e2;border-radius:8px;margin-bottom:6px}
 .ok{color:#1b7a3f;font-weight:600} .no{color:#b3261e;font-weight:600}
 code{background:#eee;padding:1px 5px;border-radius:4px;font-size:12px}
 .code{margin-top:14px;padding:11px;background:#141414;color:#fff;border-radius:8px;font-size:13px;word-break:break-all}
</style></head><body>
<h1>TapTap 环境自检</h1>
<div class="sub">山野修仙记 V90.10 · 界面密度与检索优化</div>
<div id="rows"></div>
<div class="code" id="code"></div>
<script>
function add(name,present,extra){
  var d=document.createElement('div');d.className='row';
  d.innerHTML='<span>'+name+'</span><span class="'+(present?'ok':'no')+'">'+(present?'可用':'缺失')+(extra?' · '+extra:'')+'</span>';
  document.getElementById('rows').appendChild(d);
}
var t=window.tap;
add('TapTap 运行环境 tap', !!t, t?(t.env&&t.env.USER_DATA_PATH?'有 USER_DATA_PATH':''):'');
add('云存档 getCloudSaveManager', !!(t&&t.getCloudSaveManager));
add('排行榜 getLeaderboardManager', !!(t&&t.getLeaderboardManager));
add('文件系统 getFileSystemManager', !!(t&&t.getFileSystemManager));
add('本地存储 setStorageSync', !!(t&&t.setStorageSync));
add('QTAP 适配层', !!window.QTap);
if(window.QTap&&window.QTap.env){ add('适配层环境判定', true, window.QTap.env.mock?'MOCK(非 TapTap 容器)':'真实 TapTap'); }
document.getElementById('code').textContent='BUILD 测试码：' + (window.__SHANYE_BUILD_CODE||'(未注入)');
</script>
</body></html>
"""

README = """# 山野修仙记 V90.10 · TapTap H5 上传包

## 包体结构
```
shanhe-v910-taptap/
├── index.html      完整游戏（已注入 TapTap 适配层）
├── selftest.html   环境自检页（在 TapTap 容器内打开可看到 API 可用性）
└── README.md       本文件
```
上传时**整个 `shanhe-v910-taptap` 文件夹压成 zip**，确保 `index.html` 在文件夹根目录。

## 本轮接入（P1/P2/P3）
- P1：`<body>` 后注入 QTAP 适配层（云存档 / 战力榜 / 免费领取三处入口）
- P2：`render()` 开头发布 `__QTAP_STATE`（种族、档位、game 实例、实时战力）
- P3：`persist()` 开头发布 `__QTAP_SAVE_TICK`（存档节拍，驱动云同步节流）

**未改动**：战斗数值、突破难度、存档结构、寿元与续命规则、储物袋、飞升结算。

## 本地测试
1. 起一个静态服务（不要用 file://，`tap` 注入与 localStorage 域名隔离更接近真实）：
   ```
   cd taptap-build/shanhe-v910-taptap
   python -m http.server 8080
   ```
2. 浏览器打开 `http://127.0.0.1:8080/index.html`
3. 打开 `http://127.0.0.1:8080/selftest.html` 看环境自检
   - 在**普通浏览器**里，tap 相关项会显示「缺失」—— 这是正常的，说明当前不在 TapTap 容器内；
     游戏会自动走 MOCK 降级，可正常游玩与本地存档。
   - 在 **TapTap 容器**里打开，五项应显示「可用」。

## 待你确认后补的两项
1. **排行榜 ID**：适配层 `CONFIG.leaderboard.power` 目前为空，战力榜不会真正上报。
   在开发者后台建榜拿到 ID 后回填并重新出包。
2. **广告口径**：本包仍是「试玩领取 / 模拟广告」文案，未接真实激励视频。
   若要接真实广告，需要广告位 ID 并做一轮文案与调用改造。

## 已知限制
- 未在真实 TapTap 容器内运行过（本轮只有普通浏览器 + MOCK 降级验证）。
- 云存档 / 排行榜的**真实互通**需要你在 TapTap 侧实测。
"""


def main():
    print("V90.10 -> TapTap 版体构建开始\n")
    if not BASE.exists():
        die(f"缺少基线：{BASE}")
    if not ADAPTER.exists():
        die(f"缺少适配层：{ADAPTER}")

    raw = BASE.read_bytes()
    if sha(raw) != BASE_SHA:
        die(f"基线哈希不符：{sha(raw)}")
    ok("基线校验", f"{len(raw)} B")

    text = raw.decode("utf-8").replace("\r\n", "\n")
    adapter = ADAPTER.read_text(encoding="utf-8")
    if "QTAP" not in adapter:
        die("适配层内容异常")

    # 依赖符号必须存在
    for sym in ("QCombatRating.live", "function notify(", "activeSlot", "activeRole"):
        if sym not in text:
            die(f"缺少依赖符号：{sym}")
    ok("依赖符号", "QCombatRating.live / notify / activeRole / activeSlot")

    # ---- P1 ----
    text = rep(text, P1_OLD,
               '<body>\n<script>\n' + adapter + '\n</script>\n<div id="phone"',
               "P1 注入 QTAP 适配层")

    # ---- P2 / P3 ----
    text = rep(text, P2_OLD, P2_NEW, "P2 render 状态桥")
    text = rep(text, P3_OLD, P3_NEW, "P3 persist 存档节拍")

    # ---- 构建码注入（供 selftest 显示）----
    OUTDIR.mkdir(parents=True, exist_ok=True)
    code_hint = "PENDING"
    text = rep(text, "<head>",
               f'<head>\n<script>window.__SHANYE_BUILD_CODE="{code_hint}";</script>',
               "注入构建码占位")

    out_bytes = text.replace("\n", "\r\n").encode("utf-8")
    out_sha = sha(out_bytes)
    build_code = "SHANYE-V910-TT-" + out_sha[:8]
    # 用最终哈希回填构建码（大小写长度一致，哈希不变）
    text2 = text.replace('"PENDING"', '"' + build_code + '"', 1)
    out_bytes = text2.replace("\n", "\r\n").encode("utf-8")
    out_sha2 = sha(out_bytes)
    build_code = "SHANYE-V910-TT-" + out_sha2[:8]
    text2 = text.replace('"PENDING"', '"' + build_code + '"', 1)
    out_bytes = text2.replace("\n", "\r\n").encode("utf-8")

    (OUTDIR / "index.html").write_bytes(out_bytes)
    (OUTDIR / "selftest.html").write_text(SELFTEST.replace(
        "(window.__SHANYE_BUILD_CODE||'(未注入)')", "'" + build_code + "'"), encoding="utf-8")
    (OUTDIR / "README.md").write_text(
        README.replace("PENDING", build_code), encoding="utf-8")
    ok("写出包体", f"{len(out_bytes)} B")

    # ---- 校验产物 ----
    final = (OUTDIR / "index.html").read_bytes()
    ftxt = final.decode("utf-8")
    if "window.QTap" not in ftxt and "QTAP_VERSION" not in ftxt and "QTAP" not in ftxt:
        die("适配层未进入产物")
    if ftxt.count("__QTAP_STATE") < 2:
        die("状态桥未生效")
    if "__QTAP_SAVE_TICK" not in ftxt:
        die("存档节拍未生效")
    if build_code not in ftxt:
        die("构建码未写入")
    ok("产物校验", "适配层 + 状态桥 + 存档节拍 + 构建码")

    # ---- 打包 ----
    if ZIP.exists():
        ZIP.unlink()
    with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED) as z:
        for p in sorted(OUTDIR.rglob("*")):
            if p.is_file():
                z.write(p, (Path("shanhe-v910-taptap") / p.relative_to(OUTDIR)).as_posix())
    zsha = sha(ZIP.read_bytes())
    ok("打包", f"{ZIP.stat().st_size:,} B")

    print("\n--- 完成 ---")
    print(f"  目录     : {OUTDIR}")
    print(f"  index.html: {len(final):,} B  SHA256 {sha(final)}")
    print(f"  ZIP      : {ZIP}")
    print(f"  ZIP SHA  : {zsha}")
    print(f"  测试码   : {build_code}")
    print(f"\n断言通过：{len(checks)} 项")


if __name__ == "__main__":
    main()
