#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
山野修仙记 V90.80 -> TapTap H5 版体（完整移植 v907 适配线的补丁集）

基线：V90.80 发布文件（灵息辟谷）（字节哈希校验）
补丁：P1 适配层注入 / P2 render 状态桥 / P3 persist 存档节拍 /
      P4a-P4n 广告与云端文案 / P5 版本校验 / P6 首领成就 / P7 飞升速通榜
产物：taptap-build/shanhe-v968-taptap/ 与上传 ZIP

与 v907 的差异：
  - 文案锚点逐条按 V90.80 实际命中处理；V90.9 之后设置页/图鉴/主线都重构过，部分旧锚点已不存在，
    这些条目会被记为 SKIP 并单独列出来，不静默跳过。
  - 广告位 / 战力榜 / 速通榜 ID 沿用 v907 已验证的客户端 ID。
"""
import hashlib
import json
import re
import zipfile
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "releases" / "山野修仙记_V90.80_方正纸墨.html"
ADAPTER = Path(os.environ["TAPTAP_ADAPTER_PATH"]) if "TAPTAP_ADAPTER_PATH" in os.environ else ROOT.parent / "shanhe-v907" / "taptap" / "taptap-adapter.js"
GUARD = ROOT / "platform" / "taptap-difficulty-ranks-v964.js"
OUTDIR = ROOT / "taptap-build" / "shanhe-v980-taptap"
ZIP = ROOT.parent / "山野修仙记_V90.80_TapTap上传包.zip"

BASE_SHA = "3351E8A8509C60A4506BBA1DEC954DAE5C96B2ABCC1B36AD530C33BBEEC057D6"

# v907 已验证的客户端 ID（适配层 CONFIG 内已含，这里用于产物断言）
AD_SPACE_ID = "1054324"
LB_POWER = "a7m6yjlef2giizektn"
LB_SPEEDRUN = "89uvqr12t55efn1ff6"

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
COPY_V916 = [
    ("领取无真实广告、无网络请求、不消耗轮回玉。", "观看激励视频领取，不消耗轮回玉。", "P4f' 设置页说明（V90.9 新结构）"),
    ("外部 JSON 仍可手动回档。", "进度自动保存并同步到 TapTap 云端。", "P4l' 存档口径（V90.9 新结构）"),
    ("进度保存在本机浏览器。", "进度自动保存并同步到 TapTap 云端。", "P4m' 存档说明（V90.9 新结构）"),
]

P1_OLD = '<body>\n<div id="phone"'
P2_OLD = "function render(){\n if(game.s.combat){mapOpen=false;travelOpen=false;panel=null;} renderStatus();"
P3_OLD = "function persist(){\n if(!activeRole)return true;"
P6_OLD = "this.s.stats.bossWins++;"
P7_OLD = ("elapsedMinutes:Math.max(0,this.s.minutes-420),remainingLifeMinutes:this.s.life.left,"
          "defeats:this.s.life.losses,difficulty:this.s.difficulty};")

P2_NEW = (
    "function render(){\n"
    " try{window.__QTAP_STATE={role:activeRole,slot:activeSlot,game:game,"
    "power:(function(){try{return QCombatRating.live(game).total||0}catch(__qtapP){return 0}})()};"
    "window.__QTAP_NOTIFY=notify;try{window.QTap?.rankDifficulty?.sync()}catch(__rank){} }catch(__qtapE){}\n"
    " renderStatus();"
)
P3_NEW = (
    "function persist(){\n"
    " try{window.__QTAP_STATE={role:activeRole,slot:activeSlot,game:game,"
    "power:(function(){try{return QCombatRating.live(game).total||0}catch(__qtapP){return 0}})()};"
    "window.__QTAP_SAVE_TICK=(window.__QTAP_SAVE_TICK||0)+1;try{window.QTap?.rankDifficulty?.sync()}catch(__rank){} }catch(__qtapE){}\n"
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
    log("V90.80 -> TapTap 版体（完整补丁集）构建开始\n")
    if not BASE.exists():
        die(f"缺少基线：{BASE}")
    if not ADAPTER.exists():
        die(f"缺少适配层：{ADAPTER}")
    if not GUARD.exists():
        die(f"缺少难度榜保护器：{GUARD}")

    raw = BASE.read_bytes()
    # 基线哈希按 CRLF 归一（GitHub runner 是 LF 检出，否则会假红）
    norm = raw.replace(b"\r\n", b"\n").replace(b"\n", b"\r\n")
    if sha(norm) != BASE_SHA:
        die(f"基线哈希不符：{sha(norm)}")
    log(f"  [OK]   基线校验 {len(raw):,} B")

    text = raw.decode("utf-8").replace("\r\n", "\n")
    eol = "\r\n" if b"\r\n" in raw[:4000] else "\n"
    adapter = ADAPTER.read_text(encoding="utf-8")
    # ---- V90.80：飞升速通榜改为整数游戏年（scoreScale 100 → 1）----
    if "scoreScale: 100" not in adapter:
        die("适配层 scoreScale 改写失败，无法改为整数年")
    adapter = adapter.replace("scoreScale: 100", "scoreScale: 1")
    adapter = adapter.replace("分数 = 耗寿年 × 100", "分数 = 耗寿年 × 10（354 = 35.4 年）")
    adapter = adapter.replace("→ 3506 = 35.06 年", "→ 354 = 耗寿 35.4 年")
    adapter = adapter.replace("速通榜已打开（分数 ÷ 100 = 耗寿年数）", "速通榜已打开（分数 ÷ 10 = 耗寿年数，越小越好）")
    if "scoreScale: 1" not in adapter or "scoreScale: 100" in adapter:
        die("整数年改写失败")
    log("  [OK]   飞升速通榜改为整数年（scoreScale=1, floor）")

    # ---- V90.80：挑战速通榜换到带「（年）」单位的新榜 ----
    _old_lb = "v0jbfn60tgtdlysic0"
    _new_lb = "89uvqr12t55efn1ff6"
    if _old_lb not in adapter:
        die("适配层缺少上一版挑战速通榜 ID")
    adapter = adapter.replace(_old_lb, _new_lb)
    if _old_lb in adapter:
        die("旧挑战速通榜 ID 仍残留")
    log("  [OK]   挑战速通榜 ID 已换新：" + _new_lb)

    # ---- V90.80：分数向下取整（年），并换到带单位的榜 ----
    if "Math.round(lifeMinutes / cfg.yearMinutes * cfg.scoreScale)" not in adapter:
        die("适配层取整表达式未找到")
    adapter = adapter.replace("Math.round(lifeMinutes / cfg.yearMinutes * cfg.scoreScale)",
                              "Math.floor(lifeMinutes / cfg.yearMinutes * cfg.scoreScale)")
    adapter = adapter.replace("分数 = 耗寿年 × 10", "分数 = 耗寿年（向下取整）")
    adapter = adapter.replace("→ 354 = 耗寿 35.4 年", "→ 35 = 耗寿 35 年")
    adapter = adapter.replace("速通榜已打开（分数 ÷ 10 = 耗寿年数，越小越好）",
                              "速通榜已打开（数字即耗寿年数，越小越好）")

    # ---- V90.80：云存档恢复前，先把本机快照写入备份键 ----
    ap_old = "  function applyPayload(payload) {\n    var keys = payload && payload.keys;\n    if (!keys) throw new Error('云存档内容无法识别');"
    ap_new = ("  function applyPayload(payload) {\n"
              "    var keys = payload && payload.keys;\n"
              "    if (!keys) throw new Error('云存档内容无法识别');\n"
              "    /* V90.80 pre-restore backup */\n"
              "    try {\n"
              "      var _pre = collectPayload();\n"
              "      if (_pre && _pre.count) {\n"
              "        globalThis.localStorage.setItem('qinglan-wendao-v14-presync-backup',\n"
              "          JSON.stringify({ v: 1, reason: 'before-cloud-restore', ts: Date.now(), count: _pre.count, keys: _pre.keys }));\n"
              "        log('pre-restore backup written (' + _pre.count + ' keys)');\n"
              "      }\n"
              "    } catch (e) { log('pre-restore backup failed', e); }")
    if ap_old not in adapter:
        die("适配层 applyPayload 锚点未找到")
    adapter = adapter.replace(ap_old, ap_new, 1)
    if "pre-restore backup written" not in adapter:
        die("云恢复前备份注入失败")
    log("  [OK]   云存档恢复前备份已注入")
    for needle in (AD_SPACE_ID, LB_POWER, LB_SPEEDRUN):
        if needle not in adapter:
            die(f"适配层缺少已配置的 ID：{needle}")
    log("  [OK]   适配层含广告位/战力榜/速通榜客户端 ID")

    # ---- P1. Platform difficulty split runs immediately after QTap adapter. ----
    standard_ids = {
        "power": os.environ.get("TAPTAP_STANDARD_POWER_ID", "").strip(),
        "speedrun": os.environ.get("TAPTAP_STANDARD_SPEEDRUN_ID", "").strip(),
    }
    for field in ("power", "speedrun"):
        if standard_ids[field] in (LB_POWER, LB_SPEEDRUN) and standard_ids[field]:
            die("标准模式榜单 ID 不得与任何挑战榜 ID 相同")
    guard = GUARD.read_text(encoding="utf-8")
    if "q.rankDifficulty" not in guard or "auto.enabled=false" not in guard:
        die("难度榜拦截器缺少内部自动上报保护")
    standard_setup = "window.__SHANYE_STANDARD_BOARD_IDS=" + json.dumps(standard_ids, ensure_ascii=False, separators=(',', ':')) + ";"
    rank_section = "\n" + standard_setup + "\n" + guard
    text = rep1(text, P1_OLD,
                '<body>\n<script>\n' + adapter + rank_section + '\n</script>\n<div id="phone"',
                "P1 注入 QTAP 适配层与三档难度榜保护器")
    applied.append("三档难度榜保护器")

    # ---- P2 / P3 ----
    # V90.38：寿尽救援按钮也要真播广告（否则玩家能白拿 15 年）
    text = rep1(text,
                "    'ad-life-confirm': '10 年寿元'\n  };",
                "    'ad-life-confirm': '10 年寿元',\n    'ad-life-rescue': '15 年寿元'\n  };",
                "P4m 寿尽救援广告拦截")
    text = rep1(text, P2_OLD, P2_NEW, "P2 render 状态桥")
    text = rep1(text, P3_OLD, P3_NEW, "P3 persist 存档节拍")
    # ---- P4 ----
    # V90.9 专用文案必须先执行，否则会被 v907 的短锚点先吃掉，产生"领取观看…领取"这类病句
    for old, new, label in COPY_V916:
        text = rep1(text, old, new, label, required=False)
    for old, new, label in COPY_V907:
        text = rep1(text, old, new, label, required=False)
    # ---- P5 版本校验 ----
    if "subtitle='洞府百业 · V90.80'" not in text:
        die("P5 版本标识不是 V90.80")
    applied.append("P5 版本标识校验通过：洞府百业 · V90.80")
    log("  [OK]   P5 版本标识 V90.80（灵息辟谷）")
    # ---- P8 斗法中硬性拒绝面板（docs：斗法即模态；适配层会延迟一次渲染，需显式拒绝）----
    PANEL_OLD = "if(game.s.combat&&!['help','settings','log','book'].includes(name)){notify('先结束斗法','warn');return;}"
    PANEL_NEW = "if(game.s.combat){notify('先结束斗法','warn');return;}"
    text = rep1(text, PANEL_OLD, PANEL_NEW, "P8 斗法中拒绝面板")
    # ---- P9 旧档兼容：缺 difficulty 字段不应阻断灵田归档（V90.80 阻断性缺陷）----
    P9_OLD = "if(old.race!==id||old.difficulty!==this.difficulty)throw Error('旧灵田归档身份不符');"
    P9_NEW = "if(old.race!==id||(old.difficulty!==undefined&&old.difficulty!==this.difficulty))throw Error('旧灵田归档身份不符');"
    text = rep1(text, P9_OLD, P9_NEW, "P9 旧档缺 difficulty 兼容")
    # ---- P6 / P7 ----
    text = rep1(text, P6_OLD, P6_NEW, "P6 首领击败成就钩子")
    text = rep1(text, P7_OLD, P7_NEW, "P7 飞升速通榜上报")

    # ---- 构建码 ----
    text = rep1(text, "<head>",
                '<head>\n<script>window.__SHANYE_BUILD_CODE="PENDING";</script>', "注入构建码占位")

    # 固定长度占位 -> 算哈希 -> 等长替换，保证测试码可复现且与包体内嵌值一致
    HOLD = "SHANYE-V980-TT-XXXXXXXX"
    if '"PENDING"' not in text:
        die("构建码占位未被注入")
    text = text.replace('"PENDING"', '"' + HOLD + '"', 1)
    out = text.replace("\n", eol).encode("utf-8")
    out_sha = sha(out)
    build_code = "SHANYE-V980-TT-" + out_sha[:8]
    if len(build_code) != len(HOLD):
        die("测试码长度与占位符不一致，等长替换会破坏哈希")
    text = text.replace(HOLD, build_code, 1)
    out = text.replace("\n", eol).encode("utf-8")
    if '"PENDING"' in out.decode("utf-8"):
        die("构建码替换失败")
    if build_code not in out.decode("utf-8"):
        die("构建码未进入包体")
    file_sha = sha(out)   # 写盘字节的真实哈希（与用于生成测试码的 out_sha 不同，必须分开记）

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
    # 玩法侧回归：适配层不得把 V90.23 的掉落规则 / V90.29 的可重复广告奖励改回去
    for needle, what in (("dropLoot(){", "首领器材掉落（V90.23）"),
                         ("if(boss)this.dropLoot();", "战斗不再掉成品（V90.23）"),
                         ("领取100轮回玉", "广告奖励单次 100（V90.29）"),
                         ("可重复领取", "可重复领取文案（V90.29）"),
                         ("轮回玉在本页直接用于本世加点", "轮回玉说明（V90.29）")):
        if needle not in f:
            die("产物缺少玩法标记：" + what)
    applied.append("产物断言：广告入口 4 项 + ID/桥/钩子/云端 UI + 玩法标记 5 项")
    if "rankDifficulty" not in f or "__SHANYE_STANDARD_BOARD_IDS" not in f:
        die("包体缺少三档难度上榜保护")
    log("  [OK]   产物断言全部通过")

    # ---- 写出 ----
    OUTDIR.mkdir(parents=True, exist_ok=True)
    (OUTDIR / "index.html").write_bytes(out)

    selftest = (ROOT / "tools" / "templates" / "taptap-selftest.html").read_text(encoding="utf-8")
    (OUTDIR / "selftest.html").write_text(
        selftest.replace("__BUILD_CODE__", build_code).replace("__VERSION__", "V90.80"), encoding="utf-8")

    manifest = {
        "version": "V90.80",
        "source": BASE.name,
        "sourceSha256": BASE_SHA,
        "adapter": str(ADAPTER),
        "adapterBytes": ADAPTER.stat().st_size,
        "adapterSha256": sha(ADAPTER.read_bytes()),
        "difficultyGuardSha256": sha(GUARD.read_bytes()),
        "difficulty": {"easy": 0.5, "standard": 0.8, "challenge": 1.0},
        "ranked": {"easy": False, "standard": True, "challenge": True},
        "onlineStandardBoardsConfigured": bool(standard_ids["power"] and standard_ids["speedrun"]),
        "standardLeaderboardIds": standard_ids,
        "outputSha256": file_sha,
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
                z.write(p, (Path("shanhe-v980-taptap") / p.relative_to(OUTDIR)).as_posix())

    log("\n--- 完成 ---")
    log(f"  目录      : {OUTDIR}")
    log(f"  index.html: {len(out):,} B  SHA256 {file_sha}")
    log(f"  ZIP       : {ZIP}  {ZIP.stat().st_size:,} B")
    log(f"  ZIP SHA   : {sha(ZIP.read_bytes())}")
    log(f"  测试码    : {build_code}")
    log(f"  已应用 {len(applied)} 项 / 跳过 {len(skipped)} 项")
    if not manifest["onlineStandardBoardsConfigured"]:
        log("  [BLOCKED] TapTap 标准模式独立榜单 ID 未配置；本机标准榜可用，平台标准榜禁止上报（不得正式上线）")
    for s in skipped:
        log(f"    跳过：{s}")


if __name__ == "__main__":
    main()


