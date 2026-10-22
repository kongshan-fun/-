# 山野修仙记 · V90.59 本地候选版交接

来源基线：`fix/v90.58-p0-closure` SHA `420c62251d0f22cf98d90233851d7305831a6d14`。

本批：战斗中存档 `normalize` 错误上下文修复；前四次破境直接晋升，第五境起七次渡劫；超额修为保留并延续；越级压制现状不改；人/妖各 100 档加速链模拟。原 V90.58 文件保留。

- 默认入口 `index.html` 与 `releases/山野修仙记_V90.59_存档晋升与修为继承版.html` 字节一致。
- `python tools/build_v959_from_main.py` 可按 SHA-256 锁定的 V90.58 重新生成 V90.59。
- `node tests/v959_rules_regression.cjs`
- `node tests/v959_200slots_integration.cjs`
- `python tests/v959_browser_actions.py`
- `python tests/run_v959_verification.py` 用于多脚本聚合验证；长时间执行建议单独观察批量模拟日志。

**数据解释**：本地 200/200 是加速/充分补给状态机验收，通过率不能当自然飞升概率。
**旧存档**：沿用上一版明确的「旧档先导出、用户确认重置、300/600/1000 轮回玉一次性补偿」。不擅自改为旧档无损迁移。
**TapTap**：仍未验证，严禁自行发布。
