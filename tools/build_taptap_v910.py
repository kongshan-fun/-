#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
山野修仙记 V90.10 -> TapTap H5 版体（完整移植 v907 适配线的补丁集）

基线：V90.10 发布文件（字节哈希校验）
补丁：P1 适配层注入 / P2 render 状态桥 / P3 persist 存档节拍 /
      P4a-P4n 广告与云端文案 / P5 版本校验 / P6 首领成就 / P7 飞升速通榜
产物：taptap-build/shanhe-v910-taptap/ 与上传 ZIP

与 v907 的差异：
  - 文案锚点逐条按 V90.10 实际命中处理；V90.9 重写过设置页，部分旧锚点已不存在，
    这些条目会被记为 SKIP 并单独列出来，不静默跳过。
  - 广告位 / 战力榜 / 速通榜 ID 沿用 v907 已验证的客户端 ID。
"""
import hashlib
import json
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "releases" / "山野修仙记_V90.10_界面密度与检索优化版.html"
ADAPTER = ROOT.parent / "shanhe-v907" / "taptap" / "taptap-adapter.js"
OUTDIR = ROOT / "taptap-build" / "shanhe-v910-taptap"
ZIP = ROOT.parent / "山野修仙记_V90.10_TapTap上传包.zip"

BASE_SHA = "FC024760C3D0FF710ADB2D49D51A84EC3738B3B3F3D8DED77FB227DCE3731AC0"

# v907 已验证的客户端 ID（适配层 CONFIG 内已含，这里用于产物断言）
AD_SPACE_ID = "1054324"
LB_POWER = "a7m6yjlef2giizektn"
LB_SPEEDRUN = "v0jbfn60tgtdlysic0"

applied, skipped = [], []


def log(msg):
    print(msg)


def die(msg):
    raise SystemExit(f"\n[ABORT] {msg}")


def rep1(text, old, new, label, required=True):
    """唯一命中才替换；required=False 时未命中记 SKIP。"""
    n = text.count(old)
    if n == 1:
        applied.append(label)
        log(f"  [OK]   {label}")
        return text.replace(old, new, 1)
    if n == 0 and not required:
        skipped.append(label)
        log(f"  [SKIP] {label}（锚点不存在）")
        return text
    die(f"{label}: 期望 1 次，实际 {n} 次")


# ---------------- 文案补丁（v907 原样，缺锚点的 SKIP） ----------------
COPY_V907 = [
    ("模拟激励 · 非真实广告", "激励视频 · 观看领取", "P4a 续命弹窗标题"),
    ("本弹窗仅为玩法模拟，不会播放真实广告，也不会联网请求广告平台。",
     "点击下方按钮观看激励视频，完整看完即发放；中途关闭不发奖励。", "P4b 续命弹窗说明"),
    ("<span>模拟广告</span>", "<span>激励视频</span>", "P4c 续命弹窗标签"),
    ("模拟观看完成 · 领取10年", "观看视频 · 领取10年", "P4d 续命弹窗按钮"),
    ("续命机缘 · 试玩领取", "续命机缘 · 观看领取", "P4e 设置页标题"),
    ("无真实广告、无网络请求、不消耗轮回玉", "观看激励视频领取，不消耗轮回玉", "P4f 设置页说明"),
    ("可模拟观看广告领取3次", "观看激励视频可再领3次", "P4g 抽取次数提示"),
    ("任何天赋都可以飞升；试玩领取不需要观看广告。",
     "任何天赋都可以飞升；领取额外抽取次数需观看激励视频。", "P4h 命格页规则说明"),
    ("广告奖励立即记入当前档位账本。", "观看广告所得立即记入当前档位账本。", "P4i 轮回玉奖励说明"),
    ("当前不含仙界内容、宗门弟子、多人联机、广告或付费抽卡。",
     "当前接入 TapTap 激励视频广告、云端存档与战力排行榜；不含仙界内容、宗门弟子、多人联机或付费抽卡。",
     "P4j FAQ 版本说明 A"),
    ("本版没有离线收益、抽卡、广告、付费建筑、联网排行榜或宗门弟子管理。",
     "本版接入激励视频广告、云端存档与联网战力排行榜；没有离线收益、抽卡、付费建筑或宗门弟子管理。",
     "P4k FAQ 版本说明 B"),
    ("外部JSON仍可手动回档。", "进度自动保存并同步到 TapTap 云端。", "P4l 存档口径 A"),
    ("换文件路径、浏览器、设备或网址前先导出。",
     "进度自动保存并同步到 TapTap 云端，换设备登录同一账号即可接续。", "P4m 存档口径 B"),
    ("飞升榜仅在本机保存、可导出 JSON，不是已接入云端的公开排行榜。",
     "飞升成绩会同时提交到 TapTap 云端「飞升速通榜」，可在设置页打开查看。", "P4n 飞升榜口径"),
]

# ---------------- V90.9 重写后的设置页文案（新增锚点） ----------------
COPY_V910 = [
    ("领取无真实广告、无网络请求、不消耗轮回玉。", "观看激励视频领取，不消耗轮回玉。", "P4f' 设置页说明（V90.9 新结构）"),
    ("外部 JSON 仍可手动回档。", "进度自动保存并同步到 TapTap 云端。", "P4l' 存档口径（V90.9 新结构）"),
    ("进度保存在本机浏览器。", "进度自动保存并同步到 TapTap 云端。", "P4m' 存档说明（V90.9 新结构）"),
]

P1_OLD = '<body>\n<div id="phone"'
P2_OLD = "function render(){\n renderStatus();"
P3_OLD = "function persist(){\n if(!activeRole)return true;"
P6_OLD = "this.s.stats.bossWins++;"
P7_OLD = ("elapsedMinutes:Math.max(0,this.s.minutes-420),remainingLifeMinutes:this.s.life.left,"
          "defeats:this.s.life.losses};")

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
P6_NEW = (P6_OLD +
          "try{if(window.QTap&&QTap.achievements&&QTap.achievements.unlockBoss)"
          "QTap.achievements.unlockBoss(this.s.stats.bossWins);}catch(__qtapA){}")
P7_NEW = (P7_OLD +
          "try{if(window.QTap&&QTap.leaderboard&&QTap.leaderboard.submitAscension)"
          "QTap.leaderboard.submitAscension(this.s.ascensionRecord).catch(function(__qtapS){});}catch(__qtapS2){}")


def sha(b):
    return hashlib.sha256(b).hexdigest().upper()


def main():
    log("V90.10 -> TapTap 版体（完整补丁集）构建开始\n")
    if not BASE.exists():
        die(f"缺少基线：{BASE}")
    if not ADAPTER.exists():
        die(f"缺少适配层：{ADAPTER}")

    raw = BASE.read_bytes()
    if sha(raw) != BASE_SHA:
        die(f"基线哈希不符：{sha(raw)}")
    log(f"  [OK]   基线校验 {len(raw):,} B")

    text = raw.decode("utf-8").replace("\r\n", "\n")
    adapter = ADAPTER.read_text(encoding="utf-8")
    for needle in (AD_SPACE_ID, LB_POWER, LB_SPEEDRUN):
        if needle not in adapter:
            die(f"适配层缺少已配置的 ID：{needle}")
    log("  [OK]   适配层含广告位/战力榜/速通榜客户端 ID")

    # ---- P1 ----
    text = rep1(text, P1_OLD,
                '<body>\n<script>\n' + adapter + '\n</script>\n<div id="phone"',
                "P1 注入 QTAP 适配层")
    # ---- P2 / P3 ----
    text = rep1(text, P2_OLD, P2_NEW, "P2 render 状态桥")
    text = rep1(text, P3_OLD, P3_NEW, "P3 persist 存档节拍")
    # ---- P4 ----
    # V90.9 专用文案必须先执行，否则会被 v907 的短锚点先吃掉，产生"领取观看…领取"这类病句
    for old, new, label in COPY_V910:
        text = rep1(text, old, new, label, required=False)
    for old, new, label in COPY_V907:
        text = rep1(text, old, new, label, required=False)
    # ---- P5 版本校验 ----
    if "subtitle='人妖异途 · V90.10'" not in text:
        die("P5 版本标识不是 V90.10")
    applied.append("P5 版本标识校验通过：人妖异途 · V90.10")
    log("  [OK]   P5 版本标识 V90.10")
    # ---- P6 / P7 ----
    text = rep1(text, P6_OLD, P6_NEW, "P6 首领击败成就钩子")
    text = rep1(text, P7_OLD, P7_NEW, "P7 飞升速通榜上报")

    # ---- 构建码 ----
    text = rep1(text, "<head>",
                '<head>\n<script>window.__SHANYE_BUILD_CODE="PENDING";</script>', "注入构建码占位")

    # 固定长度占位 -> 算哈希 -> 等长替换，保证测试码可复现且与包体内嵌值一致
    HOLD = "SHANYE-V910-TT-XXXXXXXX"
    if '"PENDING"' not in text:
        die("构建码占位未被注入")
    text = text.replace('"PENDING"', '"' + HOLD + '"', 1)
    out = text.replace("\n", "\r\n").encode("utf-8")
    out_sha = sha(out)
    build_code = "SHANYE-V910-TT-" + out_sha[:8]
    if len(build_code) != len(HOLD):
        die("测试码长度与占位符不一致，等长替换会破坏哈希")
    text = text.replace(HOLD, build_code, 1)
    out = text.replace("\n", "\r\n").encode("utf-8")
    if '"PENDING"' in out.decode("utf-8"):
        die("构建码替换失败")
    if build_code not in out.decode("utf-8"):
        die("构建码未进入包体")

    # ---- 产物断言 ----
    f = out.decode("utf-8")
    for a in ["birth-ad", "birth-jade-ad", "ad-life", "ad-life-confirm"]:
        if f'data-a="{a}"' not in f:
            die("产物丢失广告入口：" + a)
    for needle, what in [(AD_SPACE_ID, "广告位 ID"), (LB_POWER, "战力榜 ID"),
                         (LB_SPEEDRUN, "速通榜 ID"), ("__QTAP_STATE", "状态桥"),
                         ("__QTAP_NOTIFY", "notify 桥"), ("QTap.achievements.unlockBoss", "成就钩子"),
                         ("QTap.leaderboard.submitAscension", "速通榜钩子"),
                         ("qtap-cloud-line", "云端状态行"), ("qtap-troubleshoot", "存档排障区")]:
        if needle not in f:
            die("产物缺少：" + what)
    if "进度自动保存并同步到 TapTap 云端" not in f:
        die("云存档文案未替换")
    applied.append("产物断言：广告入口 4 项 + 广告位/战力榜/速通榜 ID + 桥与钩子 + 云端 UI")
    log("  [OK]   产物断言全部通过")

    # ---- 写出 ----
    OUTDIR.mkdir(parents=True, exist_ok=True)
    (OUTDIR / "index.html").write_bytes(out)

    selftest = (ROOT / "tools" / "templates" / "taptap-selftest.html").read_text(encoding="utf-8")
    (OUTDIR / "selftest.html").write_text(
        selftest.replace("__BUILD_CODE__", build_code).replace("__VERSION__", "V90.10"), encoding="utf-8")

    manifest = {
        "version": "V90.10",
        "source": BASE.name,
        "sourceSha256": BASE_SHA,
        "adapter": str(ADAPTER),
        "adapterBytes": ADAPTER.stat().st_size,
        "outputSha256": out_sha,
        "outputBytes": len(out),
        "buildCode": build_code,
        "ids": {"ads": AD_SPACE_ID, "leaderboardPower": LB_POWER, "leaderboardSpeedrun": LB_SPEEDRUN},
        "applied": applied,
        "skipped": skipped,
    }
    (OUTDIR / "build-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    (OUTDIR / "README.md").write_text(
        (ROOT / "tools" / "templates" / "taptap-readme.md").read_text(encoding="utf-8")
        .replace("__BUILD_CODE__", build_code).replace("__SKIPPED__", "、".join(skipped) or "无"),
        encoding="utf-8")

    # ---- 打包（单文件夹结构）----
    if ZIP.exists():
        ZIP.unlink()
    with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED) as z:
        for p in sorted(OUTDIR.rglob("*")):
            if p.is_file():
                z.write(p, (Path("shanhe-v910-taptap") / p.relative_to(OUTDIR)).as_posix())

    log("\n--- 完成 ---")
    log(f"  目录      : {OUTDIR}")
    log(f"  index.html: {len(out):,} B  SHA256 {out_sha}")
    log(f"  ZIP       : {ZIP}  {ZIP.stat().st_size:,} B")
    log(f"  ZIP SHA   : {sha(ZIP.read_bytes())}")
    log(f"  测试码    : {build_code}")
    log(f"  已应用 {len(applied)} 项 / 跳过 {len(skipped)} 项")
    for s in skipped:
        log(f"    跳过：{s}")


if __name__ == "__main__":
    main()
