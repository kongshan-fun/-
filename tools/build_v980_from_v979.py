#!/usr/bin/env python3
"""Deterministically add square-corner monochrome visual corrections to frozen V90.79.
No gameplay engine modules, ruleset or save format are touched."""
from pathlib import Path
import hashlib,re
ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'releases/山野修仙记_V90.79_纸墨精修.html'
NEW=ROOT/'releases/山野修仙记_V90.80_方正纸墨.html'
EXPECTED='F07260DD1CFC2AFB5B0219F811DE2B889F7269520E9409DB32EA39445C545EB9'

def build():
    b=BASE.read_bytes()
    assert hashlib.sha256(b).hexdigest().upper()==EXPECTED,'Frozen V90.79 baseline not recognized'
    s=b.decode('utf-8')
    css=(ROOT/'src/v980/style.css').read_text('utf-8')
    assert s.count('</head>')==1
    s=s.replace('</head>',f'<style id="v980-square-ink">\n{css}\n</style>\n</head>')
    rules=[
      ('山野修仙记 V90.79 · 纸墨精修','山野修仙记 V90.80 · 方正纸墨',1),
      ("D.RELEASE='V90.79';","D.RELEASE='V90.80';",2),
      ("subtitle='洞府百业 · V90.79'","subtitle='洞府百业 · V90.80'",1),
      ('V90.79 · ${game.difficulty.name}','V90.80 · ${game.difficulty.name}',1),
    ]
    for old,new,num in rules:
        assert s.count(old)==num,(old,s.count(old))
        s=s.replace(old,new)
    orig=[m.group(1) for m in re.finditer(r'<script\b[^>]*>([\s\S]*?)</script>',b.decode())]
    new=[m.group(1) for m in re.finditer(r'<script\b[^>]*>([\s\S]*?)</script>',s)]
    assert len(orig)==len(new)==10
    assert all(orig[i]==new[i].replace("D.RELEASE='V90.80';","D.RELEASE='V90.79';") for i in range(6))
    digest=hashlib.sha256(s.encode()).hexdigest().upper()
    (ROOT/'index.html').write_text(s,'utf-8')
    NEW.write_text(s,'utf-8')
    print(f'V90.80 built {len(s.encode()):,} bytes; SHA256 {digest}; 6 non-UI scripts identical except release labels')
if __name__=='__main__':build()
