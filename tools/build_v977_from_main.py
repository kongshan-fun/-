#!/usr/bin/env python3
"""V90.77 exact, frozen-source build. No runtime CDN or dependency required."""
from pathlib import Path
import hashlib
ROOT=Path(__file__).resolve().parents[1]
RELEASES=ROOT/'releases'
BASE = RELEASES / "山野修仙记_V90.76_稳定性修复与通关验收.html"
BASE_SHA = "BC2A45D6DA2AEBE046C502ABC20D6FD3A32DF91EF39BEBEA8A8D77DA6C26681E"
BASE_LF_SHA='68629D09E503A13DAC31C5C0E8CE27117ADF69344D5101A4855F48B0E99FF69D'
OUT_NAME = "山野修仙记_V90.77_灵息辟谷.html"
def main():
    source=BASE.read_bytes().replace(b'\r\n',b'\n')
    if hashlib.sha256(source).hexdigest().upper()!=BASE_LF_SHA:raise RuntimeError('Frozen V90.76 changed')
    text=source.decode('utf-8');edits=[]
    def patch(old,new,n=1):
        nonlocal text
        if text.count(old)!=n:raise RuntimeError(f'Anchor expected {n}, got {text.count(old)}: {old[:120]}')
        text=text.replace(old,new);edits.append(old[:100])
    read=lambda f:(ROOT/'src/v977'/f).read_text()
    patch("function fresh(seed=261014,character='human',birth=null,difficulty='challenge'){", "function _fresh977(seed=261014,character='human',birth=null,difficulty='challenge'){")
    patch("function normalize(raw,character='human',difficulty='challenge'){", "function _normalize977(raw,character='human',difficulty='challenge'){")
    patch('Game.normalize=normalize;Game.fresh=fresh;',read('engine.js')+'\nGame.normalize=normalize;Game.fresh=fresh;')
    # restForecast's returned costs are POST metabolism, never feed them back as
    # raw costs: otherwise passive reduction is applied twice and credit is lost.
    patch('return {...cost,mode,minutes,factor,hpGain,spiritGain,willCollapse,', 'return {...cost,rawHunger:h,rawWater:w,mode,minutes,factor,hpGain,spiritGain,willCollapse,')
    patch('this.tick(p.minutes,p.hungerCost,p.waterCost-this.extra(p.minutes).water,0)', 'this.tick(p.minutes,p.rawHunger,p.rawWater,0)',2)
    patch("document.addEventListener('click',e=>{",read('ui.js')+"\ndocument.addEventListener('click',e=>{")
    patch('</head>','<style>\n'+read('style.css')+'\n</style>\n</head>')
    patch('每回合自然消耗：灵力 ${roundSpirit} · 饱腹 1 · 饮水 ${1+game.extra(15).water}', '每回合：${game.character.energy} ${roundSpirit} · 饱腹 ${game.biguInfo().percent/100} · 饮水 ${game.biguInfo().percent/100+game.extra(15).water}（余量累计）',2)
    patch(' · 灵力 ${s.spirit}/${s.maxSpirit}</span>', ' · ${game.character.energy} ${s.spirit}/${s.maxSpirit}</span>')

    # Use the post-breakthrough HP ceiling for the successful-result preview.
    # The damage threshold still uses current HP; only the forecast is corrected.
    patch('const dmg=game.tribDamage,maxHp=s.maxHp,left=Math.max(0,maxHp-dmg),pct=Math.round(left/maxHp*100);',
          'const dmg=game.tribDamage,maxHp=s.maxHp,nextMaxHp=D.applyPills(D.statsForLevel(s.level+1),s).hp,left=Math.max(1,nextMaxHp-dmg),pct=Math.round(left/nextMaxHp*100);')
    patch('渡劫后剩余 ${pct}%', '成功后约 ${pct}% 气血')

    # Isolate local speedrun scores: changed nutrition makes older records unfair
    # to compare, but their old keys and records are not deleted or modified.
    patch("'shanye-v975-local-ascension-board-v1'", "'shanye-v977-local-ascension-board-v1'")
    patch("if(!g.s.ascended||!a||a.race!==id)return null;", "if(!g.s.ascended||!a||a.race!==id||a.ruleset!=='bigu-v977')return null;")
    patch("首次飞升计时</small>","首次飞升计时 · V90.77 辟谷规则</small>")
    for old,new in [("D.RELEASE='V90.76'","D.RELEASE='V90.77'"),('山野修仙记 V90.76 · 逻辑收口','山野修仙记 V90.77 · 灵息辟谷'),("subtitle='洞天十二阶 · V90.76'","subtitle='灵息辟谷 · V90.77'"),('V90.76 · ${game.difficulty.name}','V90.77 · ${game.difficulty.name}'),("link.download='山野修仙记_V90.76_'","link.download='山野修仙记_V90.77_'")]:patch(old,new)
    out=text.encode('utf-8');(ROOT/'index.html').write_bytes(out);(RELEASES/OUT_NAME).write_bytes(out)
    print('V90.77 BUILD PASS',len(out),hashlib.sha256(out).hexdigest().upper(),len(edits),'exact edits')
if __name__=='__main__':main()
