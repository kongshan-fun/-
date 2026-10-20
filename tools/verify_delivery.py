#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""交付包完整性验收（独立于生成脚本，模拟用户拿到 ZIP 后的自检）。

1. ZIP 结构：单根目录、正斜杠、含 index.html
2. 逐文件比对 SHA256SUMS.txt
3. 包内独立 HTML == 仓库当前发布文件（字节）
4. 包内 TapTap 候选包 index.html 的哈希 == 其 build-manifest.json 记录的 outputSha256
5. 报告里"全量回归 PASS"与"已知未达标"都在（不能只留好看的）
"""
from __future__ import annotations
import hashlib
import json
import re
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
# 版本号从 index.html 标题读，别用文件名排序猜（V90.20 会排到 V90.28 前面）
_HTML = (ROOT / "index.html").read_text(encoding="utf-8", errors="replace")
VERSION = re.search(r"<title>[^<]*?(V\d+\.\d+)", _HTML).group(1)
RELEASE = next(p for p in sorted((ROOT / "releases").glob("*.html")) if f"_{VERSION}_" in p.name)
ZIP = ROOT.parent / f"山野修仙记_{VERSION}_交付包.zip"


def sha(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest().upper()


def main() -> None:
    if not ZIP.exists():
        print(f"[FAIL] 找不到交付包：{ZIP}")
        sys.exit(1)
    print(f"交付包 {ZIP.name}  {ZIP.stat().st_size:,} B")
    print(f"          SHA256 {sha(ZIP.read_bytes())}")

    with tempfile.TemporaryDirectory() as td:
        with zipfile.ZipFile(ZIP) as z:
            names = z.namelist()
            roots = {n.split("/")[0] for n in names}
            bad = [n for n in names if n.startswith("/") or "\\" in n or ".." in n]
            print(f"\n结构：{len(names)} 条目，根目录 {sorted(roots)}")
            assert len(roots) == 1, "必须单根目录"
            assert not bad, f"路径不合法：{bad[:3]}"
            assert any(n.endswith("/index.html") or n.endswith("index.html") for n in names), "缺少 index.html"
            print("  单根目录 / 无反斜杠 / 含 index.html：OK")
            z.extractall(td)

        stage = Path(td) / list(roots)[0]
        # 2 校验和
        sums = {}
        for line in (stage / "SHA256SUMS.txt").read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            h, rel = line.split("  ", 1)
            sums[rel] = h
        missing, mismatched = [], []
        for rel, h in sums.items():
            p = stage / rel
            if not p.exists():
                missing.append(rel)
            elif sha(p.read_bytes()) != h:
                mismatched.append(rel)
        on_disk = {p.relative_to(stage).as_posix() for p in stage.rglob("*")
                   if p.is_file() and p.name != "SHA256SUMS.txt"}
        unlisted = sorted(on_disk - set(sums))
        print(f"\n校验和：登记 {len(sums)} 个")
        print(f"  缺失 {len(missing)} / 不匹配 {len(mismatched)} / 未登记 {len(unlisted)}")
        assert not missing and not mismatched and not unlisted, (missing[:3], mismatched[:3], unlisted[:3])
        print("  全部一致：OK")

        # 3 独立 HTML
        game = stage / "01-游戏" / RELEASE.name
        assert game.exists(), f"缺少 {RELEASE.name}"
        same = sha(game.read_bytes()) == sha(RELEASE.read_bytes())
        print(f"\n独立 HTML：{'与仓库发布文件字节一致' if same else '与仓库发布文件不一致！'}")
        assert same

        index_copy = stage / "01-游戏" / "index.html"
        assert index_copy.exists() and sha(index_copy.read_bytes()) == sha((ROOT / "index.html").read_bytes()), \
            "包内 index.html 与仓库入口不一致"
        print("  包内 index.html 与仓库入口一致：OK")

        # 4 TapTap 包
        tap = stage / "01-游戏" / "TapTap候选包"
        if tap.exists():
            man = json.loads((tap / "build-manifest.json").read_text(encoding="utf-8"))
            actual = sha((tap / "index.html").read_bytes())
            print(f"\nTapTap 候选包：{man['version']}  测试码 {man['buildCode']}")
            assert actual == man["outputSha256"], "包体哈希与 manifest 不符"
            print(f"  index.html SHA256 与 manifest 一致：OK（{man['outputBytes']:,} B）")
        # 5 报告完整性
        rep = stage / "04-报告"
        full = (rep / "03-全量回归.txt").read_text(encoding="utf-8", errors="replace")
        matrix = (rep / "04-三宽度矩阵.txt").read_text(encoding="utf-8", errors="replace")
        assert "FULL REGRESSION PASS" in full, "回归报告里没有 PASS 结论"
        assert "已知未达标" in full, "回归报告缺少已知未达标的说明"
        assert "洞府" in matrix and "超出 1.02 屏的项" in matrix, "矩阵报告缺内容"
        print("\n报告：回归含 PASS 与「已知未达标」、矩阵含洞府实测——未美化，OK")
    print("\nDELIVERY PACKAGE VERIFIED")


if __name__ == "__main__":
    main()
