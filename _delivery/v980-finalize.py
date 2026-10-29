from pathlib import Path
import hashlib
p=Path('tests/v980_native_browser.py')
s=p.read_text(encoding='utf-8')
assert hashlib.sha256(s.encode()).hexdigest()=='2c465763b9a869c3bc97ad02b19a8cc0f8ea294ff6532389a5e954a4bc13aca5'
edits=[
 ("p.set_viewport_size(dict(width=320,height=568));ck(p.locator('.garden978-plot').count()==12,'短屏保留12格分页')",
  "p.set_viewport_size(dict(width=320,height=568));p.wait_for_function('document.querySelectorAll(\".garden978-plot\").length===12',timeout=6000);ck(p.locator('.garden978-plot').count()==12,'短屏保留12格分页')"),
 ("p.set_viewport_size(dict(width=390,height=844));ck(p.locator('.garden978-plot').count()==26,'恢复长屏后仍显示全部田地')",
  "p.set_viewport_size(dict(width=390,height=844));p.wait_for_function('document.querySelectorAll(\".garden978-plot\").length===26',timeout=6000);ck(p.locator('.garden978-plot').count()==26,'恢复长屏后仍显示全部田地')")
]
for old,new in edits:
    assert s.count(old)==1
    s=s.replace(old,new)
assert hashlib.sha256(s.encode()).hexdigest()=='6d66b4ba194b562320ae44891ada8e86573f99c2b44020cb50d5394c6ff64570'
p.write_text(s,encoding='utf-8')
print('Browser resize assertions now await the actual DOM threshold; no gameplay source changed')
