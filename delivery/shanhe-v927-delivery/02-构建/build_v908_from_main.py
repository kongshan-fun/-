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
def gitblob(s): return hashlib.sha1(b"blob "+str(len(s.encode())).encode()+b"\0"+s.encode()).hexdigest()
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

 # V90.8 rarity typography and drop/codex labels; never change item data or quality rolls.
 rarity_transforms = [
  ("const D=QData,$=id=>document.getElementById(id),esc=x=>String(x??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]));", "const D=QData,$=id=>document.getElementById(id),esc=x=>String(x??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c]));\nconst rarityMarkup=x=>esc(x).replace(/(普通|精良|灵器|法宝|仙器)(?=·|$|[ +：:])/g,m=>'<span class=\"rarity-'+({'普通':0,'精良':1,'灵器':2,'法宝':3,'仙器':4}[m])+'\">'+m+'</span>');", 1),
  ("<div class=\"reward-head\"><b>${esc(title)}</b><button type=\"button\" class=\"reward-dismiss\"", "<div class=\"reward-head\"><b>${rarityMarkup(title)}</b><button type=\"button\" class=\"reward-dismiss\"", 1),
  ("<div class=\"reward-entry\" role=\"listitem\">${esc(item)}</div>", "<div class=\"reward-entry\" role=\"listitem\">${rarityMarkup(item)}</div>", 1),
  ("<span>${esc(compact?title+' · '+entries.join(' · '):message)}</span>", "<span>${rarityMarkup(compact?title+' · '+entries.join(' · '):message)}</span>", 1),
  ("class=\"book-entry-title\">", "class=\"book-entry-title ${r.cat==='gear'?'codex-gear-name':''}\">", 1),
  ("book-detail-hero\"><div><h3>", "book-detail-hero\"><div><h3 class=\"${row.cat==='gear'?'codex-gear-name':''}\">", 1),
 ]
 for before,after,expected in rarity_transforms:
  if v8.count(before)!=expected: raise SystemExit("V90.8 rarity transform marker missing or changed")
  v8=v8.replace(before,after)

 # Apply the responsive containment audit to the versioned release and default entry together.
 head_marker="</head>\n<body>"
 if v8.count(head_marker)!=1: raise SystemExit("V90.8 head marker missing")
 if "v908-responsive-containment-audit" in v8: raise SystemExit("V90.8 containment audit duplicated")
 v8=v8.replace(head_marker,"<style id=\"v908-responsive-containment-audit\">\n/* V90.8: growing building descriptions must not disappear at the third text line. */\n#panel-root .building-card .building-effect{min-height:0;max-height:none;overflow:visible}\n\n/* Five rows of archive cells remain usable on short devices: scroll the grid, not the page. */\n.entry-save-content{min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain}\n.entry-save-grid{height:100%;min-height:340px;grid-template-rows:repeat(5,minmax(60px,1fr))}\n.entry-save-grid .entry-save-cell{min-height:60px}\n\n/* Detail frame retains a fixed boundary, while longer affix text scrolls inside it. */\n#panel-root .character-v92-inspect-main>div{display:flex;flex-direction:column;min-height:0;max-height:100%}\n#panel-root .character-v92-inspect-main small{display:block;-webkit-line-clamp:unset;line-clamp:unset;flex:1 1 auto;min-height:0;white-space:normal;overflow-wrap:anywhere;overflow-y:auto;overscroll-behavior:contain}\n\n@media(max-height:620px){\n  /* Compact the nonessential rows so a short screen still has a usable gear grid. */\n  #panel-root .character-v92-overview{padding:4px 8px}\n  #panel-root .character-v92-stats{display:none}\n  #panel-root .character-v92-equipped{padding:3px 8px 4px}\n  #panel-root .character-v92-sectionline{display:none}\n  #panel-root .character-v92-slot{min-height:40px;padding:3px 7px}\n  #panel-root .character-v92-slot-label,#panel-root .character-v92-slot>small{display:none}\n  #panel-root .character-v92-slot-row{margin:0}\n  #panel-root .character-v92-slot-row i{width:18px;height:18px}\n  #panel-root .character-v92-toolbar{padding:3px 7px}\n  #panel-root .character-v92-inspector{height:90px;max-height:90px;padding:4px 7px}\n  #panel-root .character-v92-controls button{min-height:30px}\n}\n@media(max-height:510px){\n  /* When the viewport cannot contain every fixed section, fall back to outer scrolling. */\n  #panel-root .panel-body.character-body-v92{overflow-y:auto!important;overflow-x:hidden!important}\n  #panel-root .character-v92{display:flex;flex-direction:column;height:auto;min-height:100%;overflow:visible}\n  #panel-root .character-gear-list.character-v92-grid{flex:0 0 138px;height:138px;min-height:138px}\n  #panel-root .character-v92-inspector{flex:none;height:90px;max-height:90px}\n}\n</style>\n"+head_marker,1)
 rarity_style = "<style id=\"v908-rarity-art\">\n/* V90.8 rarity typography: five original grades, presentation only. */\nbody:not(.theme-mono) .rarity-0,body:not(.theme-mono) .rarity-1,body:not(.theme-mono) .rarity-2,body:not(.theme-mono) .rarity-3,body:not(.theme-mono) .rarity-4{\n font-family:\"STKaiti\",\"KaiTi\",\"Kaiti SC\",\"Songti SC\",\"Noto Serif SC\",serif;font-weight:800;letter-spacing:.025em;\n -webkit-text-stroke:.18px rgba(255,255,255,.26);text-shadow:0 1px 0 rgba(22,31,28,.14);transition:filter .2s ease,text-shadow .2s ease;\n}\nbody:not(.theme-mono) .rarity-0{background-image:linear-gradient(180deg,#f1f3f5 0%,#b9c2ca 48%,#78848f 100%);background-clip:text;-webkit-background-clip:text;color:transparent!important;-webkit-text-fill-color:transparent;text-shadow:0 1px 0 rgba(40,50,58,.14)}\nbody:not(.theme-mono) .rarity-1{background-image:linear-gradient(180deg,#e4ffe9 0%,#80e2a2 48%,#278b58 100%);background-clip:text;-webkit-background-clip:text;color:transparent!important;-webkit-text-fill-color:transparent;text-shadow:0 0 5px rgba(77,210,125,.18)}\nbody:not(.theme-mono) .rarity-2{background-image:linear-gradient(180deg,#e4f7ff 0%,#83d5ff 46%,#2674c8 100%);background-clip:text;-webkit-background-clip:text;color:transparent!important;-webkit-text-fill-color:transparent;text-shadow:0 0 6px rgba(74,166,255,.22)}\nbody:not(.theme-mono) .rarity-3{background-image:linear-gradient(180deg,#fff0ff 0%,#d5a0ff 45%,#7d38c4 100%);background-clip:text;-webkit-background-clip:text;color:transparent!important;-webkit-text-fill-color:transparent;text-shadow:0 0 7px rgba(180,104,255,.25)}\nbody:not(.theme-mono) .rarity-4{\n background-image:linear-gradient(100deg,#fff5b5 0%,#ffb7dc 18%,#c5b2ff 36%,#91ddff 54%,#a9ffd0 72%,#fff0a0 88%,#fff5b5 100%);\n background-size:220% 100%;background-position:0% 50%;background-clip:text;-webkit-background-clip:text;color:transparent!important;-webkit-text-fill-color:transparent;\n -webkit-text-stroke:.22px rgba(255,255,255,.48);text-shadow:0 0 5px rgba(255,255,255,.3),0 0 10px rgba(255,157,218,.22),0 0 14px rgba(112,196,255,.18);animation:v908-prismatic-flow 8s linear infinite;\n}\n@keyframes v908-prismatic-flow{from{background-position:0% 50%}to{background-position:100% 50%}}\n@media(hover:hover){body:not(.theme-mono) .rarity-3:hover{filter:brightness(1.08)}body:not(.theme-mono) .rarity-4:hover{filter:brightness(1.12)}}\n.codex-gear-name{font-family:\"STKaiti\",\"KaiTi\",\"Kaiti SC\",\"Songti SC\",\"Noto Serif SC\",serif!important;font-weight:750!important;letter-spacing:.025em}\n.book-entry-link.vis-book-gear .codex-gear-name,.book-detail-card.vis-book-gear .book-detail-hero .codex-gear-name{color:var(--ink,#385a64)!important;text-shadow:0 1px 0 rgba(255,255,255,.4)}\nbody.theme-immortal .book-entry-link.vis-book-gear .codex-gear-name,body.theme-immortal .book-detail-card.vis-book-gear .book-detail-hero .codex-gear-name{color:#a9dcff!important;text-shadow:0 0 7px rgba(107,194,255,.16)}\nbody.theme-mono .rarity-0,body.theme-mono .rarity-1,body.theme-mono .rarity-2,body.theme-mono .rarity-3,body.theme-mono .rarity-4{background:none!important;color:inherit!important;-webkit-text-fill-color:currentColor!important;-webkit-text-stroke:0!important;text-shadow:none!important;animation:none!important;font-family:inherit;letter-spacing:normal}\n@media(prefers-reduced-motion:reduce){body:not(.theme-mono) .rarity-4{animation:none;background-position:50% 50%}}\n</style>\n"
 if v8.count(head_marker)!=1: raise SystemExit("V90.8 rarity style insertion marker missing")
 v8=v8.replace(head_marker,rarity_style+head_marker,1)
 rel=ROOT/"releases";rel.mkdir(exist_ok=True)
 (rel/"山野修仙记_V90.7_飞升结算与本机资质榜.html").write_text(v7,encoding="utf-8")
 (rel/"山野修仙记_V90.8_五阶洞府与高阶炼制版.html").write_text(v8,encoding="utf-8")
 (ROOT/"index.html").write_text(v8,encoding="utf-8")
 print("V90.7 SHA256",hashlib.sha256(v7.encode()).hexdigest(),"GitBlob",gitblob(v7))
 print("V90.8 SHA256",hashlib.sha256(v8.encode()).hexdigest(),"GitBlob",gitblob(v8))
