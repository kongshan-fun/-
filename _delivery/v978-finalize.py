from pathlib import Path
import hashlib
p=Path('tests/v978_browser.py')
s=p.read_text(encoding='utf-8')
old="p.evaluate('Storage.prototype.setItem=window.oldSet')"
new="p.evaluate('()=>{Storage.prototype.setItem=window.oldSet;delete window.oldSet;}')"
assert hashlib.sha256(s.encode()).hexdigest()=='da7983912918572236a873b31e97fb0edc215c2e955b8947a5375f2977873897','Unexpected browser test source'
assert s.count(old)==1
s=s.replace(old,new)
assert hashlib.sha256(s.encode()).hexdigest()=='adb40bb6e224f0a42970313eeac3b482d420ccdda7afa311407373fd7b15e8bd'
p.write_text(s,encoding='utf-8')
print('Fixed native Storage cleanup invocation; gameplay source and all assertions unchanged.')
