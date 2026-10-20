#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成山野修仙记 V90.27 本地交付包（P2-3）。

设计原则（沿用 V90.9 交付包的做法）：**证据由脚本实际运行测试后写入，不手工填写通过状态。**
每条命令的退出码 + 原始输出都会落到 `04-报告/`，失败即整体失败。

产物：../山野修仙记_V90.27_交付包.zip（单根目录 shanhe-v927-delivery/）
"""
from __future__ import annotations

import hashlib
import re
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def detect_version() -> tuple[str, str]:
    """从 index.html 标题读版本号，并找到对应的试玩目录 / TapTap 构建目录。"""
    html = (ROOT / "index.html").read_text(encoding="utf-8", errors="replace")
    version = re.search(r"<title>[^<]*?(V\d+\.\d+)", html).group(1)
    tag = version.split(".")[1]           # V90.28 → 28 → v928
    return version, f"v9{tag}" if len(tag) == 2 else f"v{tag}"


VERSION, TAG = detect_version()
_digits = "".join(c for c in VERSION if c.isdigit())      # 9028
_stage_tag = f"v{_digits[0]}{_digits[-2:]}"               # v928（不是 v028）
STAGE = ROOT / "delivery" / f"shanhe-{_stage_tag}-delivery"
ZIP_PATH = ROOT.parent / f"山野修仙记_{VERSION}_交付包.zip"
_play = sorted((ROOT / "play").glob(f"jindan-{_stage_tag}"))
PLAY = _play[0].name if _play else sorted((ROOT / "play").glob("jindan-v*"))[-1].name

R_GAME = STAGE / "01-游戏"
R_BUILD = STAGE / "02-构建"
R_TEST = STAGE / "03-测试"
R_REPORT = STAGE / "04-报告"
R_SHOT = STAGE / "05-截图"


def sha(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest().upper()


def sha_file(p: Path) -> str:
    return sha(p.read_bytes())


def run(cmd, out_name: str, note: str) -> tuple[bool, str]:
    """跑一条验收命令，原始输出落盘；返回 (是否成功, 原始输出)。"""
    p = subprocess.run(cmd, cwd=str(ROOT), capture_output=True, text=True,
                       encoding="utf-8", errors="replace", timeout=1800)
    body = (p.stdout or "") + (p.stderr or "")
    ok = p.returncode == 0
    R_REPORT.mkdir(parents=True, exist_ok=True)
    (R_REPORT / out_name).write_text(
        f"$ {' '.join(cmd)}\n# {note}\n# 退出码 {p.returncode} → {'PASS' if ok else 'FAIL'}\n\n{body}",
        encoding="utf-8")
    print(f"  {'PASS' if ok else 'FAIL'}  {note}  → 04-报告/{out_name}")
    return ok, body


def put(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    if src.is_dir():
        for f in sorted(src.rglob("*")):
            if f.is_file():
                t = dst / f.relative_to(src)
                t.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(f, t)
    else:
        shutil.copy2(src, dst)


def main() -> None:
    if STAGE.exists():
        shutil.rmtree(STAGE)
    for d in (R_GAME, R_BUILD, R_TEST, R_REPORT, R_SHOT):
        d.mkdir(parents=True, exist_ok=True)

    release = next(p for p in sorted((ROOT / "releases").glob("*.html")) if f"_{VERSION}_" in p.name)
    index = ROOT / "index.html"
    print(f"交付包构建：{VERSION}\n  发布文件 {release.name}  {release.stat().st_size:,} B")

    # ---------- 01 游戏 ----------
    put(release, R_GAME / release.name)
    put(index, R_GAME / "index.html")
    taptap = ROOT / "taptap-build" / f"shanhe-{TAG}-taptap"
    if taptap.exists():
        put(taptap, R_GAME / "TapTap候选包")
    qr = ROOT / "visual" / f"taptap-{_stage_tag}-selftest-qr.png"
    if qr.exists():
        put(qr, R_SHOT / "selftest-qr.png")

    # ---------- 02 构建 ----------
    for p in sorted((ROOT / "tools").glob("build_v9*_from_main.py")):
        put(p, R_BUILD / p.name)
    for name in (f"build_taptap_{_stage_tag}.py", "check_entry_consistency.py", "mk_taptap_zip.cjs",
                 "mk_play_page.cjs", "audit_gear_sources.cjs", "verify_delivery.py"):
        p = ROOT / "tools" / name
        if p.exists():
            put(p, R_BUILD / name)
    if (ROOT / "tools" / "templates").is_dir():
        put(ROOT / "tools" / "templates", R_BUILD / "templates")

    # ---------- 03 测试 ----------
    for p in sorted((ROOT / "tests").glob("v9*.cjs")):
        put(p, R_TEST / p.name)
    for name in ("run_full_regression.cjs", "syntax_check.cjs", "browser_responsive.py",
                 "v908-character-gear-layout.test.cjs"):
        p = ROOT / "tests" / name
        if p.exists():
            put(p, R_TEST / name)

    # ---------- 04 截图（先拷，报告最后写） ----------
    for src, dst in ((f"visual/{TAG}-narrow", "窄屏320-360"),
                     ("visual/v928-camp", "洞府面板"),
                     ("visual/v924-browser", "六视口"),
                     ("visual/v919", "评价与加群")):
        p = ROOT / src
        if p.exists():
            put(p, R_SHOT / dst)

    # ---------- 05 实际跑验收 ----------
    print("\n  实跑验收（输出即证据）：")
    results = []
    bodies = {}
    for key, cmd, out_name, note in [
        ("entry", [sys.executable, "tools/check_entry_consistency.py"],
         "00-入口一致性.txt", "入口/发布文件/构建器一致"),
        ("rebuild", [sys.executable, "tools/check_entry_consistency.py", "--rebuild"],
         "01-可复现重建.txt", "从冻结基线重建，产物字节一致"),
        ("syntax", ["node", "tests/syntax_check.cjs"],
         "02-语法与自包含.txt", "10 个 script 块语法 + 无外链"),
        ("full", ["node", "tests/run_full_regression.cjs", PLAY],
         "03-全量回归.txt", "全量回归（16 层，含界面层）"),
        ("matrix", ["node", "tests/v915_widths_matrix.cjs", PLAY],
         "04-三宽度矩阵.txt", "8 面板 × 3 宽度（320 允许滚动只标注）"),
        ("browser", [sys.executable, "tests/browser_responsive.py"],
         "05-浏览器6视口.txt", "Chromium 6 视口布局 + 截图"),
        ("taptap", ["node", "tests/v927_taptap_build.cjs"],
         "06-TapTap包体自测.txt", "适配包 17 项（QTAP/构建码/玩法标记/冷启动）"),
    ]:
        ok, body = run(cmd, out_name, note)
        results.append(ok)
        bodies[key] = body

    # 三宽度矩阵的已知红项：只有 360 档洞府（结构性，需产品决策），不算回归
    matrix_body = bodies.get("matrix", "")
    flagged = [seg for line in matrix_body.splitlines() for seg in line.split() if seg.endswith("!")]
    # 三宽度矩阵的已知红项：**只有** 360 档洞府（结构性，需产品决策），不算回归。
    # 必须精确匹配一条：让浏览器起不来之类的问题不会被这张白名单吞掉。
    known_matrix = (not results[4]) and len(flagged) == 1 and "洞府" in flagged[0] \
        and "fetch failed" not in matrix_body
    camp360 = camp390 = "未知"
    for line in matrix_body.splitlines():
        if line.strip().startswith("360x640"):
            m = re.search(r"洞府:([0-9.]+)", line)
            camp360 = m.group(1) if m else camp360
        if line.strip().startswith("390x844"):
            m = re.search(r"洞府:([0-9.]+)", line)
            camp390 = m.group(1) if m else camp390
    if known_matrix:
        print(f"  KNOWN  三宽度矩阵：唯一红项是 360 档洞府 {camp360} 屏（结构性，见 docs §7.5）")

    br = ROOT / "artifacts" / "browser-responsive" / "results.json"
    if br.exists():
        shutil.copy2(br, R_REPORT / "05-浏览器6视口-results.json")
    manifest = taptap / "build-manifest.json" if taptap.exists() else None
    if manifest and manifest.exists():
        shutil.copy2(manifest, R_REPORT / "07-TapTap包体manifest.json")

    # ---------- 06 交付说明 ----------
    html = index.read_bytes()
    rel_bytes = release.read_bytes()
    taptap_html = taptap / "index.html"
    taptap_sha = sha_file(taptap_html) if taptap_html.exists() else "（未构建 TapTap 包）"
    taptap_size = taptap_html.stat().st_size if taptap_html.exists() else 0
    codes = []
    for i, r in enumerate(results):
        codes.append("PASS" if r else (f"KNOWN（洞府 360 {camp360}，结构性）" if i == 4 and known_matrix else "FAIL"))
    readme = f"""# 山野修仙记 {VERSION} · 本地交付包

