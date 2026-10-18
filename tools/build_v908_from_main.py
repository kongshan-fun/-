#!/usr/bin/env python3
import base64,gzip,json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def apply(source,patch):
 p=json.loads(gzip.decompress(base64.b64decode((ROOT/patch).read_text().strip())))
 raw=source.encode()
 sha=hashlib.sha256(raw).hexdigest()
 if sha!=p["base_sha256"]: raise SystemExit(f"base SHA mismatch: {sha}")
 lines=source.splitlines(keepends=True)
 if len(lines)!=p["base_lines"]: raise SystemExit("base line count mismatch")
 out=[];cursor=0
 for op in p["ops"]:
  start,end=op["start"],op["end"]
  if start<cursor or end<start or end>len(lines): raise SystemExit("invalid patch interval")
  out.extend(lines[cursor:start]);out.append(op["replacement"]);cursor=end
 out.extend(lines[cursor:])
 text="".join(out)
 if len(text.splitlines(keepends=True))!=p["target_lines"]: raise SystemExit("target line count mismatch")
 actual=hashlib.sha256(text.encode()).hexdigest()
 if actual!=p["target_sha256"]: raise SystemExit(f"target SHA mismatch: {actual}")
 return text
def gitblob(s): return hashlib.sha1(b"blob "+str(len(s.encode())).encode()+b"\\0"+s.encode()).hexdigest()
if __name__=="__main__":
 base=(ROOT/"releases"/"山野修仙记_V90.6_十二阶储物袋与特殊储物袋版.html").read_text(encoding="utf-8")
 v7=apply(base,"patches/v907-from-main.json.gz.b64")
 v8=apply(base,"patches/v908-from-main.json.gz.b64")
 # Keep the hash-checked V90.8 gameplay patch immutable; apply release-title metadata after verification.
 old_title="<title>山野修仙记 V90.8 · 飞升结算与资质排行榜</title>"
 new_title="<title>山野修仙记 V90.8 · 五阶洞府与高阶炼制</title>"
 if v8.count(old_title)!=1: raise SystemExit("V90.8 title marker not found exactly once")
 v8=v8.replace(old_title,new_title,1)
 rel=ROOT/"releases";rel.mkdir(exist_ok=True)
 (rel/"山野修仙记_V90.7_飞升结算与本机资质榜.html").write_text(v7,encoding="utf-8")
 (rel/"山野修仙记_V90.8_五阶洞府与高阶炼制版.html").write_text(v8,encoding="utf-8")
 (ROOT/"index.html").write_text(v8,encoding="utf-8")
 print("V90.7 SHA256",hashlib.sha256(v7.encode()).hexdigest(),"GitBlob",gitblob(v7))
 print("V90.8 SHA256",hashlib.sha256(v8.encode()).hexdigest(),"GitBlob",gitblob(v8))
