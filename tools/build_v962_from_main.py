#!/usr/bin/env python3
"""V90.62 deterministic, SHA-pinned rebuild of the V90.61 release.
Usage: python3 tools/build_v962_from_main.py --check
"""
from pathlib import Path
import hashlib, json, sys
root=Path(__file__).resolve().parents[1]
manifest=json.loads((root/'patches/v962_from_v961.json').read_text(encoding='utf-8'))
raw=(root/manifest['baseFile']).read_bytes()
def blob(b): return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
assert blob(raw)==manifest['baseGitBlobSha'], 'V90.61 frozen baseline blob mismatch'
text=raw.decode('utf-8')
for patch in manifest['changes']:
    original,replacement=patch['from'],patch['to']
    assert text.count(original)==1, f"anchor {patch['label']} mismatch: {text.count(original)}"
    text=text.replace(original,replacement,1)
out=text.encode('utf-8')
assert blob(out)=='a752877eaa007c939ae253b508e1199202a86834', 'V90.62 output hash mismatch'
index=root/'index.html';release=root/manifest['outputFile']
if '--check' in sys.argv:
    assert index.read_bytes()==out, 'index.html not deterministic'
    assert release.read_bytes()==out, 'release html not deterministic'
else:
    index.write_bytes(out);release.write_bytes(out)
print('V90.62 BUILD PASS; bytes=',len(out),'sha256=',hashlib.sha256(out).hexdigest())