## 是什么

一个**双击就能玩**的单文件 H5 文字修仙游戏（离线、无外链），外加它的完整构建链、验收脚本与实测报告。
本交付包里的每个"通过"都是脚本在打包时**实际跑出来**的，原始输出在同目录 `04-报告/`。

## 30 秒上手

1. 双击 `01-游戏/{release.name}`。
2. 只想发给朋友：发这一个 HTML 就够。
3. 想核实与仓库一致：看 `SHA256SUMS.txt`。

## 目录

| 目录 | 内容 |
|---|---|
| `01-游戏/` | 独立 HTML（＝仓库 `index.html`，字节一致）+ TapTap 候选包（含自测页与构建清单） |
| `02-构建/` | 版本链构建器 `build_v9NN_from_main.py`、TapTap 构建器、入口一致性校验、ZIP/试玩页工具 |
| `03-测试/` | 全部验收脚本（引擎回归、界面矩阵、浏览器、设置动作、轮回玉、境界、装备经济、TapTap 包体） |
| `04-报告/` | 上面脚本的真实输出 + 浏览器 results.json + TapTap 包体清单 |
| `05-截图/` | 320/360 窄屏、六视口浏览器图、评价入口、自测二维码 |

## 哈希

| 产物 | 字节 | SHA256 |
|---|---:|---|
| 独立 HTML（发布文件） | {len(rel_bytes):,} | `{sha(rel_bytes)}` |
| index.html（仓库入口） | {len(html):,} | `{sha(html)}` |
| TapTap 候选包 index.html | {taptap_size:,} | `{taptap_sha}` |

