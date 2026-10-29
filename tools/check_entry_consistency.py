#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""默认入口一致性检查（与版本号无关，CI 与本地都能跑）。

校验三件事：
  1. index.html 标题里有版本号 Vxx.yy
  2. releases/ 里**恰好一个**发布文件与 index.html 字节一致，且文件名版本号与标题一致
  3. 该版本对应的版本链构建器 tools/build_v<minor>_from_main.py 存在，
     并且它声明的基线哈希等于它在 releases/ 里引用的那个基线文件的实际哈希

第三项是这次 CI 修复的重点：旧工作流把 V90.8 的文件名与标题写死在 YAML 里，
发版就红；这里改成"按当前版本反查"，以后升版本不用改工作流。
"""
from __future__ import annotations
import hashlib
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
RELEASES = ROOT / "releases"


def sha(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest().upper()


def canonical_sha(b: bytes) -> str:
    """归一化成 CRLF 再算哈希。

    仓库在 Windows 工作副本里是 CRLF，CI（Linux 检出）是 LF；
    构建器里写死的 BASE_SHA 是按 CRLF 算的。不归一化的话，
    "本地全绿、云端全红"就是这么来的。
    """
    return sha(b.replace(b"\r\n", b"\n").replace(b"\n", b"\r\n"))


def fail(msg: str) -> None:
    print(f"[FAIL] {msg}")
    raise SystemExit(1)


def main() -> None:
    if not INDEX.exists():
        fail("缺少 index.html")
    data = INDEX.read_bytes()
    html = data.decode("utf-8")

    title = re.search(r"<title>([^<]+)</title>", html)
    if not title:
        fail("index.html 没有 <title>")
    vm = re.search(r"V(\d+)\.(\d+)", title.group(1))
    if not vm:
        fail(f"标题里没有版本号：{title.group(1)}")
    major, minor = vm.group(1), vm.group(2)
    version = f"V{major}.{minor}"
    print(f"  标题版本 : {version}  （{title.group(1)}）")

    hits = [p for p in sorted(RELEASES.glob("*.html")) if p.read_bytes() == data]
    if len(hits) != 1:
        fail(f"index.html 应恰好等于一个发布文件，实际命中 {len(hits)} 个：{[p.name for p in hits]}")
    release = hits[0]
    if f"_V{major}.{minor}_" not in release.name:
        fail(f"发布文件名版本与标题不一致：{release.name} vs {version}")
    print(f"  发布文件 : {release.name}  ({len(data):,} B)")
    print(f"  SHA256   : {sha(data)}")

    # Accept both historic build_vXX_from_main.py (OUT_NAME / BASE_SHA)
    # and additive build_vXX_from_vYY.py (NEW / BASE / EXPECTED).
    # Require exactly one matching builder; never merely match a filename token.
    builders = []
    for p in sorted((ROOT / "tools").glob("build_v*.py")):
        src = p.read_text(encoding="utf-8")
        out = re.search(r'OUT_NAME\s*=\s*"([^"]+)"', src)
        candidate = out.group(1) if out else None
        if candidate is None:
            m = re.search(r"NEW\s*=\s*ROOT\s*/\s*['\"]releases/([^'\"]+)['\"]", src)
            if m:
                candidate = m.group(1)
        if candidate == release.name:
            builders.append((p, src))
    if len(builders) != 1:
        fail(f"应恰好有一个构建器产出 {release.name}，实际 {len(builders)} 个：{[p.name for p, _ in builders]}")
    builder, bsrc = builders[0]
    base_name = re.search(r'BASE\s*=\s*RELEASES\s*/\s*"([^"]+)"', bsrc)
    base_sha = re.search(r'BASE_SHA\s*=\s*"([0-9A-Fa-f]{64})"', bsrc)
    if base_name and base_sha:
        # Legacy builders record the CRLF-canonicalized checksum.
        base_path = RELEASES / base_name.group(1)
        expected = base_sha.group(1).upper()
        actual = canonical_sha(base_path.read_bytes()) if base_path.is_file() else None
    else:
        # New frozen-release builder records the exact byte checksum.
        base_name = re.search(r"BASE\s*=\s*ROOT\s*/\s*['\"]releases/([^'\"]+)['\"]", bsrc)
        base_sha = re.search(r"EXPECTED\s*=\s*['\"]([0-9A-Fa-f]{64})['\"]", bsrc)
        if not base_name or not base_sha:
            fail(f"{builder.name} 里没有可识别的 BASE / checksum")
        base_path = RELEASES / base_name.group(1)
        expected = base_sha.group(1).upper()
        actual = sha(base_path.read_bytes()) if base_path.is_file() else None
    if actual != expected:
        fail(f"{builder.name} 的基线校验失败：{base_path.name}，声明 {expected}，实际 {actual}")
    print(f"  构建器   : {builder.name}  基线 {base_path.name}（哈希校验通过）")

    print("ENTRY CONSISTENCY PASS")

    if "--rebuild" in sys.argv[1:]:
        import subprocess
        print(f"\n  重建中：{builder.relative_to(ROOT)}")
        rc = subprocess.call([sys.executable, str(builder)], cwd=str(ROOT))
        if rc != 0:
            fail(f"重建失败：{builder.name} 退出码 {rc}")
        again = sha(INDEX.read_bytes())
        if again != sha(data):
            fail(f"重建后 index.html 与提交版本不同：{again}")
        print("  重建可复现：产物字节一致")


if __name__ == "__main__":
    main()
