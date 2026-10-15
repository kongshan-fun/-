"""Build a dependency-free single HTML file from the maintainable source tree."""
from pathlib import Path
import json, subprocess
ROOT=Path(__file__).resolve().parent
s=(ROOT/'index.html').read_text(encoding='utf8')
s=s.replace('<link rel="stylesheet" href="src/style.css">','<style>\n'+(ROOT/'src/style.css').read_text(encoding='utf8')+'\n</style>')
for file in ['data.js','engine.js','slots.js','ui.js']:
    s=s.replace('<script src="src/'+file+'"></script>','<script>\n'+(ROOT/'src'/file).read_text(encoding='utf8')+'\n</script>')
(ROOT/'青岚问道_V11_双角色独立存档.html').write_text(s,encoding='utf8')
print('Built',len(s.encode('utf8')),'bytes')