前两者字节一致（`00-入口一致性.txt` 会验证）；`01-可复现重建.txt` 验证"同输入重建出同字节"。

## 本次实跑结果

{chr(10).join(f'- {c}  {d}' for c, d in zip(codes, [
    "入口一致性", "可复现重建", "语法与自包含", "全量回归（16 层）", "三宽度矩阵", "浏览器 6 视口", "TapTap 包体自测"]))}

> 说明：三宽度矩阵会把 **320×568 标 `~`（规范允许滚动）**，只有 360 以上超 1.02 屏才判红；
> 目前唯一红项是 360 档的洞府（{camp360} 屏，390 档已是 {camp390}），原因与三个可选方案见 `04-报告/04-三宽度矩阵.txt` 与仓库 `docs/交接文档.md §7.5`。

## 存档说明与迁移

- 存档在浏览器 **localStorage**，键名前缀 `qinglan-wendao-v14`，人族/妖族 × 100 档各一份；
  另有 `-legacy-v1`（轮回账本）、`-jadead`（轮回玉每档一次标记）等旁路键。
- 同浏览器刷新、关闭重开、覆盖新版 HTML：**都不会丢档**，键名与结构向后兼容。
- 换浏览器 / 换设备 / 换域名 / 换 H5 容器：localStorage 不共享。先在 设置 → 存档与备份 →
  「导出存档」拿 JSON，在新环境「导入存档」。
- 飞升或身死只影响当前档位；轮回玉与轮回升级是本机账本（随导出 JSON 一起走）。
- 平台上运行时（TapTap 候选包）额外接云存档：登录同一账号换设备可续玩，但**本地 JSON 导出仍是最终兜底**。

## 已知未达标 / 未上线

1. **360×640 洞府 {camp360} 屏**（390×844 已收敛到 {camp390}）：设施网格单项约 407px ≈ 可视区 413px；压到 1.02 需要砍字或把设施列表移出本体，
   与"不裁文字 / 本体不拆"冲突，待产品决策。其余面板 360 档均为 1.00 屏。
2. **线上仍是 V90.16**：TapTap 平台版本 `V-20261019 = 已上线`；`V90.27` 候选包（h5VersionId 334595）
   已上传但**未绑定主包位、未提交审核**。自测码 `05-截图/selftest-qr.png`，包内测试码 `SHANYE-V927-TT-4320C8E5`。
3. 排行榜、云存档、激励视频只在 TapTap 容器内真实生效；本地打开时适配层降级为 MOCK（`06-TapTap包体自测.txt` 有证据）。
"""
    (STAGE / "README.md").write_text(readme, encoding="utf-8")

    # ---------- 07 校验和 + 打包 ----------
    lines = []
    for p in sorted(STAGE.rglob("*")):
        if p.is_file() and p.name != "SHA256SUMS.txt":
            lines.append(f"{sha_file(p)}  {p.relative_to(STAGE).as_posix()}")
    (STAGE / "SHA256SUMS.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")

    if ZIP_PATH.exists():
        ZIP_PATH.unlink()
    with zipfile.ZipFile(ZIP_PATH, "w", zipfile.ZIP_DEFLATED) as z:
        for p in sorted(STAGE.rglob("*")):
            if p.is_file():
                z.write(p, (Path(STAGE.name) / p.relative_to(STAGE)).as_posix())

    files = [p for p in STAGE.rglob("*") if p.is_file()]
    print(f"\n  目录 : {STAGE}（{len(files)} 个文件，{sum(p.stat().st_size for p in files):,} B）")
    print(f"  ZIP  : {ZIP_PATH.name}  {ZIP_PATH.stat().st_size:,} B")
    print(f"  SHA  : {sha(ZIP_PATH.read_bytes())}")
    unexpected = [i for i, r in enumerate(results) if not r and not (i == 4 and known_matrix)]
    if unexpected:
        print(f"\n  警告：{len(unexpected)} 项验收失败（见 04-报告/），交付包已生成但不能当作「全部通过」使用")
        sys.exit(1)
    print("\n  全部验收通过" + (f"（三宽度矩阵含 1 项已知未达标：洞府 360 {camp360} 屏）" if known_matrix else ""))


if __name__ == "__main__":
    main()
