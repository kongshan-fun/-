# 山野修仙记 V90.10 · TapTap H5 上传包

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
