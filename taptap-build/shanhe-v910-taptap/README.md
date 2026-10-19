# 山野修仙记 V90.10 · TapTap H5 上传包

## 包体结构
```
shanhe-v910-taptap/
├── index.html            完整游戏（已注入 QTAP 适配层）
├── selftest.html         环境自检页（在 TapTap 容器内打开可看 API 可用性）
├── build-manifest.json   本轮全部补丁与 ID 记录
└── README.md             本文件
```
上传时把**整个 `shanhe-v910-taptap` 文件夹压成 zip**，确保 `index.html` 在文件夹根目录。

## 已接入（沿用 v907 适配线，逐条断言）
| 补丁 | 内容 |
|---|---|
| P1 | `<body>` 后注入 QTAP 适配层 |
| P2 | `render()` 发布 `__QTAP_STATE`（种族/档位/game/实时战力）与 `__QTAP_NOTIFY` |
| P3 | `persist()` 发布 `__QTAP_SAVE_TICK`（云同步节流节拍） |
| P4 | 广告与云端口径文案（激励视频 / 云端存档 / 速通榜） |
| P5 | 版本标识校验 V90.10 |
| P6 | 击败首领时上报官方成就 `QTap.achievements.unlockBoss(bossWins)` |
| P7 | 首次飞升后上报速通榜 `QTap.leaderboard.submitAscension(...)` |

**已配置客户端 ID**（来自 v907 已验证配置）
- 广告位：`1054324`
- 战力榜：`a7m6yjlef2giizektn`
- 飞升速通榜：`v0jfnb60tgtdlysic0`

**未改动**：战斗数值、突破难度、存档结构、寿元续命、储物袋、飞升结算。

## 本轮跳过的文案锚点
P4e 设置页标题、P4f 设置页说明、P4l 存档口径 A

> 原因：V90.9 重写过设置页结构，v907 的部分文案锚点已不存在。
> 跳过的都是措辞类，不影响功能；如需统一口径，可按 V90.10 新结构补一轮。

## 本地测试
```bash
cd taptap-build/shanhe-v910-taptap
python -m http.server 8080
```
- 游戏：`http://127.0.0.1:8080/index.html`
- 自检：`http://127.0.0.1:8080/selftest.html`

普通浏览器中 `tap` 缺失、MOCK 为「是」属正常降级，游戏可正常游玩与本地存档。
在 TapTap 容器内打开自检页，各项应为「可用」且 MOCK 为「否」。

## 测试码
`SHANYE-V910-TT-3BCF5489`

已写入包体 `window.__SHANYE_BUILD_CODE`，可在自检页底部核对。

## 已知限制
- 未在真实 TapTap 容器内运行；云存档跨设备恢复、战力榜/速通榜真实提交需在 TapTap 侧实测。
- 成就阈值 `achievements.boss` 目前为空字符串（不发起解锁请求），需要后台建成就后回填 ID。
