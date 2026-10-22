# 山野修仙记 V90.57｜渡劫主线修复与终劫闭环

**交付性质：本地离线修复候选版（H5）。非 APK；未提交 GitHub，未提交 TapTap 审核或发布。**

## 最快体验

- 直接打开 `index.html`，或打开 `releases/山野修仙记_V90.57_渡劫主线修复与终劫闭环.html`。
- 游戏为无远程依赖的单文件 HTML，现代手机、桌面浏览器可直接预览。由于本次容器限制，`file://` 双击直开的真实浏览器导航以及 Android/iOS/TapTap 容器仍需在设备侧复核。
- 不要覆盖自己原先唯一的游戏文件。旧 HTML 与旧存档先备份；更新前从旧版【设置】导出 JSON。**V90.43 起采用旧档重置＋轮回玉阶梯补偿，不是无损升级。**跨路径、本地文件或不同浏览器时，存储不自动共享。

## 改动内容（全部基于上传的 V90.56 原始完整包）

1. 修正 `s.stageIndex` 误用为不存在的状态字段引发的圆满假阻断。界面使用引擎 `game.stageIndex`。
2. 新增只读 `tribPreview(final)`：固定损伤、饥渴/耗灵随时间伤害、药丹减伤、下一境血上限统一计算。
3. `breakthrough()` 从**实际当前剩余气血**扣伤害，预告百分比与最终结果一致；失败不消耗药丹与升级资源。
4. 36 段圆满通过 `ascend()` 承受第 12 次 **24,200 基础固定伤害**，护劫丹每颗减 15%、最多 2 颗；通过后扣原飞升材料一次、沿原有规则恢复满血并记录飞升。
5. 主线、修炼、材料说明、帮助和原有角色/命格/十二境页面改为 `level + xp/required` 新进度，不再把已退役的道行与三重问心/雷劫误标为必做。
6. 修复高阶赋灵 `spendProgress()` 仍试图扣退役 `daoXp` 的软锁，改扣本段 `xp`。
7. 设置页版本号、榜单文件名更新 V90.57。保留其他经济、战斗、存档、装备与秘境系统。

## 文件结构

- `index.html` / `releases/山野修仙记_V90.57_渡劫主线修复与终劫闭环.html`：相同字节的新版游戏。
- `releases/山野修仙记_V90.56_渡劫改制.html`：原版冻结基线，不可篡改。
- `tools/build_v957_from_main.py`：以 SHA256 锁定 V90.56 的可复建脚本，锚点数量、JS 脚本块数量与前端动作集合均校验。
- `tools/v957-progression.js`、`tools/v957-trial-ui.js`、`tools/v957-objective.js`：三个 UI 更改单元的原始源码。
- `tests/v957_tribulation_closure.cjs`：引擎级逻辑校验，275 项检查。
- `tests/v957_browser_smoke.py`：实际 Chromium 渲染/点击，四视口，20 张截图。
- `tests/run_v957_verification.py`：不依赖旧 `play/` 夹具的 18 项完整可执行专项验收集合。
- `evidence/verification/`、`evidence/browser/`：测试输出、截图、JSON 结果。
- `docs/V9057_修复验收报告.md`：问题、变更、证据与已知限制。

## 重建与测试

```bash
# 在交付目录根部
python tools/build_v957_from_main.py
python tests/run_v957_verification.py
```

浏览器自动化环境需 Python `playwright` 以及 Linux 系统 Chromium `/usr/bin/chromium`；如无浏览器环境，可先运行 `python tests/run_v957_verification.py --skip-browser` 验证其余 17 项。

> 说明：原上传的 V90.56 ZIP 缺少历史 `play/` 试玩夹具和若干历史 release（如 V90.5），因此原 `tests/run_full_regression.cjs` 的 **37 层全量验收不能从这份原始包独立重现**。本次额外建立了当前版可复现的 18 项验收套件，不能把 18/18 混称 37/37。

## 发布边界

没有向 GitHub 主分支、其他开发分支、TapTap 或任何线上服务写入内容。真实旧存档重置与补偿弹窗、完整 37 层历史依赖、Android/iOS 真机及 TapTap 容器尚待目标设备验收。本次成果按**本地候选版**交付。
