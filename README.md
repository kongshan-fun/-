# 山野修仙记 V90.78 · 洞府百业与灵田

独立、自包含 H5 功能完整候选。基于冻结的 V90.77，保留 V90.74–77 存档安全、十二阶设施、快捷补给和辟谷规则。

## 本轮内容
- 底栏炼制改功法。野外查看资料不自动入府，参悟仍有原有条件。
- 炼器室、丹房、工作台、仓房、静室、灵田分页面，图鉴配方准确跳转。
- 工作台随建府启用、不升级；储物袋保留地图、境界、材料门槛，不再要求炼器室阶数。
- 洞府内原功法快捷位改为赋灵；不新增建筑，只需一阶炼器室。
- 灵田一阶4块、每级+2、十二阶26块；13种种子，真实采集掉落、播种、游戏时钟成长、批量收获和满仓留田。
- 旧自动灵田最多3轮收益及未完成周期分别保留；原档独立归档与下载，重复加载不会重复赠种。
- 修订旧剧情、饥渴、寿尽、初始寿元、药品阶数和新手引导；图鉴225项包含13种种子与自动工作台。

## 运行与备份
解压H5包，打开 `index.html` 即可。长期存档请固定HTTP/HTTPS来源，升级前导出旧JSON；不要用旧版覆盖保存已升级的种植档。
种植只按游戏内时间成长；修改系统时间或离线等候不会催熟。

## 分阶段构建与验证
```bash
python tools/build_v978_from_main.py --stage 2
node tests/v978_stations.cjs
python tools/build_v978_from_main.py --stage 4
node tests/v978_garden.cjs
python tools/build_v978_from_main.py
python tools/check_entry_consistency.py --rebuild
node tests/run_v978_acceptance.cjs
python tests/v978_browser.py
python tests/v978_bigu_browser.py
python tests/v978_rescue_browser.py
SIM_BIGU=1 SIM_ACTION_LIMIT=35000 node tests/v978_player_sim.cjs easy
python tools/package_v978.py
```
Node.js22、Python3.12；浏览器验收依赖Playwright与Chromium。默认浏览器测试使用真实HTTP来源、原生localStorage与下载；`--offline-dom`仅为显式标注的离线Storage适配测试，不冒充原生存储。

## 交付边界
源码与游戏包可运行、可独立重建。测试档的加速通关不等于自然玩家通关率；自然资源策略脚本如实保留失败。
没有自动合并main、修改线上或提交TapTap审核。真实平台广告、云存档、在线排行榜与真机尚须独立验收；本包不是APK或生产SDK适配包。
详见 `docs/v978/` 与 `artifacts/v978/`。
