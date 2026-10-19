#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成 SHANYE_V90.9_LOCAL_DELIVERY 交付目录与压缩包。

证据由脚本**实际运行**测试后记录，不手工填写通过状态。
"""
import difflib
import hashlib
import json
import os
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DELIV = ROOT.parent / "SHANYE_V90.9_LOCAL_DELIVERY"
ZIP_PATH = ROOT.parent / "山野修仙记_V90.9_本地完整交付包.zip"

GAME = "山野修仙记_V90.9_界面整合与境界指引优化版.html"
BASE = "山野修仙记_V90.8_五阶洞府与高阶炼制版.html"

D_GAME = DELIV / "01_游戏"
D_SRC = DELIV / "02_源码与构建"
D_EVID = DELIV / "03_测试证据"
D_DOC = DELIV / "04_说明"


def sh(cmd, cwd=ROOT, timeout=900):
    p = subprocess.run(cmd, cwd=str(cwd), capture_output=True, text=True,
                       encoding="utf-8", errors="replace", timeout=timeout)
    return p.returncode, (p.stdout or "") + (p.stderr or "")


def sha256(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest().upper()


def git_blob(p):
    b = p.read_bytes().decode("utf-8").replace("\r\n", "\n").encode("utf-8")
    return hashlib.sha1(b"blob " + str(len(b)).encode() + b"\0" + b).hexdigest()


def main():
    if DELIV.exists():
        shutil.rmtree(DELIV)
    for d in (D_GAME, D_SRC, D_EVID / "logs", D_EVID / "screenshots", D_EVID / "viewport-results", D_DOC):
        d.mkdir(parents=True, exist_ok=True)

    # ---------- 1. 游戏 ----------
    shutil.copy2(ROOT / GAME if (ROOT / GAME).exists() else ROOT / "releases" / GAME, D_GAME / GAME)
    game_html = D_GAME / GAME
    game_sha = sha256(game_html)
    game_blob = git_blob(game_html)
    print(f"游戏: {game_html}  {game_html.stat().st_size} B  sha256={game_sha[:16]}…")

    # ---------- 2. 源码与构建 ----------
    for f in sorted((ROOT / "tools").iterdir()):
        if f.is_file() and f.suffix in {".py", ".js", ".css"}:
            shutil.copy2(f, D_SRC / f.name)
    shutil.copy2(ROOT / "index.html", D_SRC / "index.html")
    for name in ("build_v908_from_main.py", "build_v909_from_main.py"):
        if (ROOT / "tools" / name).exists():
            pass
    # 相对 V90.8 的补丁
    a = (ROOT / "releases" / BASE).read_text(encoding="utf-8").splitlines(keepends=True)
    b = (ROOT / "releases" / GAME).read_text(encoding="utf-8").splitlines(keepends=True)
    diff = list(difflib.unified_diff(a, b, fromfile=BASE, tofile=GAME, n=3))
    (D_SRC / "V90.8_to_V90.9.diff").write_text("".join(diff), encoding="utf-8")
    print(f"补丁: {len(diff)} 行 diff")

    # Git bundle
    code, out = sh(["git", "bundle", "create", str(D_SRC / "shanhe-v909.bundle"), "HEAD"])
    print("git bundle:", code, out.strip()[:120])

    code, head = sh(["git", "rev-parse", "HEAD"])
    git_sha = head.strip()
    code, branch = sh(["git", "rev-parse", "--abbrev-ref", "HEAD"])
    branch = branch.strip()
    code, log = sh(["git", "log", "--oneline", "-5"])

    # ---------- 3. 测试证据 ----------
    tests = [
        ("syntax_check", ["node", "tests/syntax_check.cjs", "index.html"]),
        ("core_regression", ["node", "tests/run_v908_regression.cjs"]),
        ("progression", ["node", "tests/v909-progression.test.cjs"]),
        ("browser_responsive", ["node", "tests/v909_settings_browser.cjs"]),
    ]
    results = {}
    for name, cmd in tests:
        print(f"运行 {name} …", flush=True)
        try:
            rc, out = sh(cmd)
        except subprocess.TimeoutExpired:
            rc, out = 124, "TIMEOUT"
        (D_EVID / "logs" / f"{name}.log").write_text(out, encoding="utf-8")
        results[name] = {"exit": rc, "pass": rc == 0}
        print(f"  exit={rc}")

    # 视口结果与截图
    src_vis = ROOT / "visual" / "v909"
    if src_vis.exists():
        for f in src_vis.iterdir():
            if f.is_file() and f.suffix == ".png":
                shutil.copy2(f, D_EVID / "screenshots" / f.name)
            elif f.name == "results.json":
                shutil.copy2(f, D_EVID / "viewport-results" / "settings-browser-results.json")

    # Playwright 能力探测（诚实记录）
    pyrc, pyout = sh([sys.executable, "-c", "import playwright"], timeout=60)
    playwright_available = pyrc == 0

    summary = {
        "version": "V90.9",
        "git_sha": git_sha,
        "git_branch": branch,
        "game_html": GAME,
        "game_bytes": game_html.stat().st_size,
        "game_sha256": game_sha,
        "game_git_blob": game_blob,
        "base_version": "V90.8",
        "base_sha256": sha256(ROOT / "releases" / BASE),
        "base_untouched": sha256(ROOT / "releases" / BASE) ==
                          "5216A60E16912CAEFEBBC4FF2107AA4CD21A918E6A2DE366901F8282551E736A",
        "tests": results,
        "playwright_installed": playwright_available,
        "playwright_note": ("未安装 playwright，tests/v908_browser_responsive.py 的修复无法在本地实跑；"
                            "浏览器多视口覆盖由零依赖 CDP 脚本 v909_settings_browser.cjs 实际执行。"
                            if not playwright_available else "playwright 可用"),
        "not_tested": [
            "tests/v908_browser_responsive.py（Playwright）— 本地无 playwright 包，未执行",
            "Android Chrome 真机",
            "iOS Safari 真机",
        ],
    }
    (D_EVID / "test-summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

    # ---------- 4. 说明 ----------
    doc = f"""# 山野修仙记 V90.9 · 本地版本使用说明

