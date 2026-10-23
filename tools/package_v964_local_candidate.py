#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""V90.64 OFFLINE H5 complete-source handoff. Not a TapTap production upload ZIP."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
import hashlib
import json
import os

ROOT=Path(__file__).resolve().parents[1]
VERSION="V90.64"
NAME="山野修仙记_V90.64_本地完整交付候选包"
RELEASE="releases/山野修仙记_V90.64_难度分级版.html"
SHA_LF="3307B8D3BAC4076195FA1BCC4716B619750C9AC424CB1218AF86BACBF7208FB6"
OUTPUT=ROOT/"dist"/(NAME+".zip")
SOURCES=(".github","docs","patches","platform","play","releases","saves","src","taptap-build","tests","tools","verify","visual")
EXCLUDE={".git","node_modules","__pycache__","dist","delivery",".cache",".venv","site-packages"}

def sha(x):return hashlib.sha256(x).hexdigest().upper()
def require(c,message):
    if not c:raise SystemExit("V90.64 LOCAL HANDOFF FAIL: "+message)
def pack_files():
    out={"index.html":(ROOT/"index.html").read_bytes(),
         "README.md":(ROOT/"README.md").read_bytes()}
    for root in SOURCES:
        base=ROOT/root
        if not base.exists():continue
        for p in base.rglob("*"):
            if not p.is_file():continue
            rel=p.relative_to(ROOT)
            if any(part in EXCLUDE for part in rel.parts):continue
            if p.suffix in (".pyc",".tmp") or p.name.startswith("tmp_"):continue
            out[rel.as_posix()]=p.read_bytes()
    for folder in ("v964-difficulty","v964-second-review","browser-responsive"):
        basedir=ROOT/"artifacts"/folder
        if basedir.exists():
            for p in basedir.rglob("*"):
                if p.is_file():
                    out["evidence/"+folder+"/"+p.relative_to(basedir).as_posix()]=p.read_bytes()
    return out
def write_zip(z,name,data):
    item=ZipInfo(NAME+"/"+name,(2026,10,23,0,0,0))
    item.compress_type=ZIP_DEFLATED
    item.external_attr=0o644<<16
    z.writestr(item,data,compress_type=ZIP_DEFLATED,compresslevel=6)

