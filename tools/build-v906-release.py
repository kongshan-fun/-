#!/usr/bin/env python3
"""Build audited V90.5 and V90.6 H5 releases from the frozen V90.4 GitHub baseline."""
from pathlib import Path
import json, hashlib
ROOT=Path(__file__).resolve().parents[1]
RELEASES=ROOT/"releases"
SOURCE=RELEASES/"山野修仙记_V90.4_主线子页面与通关验证版.html"
VERSIONS=[
 (SOURCE,"03dfcef743ecaed1b2f1662f2a181097676c7e02178c639afb98b1bd99db2ca3"),
 (RELEASES/"山野修仙记_V90.5_战斗平衡与顶部状态栏优化版.html","6a3c8578aebb20ad1724c51da729b7eed161d5fb1fa6df4d8926d6292d62bd0b"),
 (RELEASES/"山野修仙记_V90.6_十二阶储物袋与特殊储物袋版.html","855c0048c8650aa312e0448314da436a72bb5422e6ded6b026ee97d822b0b9dd")
]
def checked(s,sha,label):
    actual=hashlib.sha256(s.encode("utf-8")).hexdigest()
    if actual!=sha:raise ValueError(f"{label}: checksum mismatch {actual} != {sha}")
def apply_delta(source,patch):
    ops=json.loads(patch.read_text(encoding="utf-8"))
    out=[];cursor=0
    for start,end,replacement in ops:
        if not (cursor<=start<=end<=len(source)):raise ValueError("invalid delta interval")
        out.extend((source[cursor:start],replacement))
        cursor=end
    out.append(source[cursor:])
    return "".join(out)
if __name__=="__main__":
    source=VERSIONS[0][0].read_text(encoding="utf-8")
    checked(source,VERSIONS[0][1],"V90.4")
    for num,entry in [(5,VERSIONS[1]),(6,VERSIONS[2])]:
        source=apply_delta(source,ROOT/"patches"/f"v90{num}_delta.json")
        checked(source,entry[1],f"V90.{num}")
        entry[0].write_text(source,encoding="utf-8")
        print(f"V90.{num} verified: {len(source.encode('utf-8'))} bytes")
    entry=VERSIONS[2]
    (ROOT/"index.html").write_text(entry[0].read_text(encoding="utf-8"),encoding="utf-8")
    checked((ROOT/"index.html").read_text(encoding="utf-8"),entry[1],"main H5 index")
    print("H5 main index -> V90.6 PASS")