## 一、这是什么

V90.9《界面整合与境界指引优化版》，单文件自包含 H5 游戏，双击即可用浏览器打开，
不依赖服务器、在线资源或额外源码目录。

- 文件：`01_游戏/{GAME}`
- 大小：{game_html.stat().st_size:,} 字节
- SHA-256：`{game_sha}`
- Git Blob：`{game_blob}`

## 二、本次新增与调整

### 1. 设置界面重新整合（任务 A）
由一条长页面改为六个独立卡片分区：
存档与备份 / 修行状态与寿元 / 角色与档案 / 视觉与体验 / 帮助与记录 / 重新修行。
寿元信息改为三行 KV；按钮统一 40px（短屏 36px）；窄屏单列、≥380px 双列；
「新开存档」独立为虚线危险卡片。原有 11 个按钮动作全部保留。

### 2. 阶段成长指引（任务 C）
新增只读呈现层 `tools/v909-progression.js`：
- 条件清单一次列出**全部**条件（问道坛、首领、等级、道行、道材、洞府、所在位置、专属试炼、饱腹饮水灵力），
  不再只显示第一个失败条件。
- 只给**一条**主操作（下一步），其余条件列在清单里。
- 材料来源由 `D.RES → D.RESOURCE_LAYOUT → D.ZONES.map` 真实推导，
  并区分随身与仓库数量；推不出就显示「详细来源见图鉴」，不虚构坐标。
- 接入三处：修炼面板、金丹雷劫页、元婴问心页。未新增重复的大型独立页面。

### 3. 金丹雷劫文案修复（任务 D）
移除写死的「结丹雷蛟已伏」。现按真实存档呈现六种状态：
问道坛未完成 / 问道坛完成但首领未击败 / 两者均完成但雷劫未启 / 雷劫进行中 / 三重已渡 / 全部完备。

### 4. 元婴问心与高阶境界（任务 E）
问心页复用同一套条件清单；`D.ASCENSION_STAGES` 驱动，第六至十二境一致。

## 三、与 V90.8 的区别

| 项 | V90.8 | V90.9 |
|---|---|---|
| 设置页 | 单列平铺 | 六分区卡片 |
| 突破条件 | 分散多处，只显示首个缺失 | 统一清单 + 单一主操作 |
| 雷劫首段 | 写死「结丹雷蛟已伏」 | 按真实存档六态生成 |
| 材料来源 | 需自行查阅 | 由配置表推导并给出采集时长/工具 |
| 浏览器测试 | `new_page(viewport=)` API 误用 | 已修复，视口矩阵扩到 6 档 |

游戏数值、突破难度、存档结构、寿元与续命机制、储物袋、飞升结算**均未改动**。

## 四、如何启动游戏

1. 直接双击 `01_游戏/{GAME}`，用 Chrome / Edge 打开。
2. 或拖入浏览器窗口。手机端可通过局域网静态服务器访问。

## 五、旧存档迁移（重要）

> ⚠️ 浏览器 localStorage 按**来源**隔离。直接打开新版 HTML 时，
> **不要假定旧文件存档会自动出现**——`file://` 与不同目录/端口会被视为不同来源。

正确做法：
1. 打开**旧版**（V90.8）→ 设置 → 存档与备份 → **导出存档**，得到 JSON 文件。
2. 打开**新版**（V90.9）→ 设置 → 存档与备份 → **导入存档**，选择该 JSON。
3. 导入后检查：档位、境界、道行、背包、洞府建筑、储物袋是否与旧版一致。

导出文件名：`山野修仙记_V90.9_本机飞升资质榜.json`（本机资质榜另存）。

## 六、已知限制

