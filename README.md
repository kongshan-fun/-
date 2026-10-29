# 山野修仙记 V90.77 · 灵息辟谷

当前为独立 H5 上线候选，不自动替换 TapTap 生产包。

本轮基于 V90.76 的寿尽救援、图鉴和帮助修复，接入十二境自然食水减耗、可选真元／妖元抵扣、突破领悟提示与修炼管理界面。沿用V90.75的全地图唯一洞府、十二阶设施与快捷补给。

## 运行
解压独立H5包，打开 `index.html`。正式持久存档建议使用固定HTTP/HTTPS来源；升级前导出JSON。无外部脚本、图片或CDN依赖。

## 构建与验证
```bash
python tools/build_v976_from_main.py
python tools/build_v977_from_main.py
python tools/check_entry_consistency.py --rebuild
node tests/run_v977_acceptance.cjs
python tests/v977_browser.py
python tests/v977_rescue_browser.py
SIM_ACTION_LIMIT=100000 SIM_BIGU=1 node tests/v977_player_sim.cjs easy
python tools/package_v977.py
```
浏览器脚本默认真实HTTP/原生localStorage。`--offline-dom`只供明确标注的离线渲染复核，不可作为原生存储验收的替代。

## 发行状态
功能数据与截图测试分别记录于 `artifacts/v977/`。高境截图使用隔离测试档；自然模拟不注入资源。正式TapTap广告、云存档、平台榜分期与真机验证仍为上线门禁。旧版平台包与main本轮不自动改动。

详见 `docs/v977/功能与上线边界.md`。
