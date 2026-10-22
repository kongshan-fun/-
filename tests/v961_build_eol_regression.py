#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Regression: rebuilding frozen V90.61 must honor source line endings on Linux/Windows."""
from pathlib import Path
import hashlib
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / "tools" / "build_v961_from_main.py"
BASE_NAME = "山野修仙记_V90.60_破境分流.html"
OUT_NAME = "山野修仙记_V90.61_存档沿用.html"

def normalize(raw: bytes, newline: bytes) -> bytes:
    return raw.replace(b"\r\n", b"\n").replace(b"\n", newline)

def main():
    source = (ROOT / "releases" / BASE_NAME).read_bytes()
    frozen = (ROOT / "releases" / OUT_NAME).read_bytes()
    for name, newline in (("LF", b"\n"), ("CRLF", b"\r\n")):
        with tempfile.TemporaryDirectory(prefix="v961-eol-") as dirname:
            temp = Path(dirname)
            (temp / "tools").mkdir()
            (temp / "releases").mkdir()
            shutil.copyfile(BUILD, temp / "tools" / BUILD.name)
            (temp / "releases" / BASE_NAME).write_bytes(normalize(source, newline))
            p = subprocess.run(
                [sys.executable, str(temp / "tools" / BUILD.name)],
                cwd=temp, capture_output=True, text=True, encoding="utf-8", errors="replace"
            )
            if p.returncode:
                raise AssertionError(f"{name} build failed:\n{p.stdout}\n{p.stderr}")
            expected = normalize(frozen, newline)
            for path in (temp / "index.html", temp / "releases" / OUT_NAME):
                actual = path.read_bytes()
                if actual != expected:
                    raise AssertionError(
                        f"{name} reconstruction mismatch for {path.name}: "
                        f"{hashlib.sha256(actual).hexdigest()} != {hashlib.sha256(expected).hexdigest()}"
                    )
            print(f"V90.61 {name} deterministic rebuild PASS ({len(expected)} bytes)")
    print("V90.61 cross-platform EOL regression PASS 2/2")

if __name__ == "__main__":
    main()
