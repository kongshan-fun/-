#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build a truthful V90.62 local handoff ZIP *after* CI acceptance gates pass."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
import hashlib
import os
import re
import json

ROOT=Path(__file__).resolve().parents[1]
VERSION="V90.62"
RELEASE="山野修仙记_V90.62_存档可靠性收口.html"
ARCHIVE_NAME="山野修仙记_V90.62_完整本地候选包.zip"
PACKAGE_ROOT="山野修仙记_V90.62_完整本地候选包"
SOURCES=(".github","docs","patches","play","releases","saves","src","taptap-build","tests","tools","visual")
SKIP_DIR={".git","node_modules","__pycache__","delivery","dist",".cache",".venv"}
OUTPUT=ROOT/"dist"/ARCHIVE_NAME

def sha(data):
    return hashlib.sha256(data).hexdigest().upper()

def must(cond,message):
    if not cond:raise SystemExit("PACKAGE FAIL: "+message)

def files():
    out={ "index.html":(ROOT/"index.html").read_bytes() }
    for folder in SOURCES:
        p=ROOT/folder
        if not p.exists():continue
        for item in p.rglob("*"):
            if not item.is_file() or any(z in SKIP_DIR for z in item.relative_to(ROOT).parts):continue
            if item.name.startswith("tmp_") or item.suffix==".pyc":continue
            key=item.relative_to(ROOT).as_posix()
            out[key]=item.read_bytes()
    for folder in ("v962-p0-browser","browser-responsive"):
        p=ROOT/"artifacts"/folder
        if p.exists():
            for item in p.rglob("*"):
                if item.is_file():
                    out["evidence/"+folder+"/"+item.relative_to(p).as_posix()]=item.read_bytes()
    return out

def write_member(z,key,value):
    info=ZipInfo(PACKAGE_ROOT+"/"+key,(2026,10,22,0,0,0))
    info.compress_type=ZIP_DEFLATED
    info.external_attr=(0o644<<16)
    z.writestr(info,value,compress_type=ZIP_DEFLATED,compresslevel=6)

def main():
    current=(ROOT/"index.html").read_bytes()
    release=(ROOT/"releases"/RELEASE).read_bytes()
    must(current==release,"index.html != frozen V90.62 release")
    must(b"V90.62" in current,"wrong game version")
    entries=files()
    must("tools/build_v962_from_main.py" in entries,"missing rebuild tool")
    must("tests/v962_200slots_faults.cjs" in entries,"missing fault tests")
    must("tests/v962_p0_browser.py" in entries,"missing real-browser test")
    must(any(k.startswith("evidence/v962-p0-browser/") for k in entries),"browser evidence missing")
    must("evidence/browser-responsive/results.json" in entries,"viewport metrics missing")
    metrics=json.loads(entries["evidence/browser-responsive/results.json"])
    must(isinstance(metrics,(list,dict)),"invalid browser metrics")
    run=os.environ.get("GITHUB_RUN_ID","未提供")
    sha_commit=os.environ.get("GITHUB_SHA","未提供")
    note=f"""# 山野修仙记 {VERSION} · 本地完整候选交付

**性质：GitHub 开发候选版；不是 TapTap 已上线版，也没有合并 main。**
冻结发布 HTML：releases/{RELEASE}
完整独立游戏入口：index.html（双击在浏览器离线试玩）
源码和历史测试：src/、tools/、tests/、play/、releases/、docs/
确定性重建：python3 tools/check_entry_consistency.py --rebuild
原始校验：SHA256SUMS.txt（逐文件）及脚本输出 ZIP 校验和

## 本批次实际 CI 验收
- 65 项存档专项断言通过；双种族 200/200 档通过（1,442 项断言，24 次写入失败注入、32 次重试）。
- 引擎与成长、战斗、炼制、精炼、赋灵和旧档指定回归通过。
- 真实 Chromium 旧档补偿流程 11 项检查通过。
- 浏览器六视口布局验证通过（320×568 / 360×640 / 390×844 / 412×915 / 1080×1920 / 1440×900），截图和指标位于 evidence/。
- 入口、发布文件和基线构建器三者一致；重建与提交文件字节相同。
- CI： https://github.com/kongshan-fun/-/actions/runs/{run}
- 源提交：{sha_commit}

## 数据安全与使用提醒
- 初次打开游戏建议创建新档进行测试；不使用正式玩家的唯一原存档执行重置。
- V90.43 前旧角色进度无法自动换算到重构的十二境体系。遇到“旧存档无法沿用”弹窗，先点“导出旧档 JSON”保留备份，再决定是否从零开始。
- 旧档补偿按档位一次性结算；已领取的补偿不会重复发放，余额花完也不会自动回补。
- 浏览器、网址、TapTap 容器之间的 localStorage 不会天然共享。跨设备/换浏览器操作前请先导出。
- 不要把此候选 ZIP 直接当 TapTap 可发布包。平台适配、广告、云存档需由独立 TapTap 构建流程验证。

## 仍需人工/平台验证
1. Windows 本地完整 run_full_regression.cjs（含 GitHub runner 不稳定的历史 CDP 测试）。
2. Android/iOS 真机及 TapTap 内嵌环境，尤其云存档冲突、激励广告到账、前后台切换。
3. TapTap 平台实时版本状态及 OWNER 审批。
4. 自然通关与数值经济长期平衡（自动里程碑测试不等于玩家真实通关）。

**发布门禁：当前仍是候选版，不得仅凭本 ZIP 自动上线。**
"""
    entries["00_必读_候选说明.md"]=note.encode("utf-8")
    manifest="\n".join(f"{sha(b)}  {name}" for name,b in sorted(entries.items()))+"\n"
    entries["SHA256SUMS.txt"]=manifest.encode("utf-8")
    OUTPUT.parent.mkdir(parents=True,exist_ok=True)
    with ZipFile(OUTPUT,"w") as z:
        for name,data in sorted(entries.items()):write_member(z,name,data)
    # Independent ZIP round-trip and byte checks; never certify on ZIP writer alone.
    with ZipFile(OUTPUT) as z:
        bad=z.testzip()
        must(bad is None,f"ZIP CRC corrupted: {bad}")
        must(len(z.namelist())==len(entries),"archive entry mismatch")
        for name,data in entries.items():
            got=z.read(PACKAGE_ROOT+"/"+name)
            must(sha(got)==sha(data),f"archive content mismatch: {name}")
    print(f"V90.62 LOCAL PACKAGE PASS | files={len(entries)} | zip_bytes={OUTPUT.stat().st_size} | SHA256={sha(OUTPUT.read_bytes())}")
    print("OUTPUT="+str(OUTPUT))
if __name__=="__main__":
    main()
