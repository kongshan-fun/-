#!/usr/bin/env python3
"""Deterministically rebuild V90.58 from immutable V90.57 and hash-locked overlay."""
from pathlib import Path
import hashlib,json
R=Path(__file__).resolve().parents[1]
BASE=R/'releases/山野修仙记_V90.57_渡劫主线修复与终劫闭环.html'
OUT=R/'releases/山野修仙记_V90.58_跨境与旧档补偿闭环版.html'
PATCH=R/'patches/v958_from_v957.json'
def sha(b):return hashlib.sha256(b).hexdigest()
def build():
 p=json.loads(PATCH.read_text(encoding='utf-8'))
 assert p['format']=='shanye-v958-line-overlay'
 raw=BASE.read_bytes()
 assert sha(raw)==p['base_sha256'],'V90.57 immutable baseline mismatched'
 lines=raw.decode('utf-8').replace('\r\n','\n').splitlines(keepends=True)
 assert len(lines)==p['base_lines']
 result=[];at=0
 for op in p['ops']:
  x,y=op['start'],op['end']
  assert at<=x<=y<=len(lines),'patch order invalid'
  result.extend(lines[at:x]);result.append(op['replacement']);at=y
 result.extend(lines[at:])
 text=''.join(result)
 assert len(text.splitlines(keepends=True))==p['target_lines']
 output=text.replace('\n','\r\n').encode('utf-8')
 assert sha(output)==p['target_sha256'],'result checksum mismatch'
 OUT.parent.mkdir(parents=True,exist_ok=True)
 OUT.write_bytes(output)
 (R/'index.html').write_bytes(output)
 assert (R/'index.html').read_bytes()==OUT.read_bytes()
 print('V90.58 REPRODUCIBLE BUILD PASS',len(output),sha(output))
if __name__=='__main__':build()