def main():
    raw=(ROOT/"index.html").read_bytes()
    release=(ROOT/RELEASE).read_bytes()
    require(raw==release,"entry and standalone release are not byte-identical")
    current_sha=sha(raw.replace(b"\r\n",b"\n"))
    require(current_sha==SHA_LF,"expected V90.64 frozen LF sha, got "+current_sha)
    require(b"V90.64" in raw[:1300],"wrong title version")
    contents=pack_files()
    required=[
        "tools/build_v964_from_main.py","tools/build_taptap_v964_from_v9064.py",
        "tests/v964_difficulty_modes.cjs","tests/v964_difficulty_browser.py",
        "tests/v964_second_audit_browser.py","tests/v964_taptap_rank_guard.cjs",
        "tests/v964_taptap_package_smoke.py","platform/taptap-difficulty-ranks-v964.js",
        "docs/V9064_三档难度与独立排行榜_设计验收.md",
        "docs/V9064_独立二审与本地交付.md",
        "evidence/browser-responsive/results.json",
        "evidence/v964-second-review/created-easy-320.png",
        "evidence/v964-second-review/created-standard-360.png",
        "evidence/v964-second-review/created-challenge-390.png",
    ]
    for filename in required:require(filename in contents,"missing required source or evidence: "+filename)
    metrics=json.loads(contents["evidence/browser-responsive/results.json"])
    require(isinstance(metrics,(dict,list)),"corrupt responsive metrics")
    run=os.environ.get("GITHUB_RUN_ID","NOT_PROVIDED")
    commit=os.environ.get("GITHUB_SHA","NOT_PROVIDED")
    readme=f"""# 《山野修仙记》V90.64 本地完整交付包

版本性质：**H5 独立试玩 / 本地 AI 二次开发的已验收候选包**。
**不是 TapTap 可直接上架 ZIP；没有合并 main，也没有改动正式线上玩家存档。**
当前 GitHub 分支：feat/v90.64-difficulty-modes
来源提交：{commit}
原始 CI：https://github.com/kongshan-fun/-/actions/runs/{run}

## 从哪里开始
1. 阅读此文件及 docs/V9064_独立二审与本地交付.md。
2. index.html 是真实 V90.64 入口，直接用 Edge/Chrome 离线打开；releases/山野修仙记_V90.64_难度分级版.html 与之完全相同。
3. 需要本地继续开发时首选 GitHub 的 feat/v90.64-difficulty-modes 对应提交，再用此 ZIP 的 screenshots / tests / SHA256SUMS 做对照，不要直接覆盖原本项目工作区。
4. 从 V90.62 冻结文件重建：python tools/build_v964_from_main.py；核验：python tools/check_entry_consistency.py --rebuild。
5. 独立审查：node tests/v964_difficulty_modes.cjs；node tests/v964_taptap_rank_guard.cjs；
   python tests/v964_difficulty_browser.py；python tests/v964_second_audit_browser.py；
   python tests/browser_responsive.py（Playwright Chromium）。
6. SHA256SUMS.txt 为包内所有实际文件的清单（不包含清单自身）；请先进行逐文件验算。

## 确定的功能
- 简单 50%、标准 80%、挑战原版 100%：升级所需经验、敌方气血/攻击/护甲、雷劫固定伤害。
- 三模式各人族100档+妖族100档，总计600个隔离档位；旧档未标难度者归原挑战档，原键不改。
- 简单模式不计入本机榜；标准、挑战各有独立的本机飞升榜和导出。
- 旧挑战档可继续；新建角色选择难度后锁定；切换模式不能覆盖原进行中的档。
- 妖兽图鉴随当前难度显示基础属性；旧“打怪掉成品装备”误导文案已修正。

## 本次二审实际 CI 检查
- 1,062 项引擎/存档/模式断言 PASS；62 项模拟平台排行榜断言 PASS；
- Chromium 真实难度 UI 69 项 PASS、真实全程建档与刷新/跨模式导入 62 项 PASS；
- 6 个视口响应式 PASS，截图位于 evidence/；
- 已指定回归及游戏文件确定性重建 PASS。
- **旧 43 层历史全量套件未全部以 V90.64 当前首屏重跑**；其部分浏览器测试基于历史 play 文件，不应将历史 43/43 冒充 V90.64 的新版本验收。

## 仍未通过的生产发布门禁
- TapTap 标准模式官方战力榜/飞升榜的独立榜单 ID 尚未配置；
- 平台 V907 适配层仍需锁定来源 SHA，当前构建脚本读取仓库外路径；
- 真实 TapTap 容器广告、云存档覆盖冲突、断线重连、双设备、旧档重置安全均未闭环；
- 如果用户已有旧存档，务必单独保留 JSON 备份，禁止唯一原件进入危险重置测试。

**本地交付结论：READY_FOR_LOCAL_HANDOFF；TapTap 正式发布：BLOCKED。**
"""
    contents["00_必读_交付说明.md"]=readme.encode("utf-8")
    checksums="\n".join(f"{sha(data)}  {name}" for name,data in sorted(contents.items()))+"\n"
    contents["SHA256SUMS.txt"]=checksums.encode("utf-8")
    OUTPUT.parent.mkdir(parents=True,exist_ok=True)
    with ZipFile(OUTPUT,"w") as z:
        for name,data in sorted(contents.items()):write_zip(z,name,data)
    # Verify every member independently after close.
    with ZipFile(OUTPUT) as z:
        require(z.testzip() is None,"ZIP CRC validation failed")
        require(len(z.namelist())==len(contents),"ZIP file count mismatch")
        for name,data in contents.items():
            require(sha(z.read(NAME+"/"+name))==sha(data),"ZIP payload mismatch: "+name)
    print(f"V90.64 LOCAL HANDOFF PASS files={len(contents)} zip_bytes={OUTPUT.stat().st_size} sha256={sha(OUTPUT.read_bytes())}")
    print("OUTPUT="+str(OUTPUT))
if __name__=="__main__":
    main()
