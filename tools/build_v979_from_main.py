#!/usr/bin/env python3
"""Deterministic presentation-only refinement from the accepted V90.78 release."""
from pathlib import Path
import hashlib,re
ROOT=Path(__file__).resolve().parents[1]
RELEASES=ROOT/'releases'
BASE=RELEASES/'山野修仙记_V90.78_洞府百业与灵田.html'
BASE_SHA='92A74E8E11CA671A40052988B5E00CD893B5D822574DEB2BBAC9FEF40993F794'
OUT_NAME='山野修仙记_V90.79_纸墨精修.html'
def main():
 raw=BASE.read_bytes();assert hashlib.sha256(raw).hexdigest().upper()==BASE_SHA,'V90.78 frozen baseline changed'
 text=raw.decode();src=ROOT/'src/v979'
 def replace(old,new,count=1):
  nonlocal text
  assert text.count(old)==count,(old[:100],text.count(old),count)
  text=text.replace(old,new)
 replace('</head>','<style id="v979-paper-ink">\n'+(src/'style.css').read_text()+'\n</style>\n</head>')
 replace("document.addEventListener('click',e=>{",(src/'ui.js').read_text()+"\ndocument.addEventListener('click',e=>{")
 replace('山野修仙记 V90.78 · 洞府百业与灵田','山野修仙记 V90.79 · 纸墨精修')
 replace("D.RELEASE='V90.78';","D.RELEASE='V90.79';",2)
 replace("subtitle='洞府百业 · V90.78'","subtitle='洞府百业 · V90.79'")
 replace('V90.78 · ${game.difficulty.name}','V90.79 · ${game.difficulty.name}')
 # Ruleset is intentionally garden-v978: no economic or simulation changes.
 before=[m.group(1) for m in re.finditer(r'<script\b[^>]*>([\s\S]*?)</script>',raw.decode())]
 after=[m.group(1) for m in re.finditer(r'<script\b[^>]*>([\s\S]*?)</script>',text)]
 assert len(before)==len(after)==10
 for i in range(6):assert before[i]==after[i].replace("D.RELEASE='V90.79';","D.RELEASE='V90.78';"),f'Non-UI script {i} changed'
 data=text.encode();(ROOT/'index.html').write_bytes(data);(RELEASES/OUT_NAME).write_bytes(data)
 print('V90.79 BUILD PASS',len(data),hashlib.sha256(data).hexdigest().upper(),'six non-UI scripts identical except release labels')
if __name__=='__main__':main()
