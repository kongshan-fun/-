# TapTap 上传记录 · V90.10

## 已上传内容

| 项 | 值 |
|---|---|
| 上传目录 | `taptap-build/upload-v910/`（仅含 `index.html`） |
| 文件大小 | 795,672 字节 |
| 文件 SHA256 | `5690F150B82F6DC4548EFA5DC6D5076E262BA3453AA2C4E5486C91D3C62CCA88` |
| 内置测试码 | `SHANYE-V910-TT-BD672573` |
| 游戏版本 | V90.10（页面标题 `山野修仙记 V90.10 · 界面密度与检索优化`） |

## 源码对应关系

| 层 | SHA256 |
|---|---|
| 游戏源码 `index.html` | `FC024760C3D0FF710ADB2D49D51A84EC3738B3B3F3D8DED77FB227DCE3731AC0` |
| 发布 `releases/山野修仙记_V90.10_界面密度与检索优化版.html` | 同上（与源码完全相同） |
| TapTap 包体 `taptap-build/shanhe-v910-taptap/index.html` | `5690F150B82F6DC4548EFA5DC6D5076E262BA3453AA2C4E5486C91D3C62CCA88` |
| 上传 ZIP `山野修仙记_V90.10_TapTap上传包.zip` | `51F4F14FDA62161A451971CD8B82D7C60E035A3CA618884036DF0E819443DE70` |

## 平台侧（appId 980929，开发者 380806）

| 版本 | 状态 |
|---|---|
| `V-20261018-1` | 4 = 已上线（**线上仍跑这个旧包**） |
| `V-20261018-2` | 1 = 审核中（本次上传的最新包） |

- 快速上架流程，上线后以【文字游戏合集】关卡形式分发（`is_level: true`，`level_tag: 创意工坊`）
- 小程序 ID：`tapmcpvxctfso9abji`

## 复现方式

```bash
python tools/build_taptap_v910.py
# 产物应得：index.html 795,672 B / 5690F150… / 测试码 SHANYE-V910-TT-BD672573
```

构建码用 18 字符等长占位符先算哈希再替换，保证同一输入永远得到同一测试码；
`out_sha`（占位符版本，用于生成测试码）与 `file_sha`（写盘字节真实哈希）是两回事，不要混用。

## 已知未验证

- 未在真实 TapTap 容器内运行；云存档、战力榜、速通榜的真实提交未验证
- `achievements.boss` 阈值仍为空串，P6 成就钩子不会发起解锁
- 包内未包含 `selftest.html`，TapTap 侧无自检页
