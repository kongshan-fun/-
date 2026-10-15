"""Verify and unpack the authored V14 source delta once; no runtime dependency.
The base Git blob hash and each resulting SHA-256 are checked before any writes.
An installed marker makes subsequent development runs a no-op.
"""
from pathlib import Path
import hashlib
import json
import lzma

ROOT = Path(__file__).resolve().parents[1]
MARKER = ROOT / 'docs/V14_source_manifest.json'
PACK_SHA = 'd6293e5b010753447179dbe6261176ff40138820af5b04ab1612425e364eb758'
BASE = '06959bd714cfd30292ba8d8125d152d251e94fde'
ALLOWED = {
    'README.md', 'AGENTS.md', 'build.py', 'build_docs.py', 'index.html',
    'src/birth.js', 'src/data.js', 'src/engine.js', 'src/entry.css', 'src/entry.js',
    'src/help.js', 'src/slots.js', 'src/style.css', 'src/ui.js',
    'tests/v14_ascension.test.js', 'tests/v14_browser.py', 'tests/v14_campaign.test.js',
    'tests/v14_core.test.js', 'tests/v14_lifespan.test.js', 'tests/v14_onboarding.py',
    'tests/v14_races.test.js', 'docs/V14_验收说明.md',
}

def install():
    if MARKER.exists():
        if json.loads(MARKER.read_text(encoding='utf8')).get('version') != 14:
            raise ValueError('Unexpected installed marker')
        print('V14 source already installed; preserving subsequent edits.')
        return
    packed = b''.join((ROOT / f'tools/v14-delivery/part{i:02}.xz').read_bytes() for i in range(1, 8))
    if hashlib.sha256(packed).hexdigest() != PACK_SHA:
        raise ValueError('Delivery payload hash mismatch')
    payload = json.loads(lzma.decompress(packed).decode('utf8'))
    if payload.get('base') != BASE or payload.get('version') != 14 or set(payload.get('files', {})) != ALLOWED:
        raise ValueError('Unexpected delivery scope')
    output = {}
    for name, spec in payload['files'].items():
        path = ROOT / name
        if ROOT not in path.resolve().parents:
            raise ValueError('Unsafe path')
        if 'text' in spec:
            text = spec['text']
        else:
            old = path.read_bytes()
            blob = hashlib.sha1(b'blob ' + str(len(old)).encode() + b'\0' + old).hexdigest()
            if blob != spec['baseGitSha']:
                raise ValueError(f'Base content changed: {name}')
            lines = old.decode('utf8').splitlines(keepends=True)
            ops = spec['ops']
            if any(not (isinstance(a, int) and isinstance(b, int) and 0 <= a <= b <= len(lines)) for a, b, _ in ops):
                raise ValueError('Invalid delta ranges')
            for start, end, replacement in reversed(ops):
                lines[start:end] = [replacement]
            text = ''.join(lines)
        raw = text.encode('utf8')
        if hashlib.sha256(raw).hexdigest() != spec['sha256']:
            raise ValueError(f'Final content hash mismatch: {name}')
        output[name] = raw
    # All source files have been verified; now install the complete candidate.
    for name, raw in output.items():
        path = ROOT / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(raw)
    MARKER.parent.mkdir(parents=True, exist_ok=True)
    MARKER.write_text(json.dumps({'version': 14, 'base': BASE, 'payloadSha256': PACK_SHA,
        'files': {name: hashlib.sha256(raw).hexdigest() for name, raw in output.items()}},
        ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    print(f'Installed {len(output)} verified V14 source files.')

if __name__ == '__main__':
    install()
