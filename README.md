# 青岚问道 V16 · 猎妖炼器 / 凡界飞升

原创修仙题材文字生存游戏。当前主线：**猎妖取材 → 炼器 → 祭坛 → 首领 → 下一境**。

## 试玩

打开 **青岚问道_V16_猎妖炼器.html** 即可离线游玩。桌面始终是居中的 ≤400px 手机布局；黑白极简、24格资源/妖兽、左下九宫格、完整地图按需展开。

## 内容

- 前五图（青岚、碧溪、赤岭、幽沼、天阙）绑定独有的妖兽和妖材，各图至少一类普通猎物与一类进阶妖兽。
- 10件一阶可制作猎妖装备，原有高阶法器继续保留，并加入对应兽材与前图首领印记的配方依赖。普通 starter 桃木剑仍可从采集资源制造。
- 首次挑战前五图首领：需完成祭坛，并打造对应地图任一件 **本境战备装备**；已通过的首领不受重复门槛限制。
- 普通妖兽的关键材料为**必掉**，额外妖核是**概率奖励**，稀有随机材料不作为主线卡点。
- 24个场景格中复用原10资源格的每日供给额度（新增格子只是交互入口），避免2倍产能膨胀。
- 两族各100档、随机命格、寿命折损、洞府仓库、12张地图/飞升保持原规则。
- 程序主显示V16；出于旧档兼容，存档数据协议版本仍然是V14，没有强制重开。

## 构建与测试

```bash
node tests/v14_core.test.js
node tests/v14_lifespan.test.js
node tests/v14_races.test.js
node tests/v15_scene.test.js
node tests/v16_hunt.test.js
node tests/v14_campaign.test.js --all --both-roles
node tests/v14_ascension.test.js
python build_docs.py && python build.py
python tests/v16_fullbrowser.py
python tests/v16_browser.py
python tests/v16_onboarding.py
```

浏览器测试使用 Chromium；真实手机、长周期存档、200份满进度浏览器配额仍未认证。先前审计的 `localStorage` 配额满时寿尽清档可能失败的问题尚待V15.1存档专项修复，不应将现有版本宣称为正式商业发行。

## 文件结构

- `src/data.js`：怪物、掉落、基础配方、后七境与五境猎妖数据
- `src/engine.js`：战斗、资源共享额度、制作战备、首领进度
- `src/ui.js`：24格资源与妖兽、图鉴来源、主线目标
- `src/help.js`、`docs/`：教程与数值说明
- `src/slots.js`：双种族分档，旧档协议沿用

不复制《开拓者》的具体怪物、资源、代码或数值。仅参照“猎怪取材→制作装备→挑战首领”的抽象玩法循环。
