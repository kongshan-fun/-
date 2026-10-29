#!/usr/bin/env python3
"""V90.78 reproducible staged build over the immutable V90.77 release."""
from pathlib import Path
import hashlib,re,argparse
ROOT=Path(__file__).resolve().parents[1]
RELEASES=ROOT/'releases'
BASE = RELEASES / "山野修仙记_V90.77_灵息辟谷.html"
BASE_SHA = "EB8FD4058B083545B048173772322C91E8E0127D030BC40D46D2029F217A5AC4"
BASE_LF_SHA='F73D2F9D68A2656C34B83BDDC2A9286154DC0ECCAD91A9E5B79D2A9E48981249'
OUT_NAME = "山野修仙记_V90.78_洞府百业与灵田.html"
def main(stage=5):
    raw=BASE.read_bytes().replace(b'\r\n',b'\n')
    assert hashlib.sha256(raw).hexdigest().upper()==BASE_LF_SHA,'Frozen V90.77 changed'
    text=raw.decode('utf-8');edits=[]
    def patch(old,new,n=1):
        nonlocal text
        if text.count(old)!=n:raise RuntimeError(f'Expected {n} anchors, got {text.count(old)}: {old[:140]}')
        text=text.replace(old,new);edits.append(old[:100])
    read=lambda f:(ROOT/'src/v978'/f).read_text(encoding='utf-8')
    # Extend existing scripts to preserve all historical pure-engine harnesses.
    scripts=list(re.finditer(r'<script\b[^>]*>([\s\S]*?)</script>',text))
    end=scripts[3].end(1)
    text=text[:end]+read('data.js')+(read('garden-data.js') if stage>=3 else '')+text[end:]
    patch('Game.normalize=normalize;Game.fresh=fresh;',read('stations.js')+(read('garden.js') if stage>=3 else '')+'\nGame.normalize=normalize;Game.fresh=fresh;')
    if stage>=3:patch('root.QAscensionScore=ascensionScore;root.QCharacterSlots=RaceSlots;',read('storage.js')+'\nroot.QAscensionScore=ascensionScore;root.QCharacterSlots=RaceSlots;')
    patch("document.addEventListener('click',e=>{",read('ui.js')+"\ndocument.addEventListener('click',e=>{")
    patch('</head>','<style>\n'+read('style.css')+'\n</style>\n</head>')
    patch('<button id="craft-button" data-a="panel" data-name="craft">炼制</button>','<button id="manuals-button" data-a="panel" data-name="manuals">功法</button>')
    patch("target=mapOpen?document.querySelector('#expand-map'):$('craft-button')","target=mapOpen?document.querySelector('#expand-map'):$('home-button')")
    # Player-facing copy audit C01-C11; immutable historical flags remain intact.
    patch("<span>道行 '+s.daoXp+'/150</span>","<span>修为 '+s.xp+'/'+game.required+'</span>")
    patch('现在仍须在原飞升入口按照150道行、劫雷晶×3、天门符×2结算，不会重复收取材料。','修满渡劫后期、平定十二图并备齐飞升材料，再到天门界碑飞升。可选终劫不额外收取飞升材料。')
    patch('飞升仍须按旧法交付道行与劫材','飞升仍须修满渡劫后期、平定十二图并备齐飞升材料')
    patch('寿元归零会结束本轮并清除进度。','寿尽时若本世尚有逆命机会，将先显示救援选择；接受轮回才结算。救援已用尽时按规则终结本世。')
    patch('抵达废弃营坪。先备工具，择地筑庐。','抵达山野。先备工具，点击洞府开辟本世住所。')
    patch('负重不足，先归营存仓','负重不足，请回洞府仓房整理')
    if stage>=3:
        patch("'shanye-v977-local-ascension-board-v1'","'shanye-v978-local-ascension-board-v1'")
        patch("a.ruleset!=='bigu-v977'","a.ruleset!=='garden-v978'")
    patch('山野修仙记 V90.77 · 灵息辟谷','山野修仙记 V90.78 · 洞府百业与灵田')
    patch("subtitle='灵息辟谷 · V90.77'","subtitle='洞府百业 · V90.78'")
    patch('V90.77 · ${game.difficulty.name}','V90.78 · ${game.difficulty.name}')
    patch('首次飞升计时 · V90.77 辟谷规则','首次飞升计时 · V90.78 灵田规则')
    patch("link.download='山野修仙记_V90.77_'","link.download='山野修仙记_V90.78_'")
    # Earlier data block precedes the v978 one, but remove stale release metadata.
    patch("D.RELEASE='V90.77';","D.RELEASE='V90.78';")
    data=text.encode('utf-8');(ROOT/'index.html').write_bytes(data)
    if stage>=5:(RELEASES/OUT_NAME).write_bytes(data)
    print('V90.78 BUILD',stage,'PASS',len(data),hashlib.sha256(data).hexdigest().upper(),len(edits),'validated edits')
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--stage',type=int,default=5,choices=[2,3,4,5]);main(p.parse_args().stage)
