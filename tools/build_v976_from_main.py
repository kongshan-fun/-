#!/usr/bin/env python3
"""Deterministic V90.76 hotfix of frozen V90.75 H5. NEVER touches older release."""
from pathlib import Path
import hashlib
ROOT=Path(__file__).resolve().parents[1]
RELEASES=ROOT/'releases'
BASE=RELEASES / "山野修仙记_V90.75_洞天十二阶完整版.html"
BASE_SHA="0396642B2FAA9F93F26EE13842546FFA6F4895F86EF1E51540FEFD3877841043"
BASE_LF_SHA='123C4A9C5E709020C72A2568432609C0D8C570E1C7D748341C6E84A94975C202'
OUT_NAME="山野修仙记_V90.76_稳定性修复与通关验收.html"

def main():
    raw=BASE.read_bytes()
    canonical=raw.replace(b'\r\n',b'\n').replace(b'\n',b'\r\n')
    if hashlib.sha256(canonical).hexdigest().upper()!=BASE_SHA or hashlib.sha256(raw).hexdigest().upper()!=BASE_LF_SHA:
        raise RuntimeError('V90.75 frozen baseline SHA256 mismatch; refuse implicit rebuild')
    text=raw.decode('utf-8').replace('\r\n','\n')
    used=[]
    def patch(old,new,name):
        nonlocal text
        count=text.count(old)
        if count!=1:raise ValueError(f'{name}: require 1 anchor, got {count}: {old[:110]}')
        text=text.replace(old,new,1);used.append(name)
    def extension(relative):return (ROOT/relative).read_text(encoding='utf-8')
    patch('root.QAscensionScore=ascensionScore;root.QCharacterSlots=RaceSlots;',extension('src/v976/rescue_slots.js')+'\nroot.QAscensionScore=ascensionScore;root.QCharacterSlots=RaceSlots;','durable rescue ledger')
    patch('document.addEventListener(\'click\',e=>{',extension('src/v976/rescue_ui.js')+'\ndocument.addEventListener(\'click\',e=>{','resume rescue after reopening and save pending state')
    patch("if(lifeRescueReady()){showModal({kind:'life-rescue'});render();return result;}","if(lifeRescueReady()){persist();showModal({kind:'life-rescue'});render();return result;}",'persist rescue before showing decision')
    patch("(this.camp?'负伤返回洞府':'负伤返回旧营坪')","('负伤返回'+this.zone.name+'地图入口')",'defeat log location')
    patch("this.note(this.camp?'负伤回府 · 设施与仓库保留':'返回旧营坪 · 装备与境界保留','warn')","this.note('重伤返回'+this.zone.name+'入口 · 洞府与装备保留','warn')",'defeat toast location')
    patch("this.log('抵达'+(this.camp?this.campName():this.zone.name+'旧营坪'));return this.note(this.camp?'抵达自建洞府':'抵达旧营坪 · 尚未定居','ok');",
          "this.log('抵达'+this.zone.name+'地图入口');return this.note('抵达'+this.zone.name+'入口 · 全地图洞府可从固定按钮进入','ok');",'zone transition location')
    patch('未建洞府 · 抵达旧营坪','抵达地图入口 · 洞府全图共用','travel list global home wording')
    patch('if(v.status===\'ready\'){title=v.name;detail=v.realm;}','if(v.status===\'ready\'){title=v.name;detail=v.rescuePending?\'寿尽待救援 · 进入处理\':v.realm;}','rescue pending save cell')
    patch('图鉴成就 ${game.bookCount}/192','图鉴成就 ${game.bookCount}/${bookCatalogTotal976()}','dynamic codex achievement denominator')
    patch("function bookHomeBody(){", "function bookCatalogTotal976(){return bookRows().filter(r=>['life','mineral','tool','food','enemy','gear','home','bag'].includes(r.cat)).length;}\nfunction bookHomeBody(){",'single catalog counting source')
    patch("game.bookCount+'/'+bookRows().length","game.bookCount+'/'+bookCatalogTotal976()",'codex panel title denominator')
    patch("items.filter(r=>r.known||r.cat==='bag').length","items.filter(r=>r.known).length",'unowned storage bags not counted as known')
    patch("rows.filter(r=>r.known||r.cat==='bag').length","rows.filter(r=>r.known).length",'bag list discovery count')
    patch("globalThis.QData.DIFFICULTIES[mode].name+' · V90.64'","globalThis.QData.DIFFICULTIES[mode].name+' · '+globalThis.QData.RELEASE",'role page release label')
    patch("subtitle='洞天十二阶 · V90.75'", "subtitle='洞天十二阶 · V90.76'",'welcome header current release')
    patch("V90.75 · ${game.difficulty.name}", "V90.76 · ${game.difficulty.name}",'settings current release')
    patch("link.download='山野修仙记_V90.75_'", "link.download='山野修仙记_V90.76_'",'leaderboard exported filename release')
    patch("D.RELEASE='V90.75'","D.RELEASE='V90.76'",'single game release source')
    patch('山野修仙记 V90.75 · 洞天十二阶','山野修仙记 V90.76 · 逻辑收口','document title')
    # Retain curated, consistent explanations of game systems and optional side quests.
    patch('/* V90.75. Inserted inside the engine closure:', '/* V90.75. Inserted inside the engine closure:', 'engine anchor' ) if False else None
    patch("/* V12: twelve mortal-world regions",extension('src/v976/restored_help.js')+'\n/* V12: twelve mortal-world regions','restore old how-to encyclopedia') if False else None
    # Insert after complete V90.75 data augmentation (before the next script starts).
    anchor='for(const row of D.GUIDE){if(/定居|筑庐|洞府/.test(row.title||\'\'))row.text=\'点击固定洞府按钮，建造本世唯一洞府；换地图无需重建。\';}\n})(globalThis.QData);'
    patch(anchor,anchor+'\n'+extension('src/v976/restored_help.js'),'restore 22 curated help chapters')
    # Update two user-facing user guide fragments without changing historical evidence.
    # Patch one exact place in the exported-file naming; release remains V14 save schema.
    patch("a.download='山野修仙记_'+game.character.short", "a.download='山野修仙记_'+game.character.short",'no-op') if False else None
    data=text.encode('utf-8')
    (ROOT/'index.html').write_bytes(data)
    (RELEASES/OUT_NAME).write_bytes(data)
    print('V90.76 BUILD PASS',len(data),'bytes',hashlib.sha256(data).hexdigest().upper(),len(used),'verified source edits')
if __name__=='__main__':main()
