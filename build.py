"""Deterministic, dependency-free V14 standalone and documented game data build."""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parent
text=(ROOT/'index.html').read_text(encoding='utf-8')
for kind in ['style','entry']:
    text=text.replace(f'<link rel="stylesheet" href="src/{kind}.css">','<style>\n'+(ROOT/'src'/f'{kind}.css').read_text(encoding='utf-8')+'\n</style>')
for name in ['birth','help','data','engine','slots','entry','ui']:
    text=text.replace(f'<script src="src/{name}.js"></script>','<script>\n'+(ROOT/'src'/f'{name}.js').read_text(encoding='utf-8')+'\n</script>')
if re.search(r'(?:src|href)="src/',text):raise SystemExit('Unbundled local dependency')
out=ROOT/'青岚问道_V16_猎妖炼器.html'
out.write_text(text,encoding='utf-8')
print('Built',out.name,len(text.encode('utf-8')),'bytes')
