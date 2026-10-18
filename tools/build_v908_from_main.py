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

 # V90.8 UI hotfix: keep the equipment inspector fixed when the inventory enters its second row.
 # Apply after the original hash-verified patch; both released HTML files remain reproducible.
 for before,after,expected in [
  ("#panel-root .character-v92{display:flex;flex-direction:column;flex:1 1 auto;min-height:0;min-width:0;height:100%;color:inherit;background:var(--panel-bg,var(--surface,#fff))}","#panel-root .character-v92{display:grid;grid-template-rows:auto auto auto minmax(0,1fr) auto;flex:1 1 auto;min-height:0;min-width:0;height:100%;overflow:hidden;color:inherit;background:var(--panel-bg,var(--surface,#fff))}",1),
  ("#panel-root .character-gear-list.character-v92-grid{flex:1 1 0;min-height:0;min-width:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:minmax(108px,auto);align-content:start;gap:8px;padding:10px 11px 12px;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-gutter:auto;border:0}","#panel-root .character-gear-list.character-v92-grid{height:100%;min-height:0;min-width:0;align-self:stretch;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:minmax(108px,max-content);align-content:start;gap:8px;padding:10px 11px 12px;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-gutter:auto;border:0}",1),
  ("#panel-root .character-v92-inspector{flex:none;min-width:0;padding:9px 11px calc(9px + env(safe-area-inset-bottom));border-top:1px solid var(--line,#ddd);background:var(--panel-bg,var(--surface,#fff));box-shadow:0 -3px 10px #00000006}","#panel-root .character-v92-inspector{flex:none;height:calc(116px + env(safe-area-inset-bottom));max-height:calc(116px + env(safe-area-inset-bottom));min-height:0;min-width:0;display:flex;flex-direction:column;justify-content:space-between;overflow:hidden;padding:9px 11px calc(9px + env(safe-area-inset-bottom));border-top:1px solid var(--line,#ddd);background:var(--panel-bg,var(--surface,#fff));box-shadow:0 -3px 10px #00000006}",1),
  ("#panel-root .character-v92-inspect-main{display:flex;align-items:center;justify-content:space-between;gap:6px;min-width:0;margin-bottom:8px}","#panel-root .character-v92-inspect-main{flex:1 1 auto;min-height:0;overflow:hidden;display:flex;align-items:flex-start;justify-content:space-between;gap:6px;min-width:0;margin-bottom:6px}",1),
  ("#panel-root .character-v92-inspect-main small{display:block;margin-top:2px;font-size:11px;color:var(--muted,#777);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}","#panel-root .character-v92-inspect-main small{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;line-clamp:2;margin-top:2px;font-size:11px;color:var(--muted,#777);overflow:hidden;overflow-wrap:anywhere;white-space:normal}",1),
  ("#panel-root .character-v92-controls{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}","#panel-root .character-v92-controls{flex:none;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}",1),
  ("#panel-root .character-v92-inspector.is-empty{display:flex;justify-content:space-between;align-items:center;gap:6px;font-size:12px}","#panel-root .character-v92-inspector.is-empty{display:flex;flex-direction:row;justify-content:space-between;align-items:center;gap:6px;font-size:12px}",1),
  ("#panel-root .character-v92-inspector{padding-top:6px;padding-bottom:7px}","#panel-root .character-v92-inspector{height:calc(106px + env(safe-area-inset-bottom));max-height:calc(106px + env(safe-area-inset-bottom));padding-top:6px;padding-bottom:calc(7px + env(safe-area-inset-bottom))}",1),
  ("selected.refine>=3","selected.refine>=5",2),
 ]:
  if v8.count(before)!=expected: raise SystemExit("V90.8 UI rewrite marker missing or changed")
  v8=v8.replace(before,after)
 rel=ROOT/"releases";rel.mkdir(exist_ok=True)
 (rel/"山野修仙记_V90.7_飞升结算与本机资质榜.html").write_text(v7,encoding="utf-8")
 (rel/"山野修仙记_V90.8_五阶洞府与高阶炼制版.html").write_text(v8,encoding="utf-8")
 (ROOT/"index.html").write_text(v8,encoding="utf-8")
 print("V90.7 SHA256",hashlib.sha256(v7.encode()).hexdigest(),"GitBlob",gitblob(v7))
 print("V90.8 SHA256",hashlib.sha256(v8.encode()).hexdigest(),"GitBlob",gitblob(v8))
