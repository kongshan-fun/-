# 青岚问道 · 开发约束 V12

1. 代码以 GitHub 最新已合并 `main` 为稳定基线，以最近通过 CI 的开发分支作为实际开发基线。新功能创建独立命名分支和 Draft PR；没有作者审查不合并 main。
2. 正式源码为 `src/data.js`、`src/engine.js`、`src/slots.js`、`src/ui.js`、`src/style.css`、`index.html`。修改后执行 `python build_docs.py && python build.py` 并提交单文件 HTML。
3. 游戏为原创文字修仙生存 RPG；对标机制可以参考，但不要复制别人的代码、文本、素材或专属数值表。
4. 固定黑白灰手机排版，最宽 400px；电脑中央仍是手机窗口。无整页滚动。主界面左下角 3x3 九宫格，以“我”为中心；仅按需展开当前地图的 8x8（64格），不得变成常驻整屏地图。
5. 采集、缺工具、破境失败等提示必须悬浮，不能改动资源格位置。背包、洞府、炼器、炼丹、图鉴、教程、出行列表长内容仅面板内部滚动。
6. **十二张 8x8 地图**：保留原五境并扩充结丹、元婴、化神、炼虚、合体、大乘、渡劫七张。凡界境界为炼气→筑基→金丹→元婴→化神→炼虚→合体→大乘→渡劫→飞升。仙界内容未开放，不得显示假的可玩地图。
7. 每境资源需要真实采集、材料真实扣除、首领实际战斗，后七境必须祭坛+首领+回本境洞府消耗道行与道材才能突破，渡劫完成后需独立天门飞升。离线只保留本地存档。
8. 两个角色（剑修、丹修）独立存档、洞府和寿元；寿元归零仅清除对应角色主档与备份，不能清除另一角色。角色导入必须检查归属身份；支持旧 V9–V11 存档迁移，不自动重开或复制旧档。
9. 保留已有 11 步实操新手引导及完整文字教程；后期破境、飞升规则也必须在帮助页查询。教程奖励不可重复领。
10. 每轮改动须运行 `node tests/smoke.test.js`、`node tests/v10_regression.test.js`、`node tests/v10_lifespan.test.js`、`node tests/v11_characters.test.js`、`node tests/v10_campaign.test.js --all --both-roles`、`node tests/v12_ascension.test.js`、`python tests/v12_browser.py`。远端 CI 没有通过前必须保持 Draft PR。
11. 测试层 localStorage 适配器不等于 Android/iOS 真实存储验证。只有实测过的能力才声明通过；不要以预置高级装备冒充从零通关。
