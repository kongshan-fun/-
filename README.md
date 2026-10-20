# 山野修仙记 · V90.27 主线窄屏收敛

原创竖屏 H5 文字修仙生存 RPG。**当前 GitHub `main` 最新游戏版本为 V90.27**，默认入口为 [`index.html`](index.html)，与 [V90.27 独立发布文件](releases/山野修仙记_V90.27_主线窄屏收敛版.html) **字节一致**（由 `tools/check_entry_consistency.py` 在 CI 里强制校验）。

> **状态说明（2026-10-20）：** 仓库版本 ≠ 已上线。TapTap 平台上仍是 `V-20261019`（V90.16 的包）在 `reviewing`，线上是 `V-20261018-2`（V90.10）。V90.17~V90.27 都还没有打包上传。**不要据 GitHub 版本推断线上版本**，一律 `app list-app-versions` 实时回读。

## 立即体验

1. 下载或克隆本仓库。
2. 用浏览器打开根目录 `index.html`（双击 `file://` 也能跑），或打开 `releases/` 下当前版本的独立发布文件。均为单文件 H5，无需构建或安装依赖。
3. 旧档跨浏览器、域名或 H5 容器迁移前，先在游戏内导出备份 JSON；浏览器存储来源不同可能无法自动共享存档。

## 版本更新（近版）

| 版本 | 核心内容 |
| --- | --- |
| V90.16 | 窄屏面板密度（只压面板内部，不碰顶栏与状态条） |
| V90.17 | 图鉴父子页：品类入口 → 条目 → 详情；顺带修掉两个过期测试 |
| V90.18 | 轮回玉广告奖励 100 → 200 |
| V90.19 / .20 / .21 | 一次性「★ 评价」入口 + 加群文案（点一次即永久消失） |
| V90.22 | 评价入口触发时机改为「教程跟完 / 跳过」 |
| V90.23 | **装备来源改 A 方案**：战斗与秘境不再掉成品，只给器材；成品唯一来源＝炼器室 |
| V90.24 | 修建筑卡说明被裁切（V90.16 密度补丁越界成全局规则） |
| V90.25 | **轮回玉每档一次**（刷新/重开不重置、档位之间不串） |
| V90.26 | 360×640：设置父页 1.05→1.00、修炼父页 1.15→1.00 |
| **V90.27** | **360×640：主线父页 1.23→1.00**（行高收敛，未裁文字、未压字号） |

历史版本（V83~V90.15）仍在 [`releases/`](releases/) 里冻结保留。

## 仓库结构与工程入口

| 路径 | 用途 |
| --- | --- |
| [`index.html`](index.html) | 当前默认游戏入口，单文件完整 H5（== 当前发布文件） |
| [`releases/`](releases/) | 冻结发布文件；版本链构建器的基线 |
| [`tools/build_v9XX_from_main.py`](tools/) | 版本链构建器：从上一版发布文件 + 三条硬断言（基线哈希 / 替换次数 / 动作集合不减） |
| [`tools/check_entry_consistency.py`](tools/check_entry_consistency.py) | 入口 / 发布文件 / 构建器三者一致性；`--rebuild` 验证"同输入同字节" |
| [`tests/browser_responsive.py`](tests/browser_responsive.py) | 6 视口 Chromium 布局验收（装备 / 百档 / 洞府），产出截图 |
| [`tests/run_v908_regression.cjs`](tests/run_v908_regression.cjs) | 引擎级 6 套回归（含 100 档全里程碑） |
| [`docs/交接文档.md`](docs/交接文档.md) | **接手必读**：界面规范、验收方法、已知问题、TapTap 发布流程 |
| `src/`、`build.py`、`青岚问道_V9_洞府营建.html` | 旧 V9 原型代码与历史资产，**不是当前构建入口** |

## 确定性构建及回归

```bash
python3 tools/check_entry_consistency.py --rebuild   # 一致性 + 可复现
node tests/run_v908_regression.cjs                  # 引擎 6 套
node tests/v926_realm_guide.cjs                     # 七境突破
node tests/v927_gear_economy.cjs                    # 装备经济闭环
python3 tests/browser_responsive.py                 # 6 视口布局（需 playwright + chromium）
```

CI 见 [`.github/workflows/main-verify.yml`](.github/workflows/main-verify.yml)：按当前版本反查发布文件与构建器，不再写死版本号。

## 发行与数据边界

这是**可离线试玩的 H5 游戏代码**，不是已核实上线的生产服务。TapTap 版由 `tools/build_taptap_*.py` 注入适配层（激励视频 / 云存档 / 排行榜 / 成就），仓库版不含这些平台调用；排行榜在本机、没有账户体系。Android / iOS 实机与 TapTap H5 容器仍需单独验收；改动存档格式要维持旧档兼容。

改玩法的顺序固定：**先改数据与规则 → 用构建器出新版本（三条断言） → 跑矩阵与浏览器验收 → 截图确认 → 再同步 `docs/交接文档.md`**。100 档测试属于加速里程碑回归，不代表自然游玩的真实通关率。
