# 青岚问道 V11 · 双角色独立存档

原创文字修仙生存 RPG。基于 V10 的五境、黑白极简、左下九宫格、洞府营建、寿元死亡系统，本版本加入两名真实差异化角色和互相隔离的存档分支。

## 试玩与源码
- 直接打开 `青岚问道_V11_双角色独立存档.html`，离线可玩。
- 开发入口 `index.html`，逻辑文件 `src/data.js`、`src/engine.js`、`src/slots.js`、`src/ui.js`，样式 `src/style.css`。
- 重新打包运行 `python build.py`；生成教程运行 `python build_docs.py`。

## 两个角色
| 职业 | 生命 | 灵力上限 | 攻击 | 初始寿元 | 专长 |
| --- | ---: | ---: | ---: | ---: | --- |
| 玄锋剑修 | 100 | 100 | 7 | 56年 | 剑诀倍率1.90、耗灵9，侧重爆发 |
| 青木丹修 | 94 | 115 | 6 | 64年 | 灵焰诀倍率1.45、耗灵11；采止血草35%额外+1（负重限制）；回春术耗灵14回复28，回春散恢复40 |

每角色一个自动存档槽，地图、洞府、仓库、修炼、寿元、图鉴都独立。点击顶部「角色」切换。**寿元归零只删除当前角色的主档和备份**，不会清除另一角色；留下陨落标记防止浏览器刷新自动复活，重新开始需要明确操作。

### 旧档与导入
同一浏览器来源的 V10/旧版存档必须在角色卡上显式选择「继承一次旧档」，不能复制两次。旧来源键暂保留作备份，迁移标记阻止再次继承。V11 手工 JSON 导入严格校验角色，剑修存档不能覆盖丹修。跨网址/设备时两角色分别导出存档文件。

## 测试
```bash
node tests/smoke.test.js
node tests/v10_regression.test.js
node tests/v10_lifespan.test.js
node tests/v11_characters.test.js
node tests/v10_campaign.test.js --all --both-roles
python build.py
python tests/v10_browser_smoke.py
python tests/v10_lifespan_browser.py
python tests/v11_browser.py
```

> Chromium 测试采用隔离的测试专用 localStorage 适配器，不能替代真实 Android/iOS 或正式域名的长周期存档验证。五境通过是知晓目标的自动规划器，不是普通玩家平衡数据。

`main` 保持 V9；本版本位于 `feat/v11-character-slots`，从 V10 开发分支衍生，未经审查不自动合并或部署。
