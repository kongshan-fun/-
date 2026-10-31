#!/usr/bin/env python3
"""Byte-for-byte V90.81 TapTap patch restoration from the actual V90.80 submitted release.
The compressed splice data is stored in patches/v981_splices.xz.b64.
Original V90.80 is immutable; script writes new candidate path and index.html.
"""
from pathlib import Path
import base64, hashlib, json, lzma, re

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "releases/山野修仙记_V90.80_TapTap适配版.html"
TARGET = ROOT / "releases/山野修仙记_V90.81_TapTap修复候选.html"
PAYLOAD = ROOT / "patches/v981_splices.xz.b64"
SOURCE_BYTES = 1068198
SOURCE_SHA = "9C9949238554143AC514E0DBA07F925FCE9C68632AEB0A2372EE53835B9D0980"
TARGET_BYTES = 1077174
TARGET_SHA = "E2795E7F2A80E8B3E71688A4BF7F5C33EDAF27B9199D3FB33288EC5FFFE5FF4D"

def sha(raw):
    return hashlib.sha256(raw).hexdigest().upper()

def main():
    old = SOURCE.read_bytes()
    assert len(old) == SOURCE_BYTES and sha(old) == SOURCE_SHA, "Wrong TapTap submitted source!"
    encoded = PAYLOAD.read_text(encoding="ascii").strip()
    assert len(encoded) == 6952, "Incomplete transport payload"
    operations = json.loads(lzma.decompress(base64.b64decode(encoded, validate=True)).decode("utf8"))
    assert len(operations) == 33
    lines = old.decode("utf8").splitlines(keepends=True)
    for start, end, replacement in reversed(operations):
        assert isinstance(start,int) and isinstance(end,int) and 0 <= start <= end <= len(lines)
        assert isinstance(replacement,str)
        lines[start:end] = [replacement]
    rebuilt = "".join(lines).encode("utf8")
    assert len(rebuilt) == TARGET_BYTES, "Unexpected output length"
    assert sha(rebuilt) == TARGET_SHA, "Rebuilt game differs from tested candidate"
    # This does not turn mock SDK tests into a claim of TapTap platform certification.
    src_scripts = re.findall(r"<script\\b[^>]*>(.*?)</script>", old.decode("utf8"), re.S)
    new_scripts = re.findall(r"<script\\b[^>]*>(.*?)</script>", rebuilt.decode("utf8"), re.S)
    assert len(src_scripts) == len(new_scripts) == 12
    assert [i for i,(a,b) in enumerate(zip(src_scripts,new_scripts)) if a!=b] == [0,1,5,9]
    assert "SHANYE-V981-TT-P0SAFE" in rebuilt.decode("utf8")
    TARGET.write_bytes(rebuilt)
    (ROOT/"index.html").write_bytes(rebuilt)
    print(json.dumps({"release":str(TARGET),"bytes":len(rebuilt),"sha256":sha(rebuilt),"source_sha256":sha(old),"script_changes":[0,1,5,9]},ensure_ascii=False,indent=2))

if __name__ == "__main__":
    main()