- **Playwright 测试未在本地执行**：本机无 `playwright` 包（网络受限无法安装）。
  `tests/v908_browser_responsive.py` 的 API 误用已修复，但**未实跑**，标记为 NOT TESTED。
  浏览器多视口覆盖改由零依赖 CDP 脚本实际执行（6 视口 51 项）。
- **未做真机验证**：Android Chrome / iOS Safari 均未测试，标记 NOT TESTED。
- 自动测试使用受控内存/浏览器存储，**不能代表真实手机长期存储**的持久性验收。
- 指引卡截图是「渲染夹具」，用游戏自身 CSS 渲染真实 `progGuide` 输出，
  **不是完整 H5 端到端截图**。
- 高境（第六至十二境）的突破流程只做了配置驱动的一致性校验与代码复用，
  未逐境做完整人工通关。

## 七、后续如何继续开发

```bash
# 1. 从冻结 V90.8 基线重建 V90.9（不会覆盖历史版本）
python tools/build_v909_from_main.py

# 2. 语法与自包含检查
node tests/syntax_check.cjs index.html

# 3. 六组核心回归
node tests/run_v908_regression.cjs

# 4. V90.9 指引与雷劫专项（121 断言）
node tests/v909-progression.test.cjs

# 5. 浏览器六视口验收（需要本机 Edge）
node tests/v909_settings_browser.cjs

# 6. 重新生成交付包
python tools/make_delivery.py
```

构建脚本对每一处替换都做唯一性断言，任何一处不符会立即中止、不产出文件。

## 八、Git

- 分支：`{branch}`
- 提交：`{git_sha}`
- 最近提交：
```
{log.strip()}
```
- Git bundle：`02_源码与构建/shanhe-v909.bundle`

**未推送到 GitHub，未部署到公网。**

## 九、校验

完整 SHA-256 清单见 `SHA256SUMS.txt`。
"""
    (D_DOC / "本地版本使用说明.md").write_text(doc, encoding="utf-8")

    # 失败与修复记录
    fixes = """# 本轮失败与修复记录

| # | 现象 | 判定 | 修复 |
|---|---|---|---|
| 1 | 构建中止：`冻结基线 Git Blob 不符 ae896fcf…` | 脚本错误 | `git hash-object` 会按 clean 过滤器存 LF；改为对 LF 归一化内容算 blob |
| 2 | `progRows` 断言失败：未完成项只有「三重雷劫」 | 测试错误 | 引擎在 `cleared=true` 时把 `ritual` 归一化为真，属既有规则；补 `cleared=false` 并新增归一化断言 |
| 3 | `TypeError: g2.progRows is not a function` | 测试错误 | `progRows` 在 vm 上下文里，不在 Game 实例上 |
| 4 | `Error: 种族记录不符` / `存档角色与当前分支不符` | 测试错误 | 构造妖族档须 `Game.fresh(seed,'demon')` 且 `new Game(s, seed, 'demon')` |
| 5 | 浏览器测试首批 5 项失败（主题 forest、动效、reset） | 测试错误 | `openPanel` 是开关式，重复点击会关闭面板；改为先判断再点。forest 为默认主题，body 无主题类是正确表现 |
| 6 | 截图被引导浮层遮挡 | 测试错误 | 入世后点击 `[data-a="guide"][data-mode="pause"]` 收起 |
| 7 | 夹具截图进程不退出 | 脚本缺陷 | 先 `ws.close()` 再 `send('Browser.close')` 导致悬空；改为直接 taskkill。PNG 已正常产出 |
| 8 | `V90.9` 出现次数断言 4 → 实际 6 | 断言写错 | CSS 注释也含版本号，修正为 6 并写明来源 |
"""
    (D_EVID / "失败与修复记录.md").write_text(fixes, encoding="utf-8")

    # ---------- 5. SHA256 清单 ----------
    lines = []
    for p in sorted(DELIV.rglob("*")):
        if p.is_file() and p.name != "SHA256SUMS.txt":
            lines.append(f"{sha256(p)}  {p.relative_to(DELIV).as_posix()}")
    (DELIV / "SHA256SUMS.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")

    # ---------- 6. 打包 ----------
    if ZIP_PATH.exists():
        ZIP_PATH.unlink()
    with zipfile.ZipFile(ZIP_PATH, "w", zipfile.ZIP_DEFLATED) as z:
        for p in sorted(DELIV.rglob("*")):
            if p.is_file():
                arc = (Path(DELIV.name) / p.relative_to(DELIV)).as_posix()
                z.write(p, arc)
    zsha = sha256(ZIP_PATH)
    print(f"\n交付目录: {DELIV}")
    print(f"压缩包  : {ZIP_PATH}  {ZIP_PATH.stat().st_size:,} B")
    print(f"ZIP SHA : {zsha}")
    print(f"GIT     : {git_sha}")
    print(f"GAME SHA: {game_sha}")
    return 0 if all(v["pass"] for v in results.values()) else 1


if __name__ == "__main__":
    sys.exit(main())
