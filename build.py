"""Build standalone HTML from the modular source (Python stdlib only)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
html = (ROOT / "index.html").read_text(encoding="utf-8")
css = (ROOT / "src/style.css").read_text(encoding="utf-8")
html = html.replace('<link rel="stylesheet" href="src/style.css">', '<style>\n' + css + '\n</style>')
for file in ("data.js", "engine.js", "ui.js"):
    js = (ROOT / "src" / file).read_text(encoding="utf-8")
    html = html.replace('<script src="src/' + file + '"></script>', '<script>\n' + js + '\n</script>')
out = ROOT / "青岚问道_V9_洞府营建.html"
out.write_text(html, encoding="utf-8")
print("Built", out.name, len(html.encode("utf-8")), "bytes")
