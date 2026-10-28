#!/usr/bin/env python3
"""Build V90.75 deterministically from the frozen, tested V90.74 candidate.
All source edits require exact anchors. Historical releases are never overwritten.
"""
from pathlib import Path
import hashlib,re
ROOT=Path(__file__).resolve().parents[1]
RELEASES=ROOT/'releases'
BASE = RELEASES / "山野修仙记_V90.74_存档安全修复版.html"
BASE_SHA = "AFCE09AA068A8C36E74950B058567FB0404E4D683D6A8E01F1F566F60E0BB016"
OUT_NAME = "山野修仙记_V90.75_洞天十二阶完整版.html"
BASE_LF_SHA='6B74BC132169627F774FE7004192BFEA4444A6ECEEE4256D4DE4B870E01170A8'
def main():
    text=BASE.read_bytes().replace(b'\r\n',b'\n').decode('utf-8')
    if hashlib.sha256(text.encode()).hexdigest().upper()!=BASE_LF_SHA:raise SystemExit('Frozen V90.74 baseline changed')
    applied=[]
    def replace(old,new,count=1):
        nonlocal text
        n=text.count(old)
        if n!=count:raise RuntimeError(f'Anchor expected {count}, found {n}: {old[:100]}')
        text=text.replace(old,new)
        applied.append(old[:80])
    def region(start,end,new):
        nonlocal text
        if text.count(start)!=1 or text.count(end)!=1:raise RuntimeError('Ambiguous region '+start[:70])
        a=text.index(start); b=text.index(end,a)
        text=text[:a]+new+text[b:]
    data=(ROOT/'src/v975/data.js').read_text()
    engine=(ROOT/'src/v975/engine.js').read_text()
    ui=(ROOT/'src/v975/ui.js').read_text()
    css=(ROOT/'src/v975/style.css').read_text()
    replace("if(typeof module!=='undefined'&&module.exports)module.exports=D;\n})(globalThis);", "if(typeof module!=='undefined'&&module.exports)module.exports=D;\n})(globalThis);\n"+data)
    replace("function fresh(seed=261014,character='human',birth=null,difficulty='challenge'){", "function _fresh975(seed=261014,character='human',birth=null,difficulty='challenge'){")
    replace("function normalize(raw,requestedCharacter='human',expectedDifficulty='challenge'){", "function _normalize975(raw,requestedCharacter='human',expectedDifficulty='challenge'){")
    replace('Game.normalize=normalize;Game.fresh=fresh;',engine+'\nGame.normalize=normalize;Game.fresh=fresh;')
    replace("level:integer(c.level,1,5)","level:integer(c.level,1,12)")
    replace("(Array.isArray(old?.storedGears)?old.storedGears:[]).slice(0,36)","(Array.isArray(old?.storedGears)?old.storedGears:[]).slice(0,2000)")
    replace("const v=integer(raw?.[k]);if(v)b[k]=v;", "const v=integer(raw?.[k],0,100000000);if(v)b[k]=v;")
    replace("if(vault.length>=36)return this.fail('仓库装备栏已满（36件）');", "if(vault.length>=this.vaultGearCapacity)return this.fail('仓库装备栏已满（'+this.vaultGearCapacity+'件），请升级仓房');")
    replace("storedGears.length>=36:game.s.gears.length>=36", "storedGears.length>=game.vaultGearCapacity:game.s.gears.length>=36")
    replace("sp=[0,24,28,36,44,54][q]", "sp=Math.round((24+q*6)*(1+Math.max(0,this.realmIndex-1)*.12))")
    # Shared-home awareness in guide rewards and encyclopedia; normalizer remains isolated.
    replace("this.s.inv.axe||this.s.settlements.some(c=>c?.stash.axe)","this.s.inv.axe||this.camp?.stash.axe")
    replace("...this.s.settlements.flatMap(c=>c?.storedGears||c?.gears||[])","...(this.camp?.storedGears||[])")
    replace("const best=Math.max(0,...s.settlements.map(c=>game.roomLevel(id,c)));", "const best=game.roomLevel(id);")
    region("const spiritRetry=Object.create(null);", "class Game{", """let spiritRetry=new WeakMap();
function spiritRetryCount(g){return g?Math.min(6,spiritRetry.get(g)||0):0;}
function spiritRetryBump(g){if(g)spiritRetry.set(g,Math.min(6,(spiritRetry.get(g)||0)+1));}
function spiritRetryReset(){spiritRetry=new WeakMap();}
""")
    replace("if(this.s.combat)return this.fail('斗法中不能赋灵');", "if(this.s.combat)return this.fail('斗法中不能赋灵');\n  if(!this.workshop||this.roomLevel('forge')<1)return this.fail('请进入已建炼器室的洞府赋灵');")
    replace("const locks=Array.isArray(locked)?locked.filter(i=>Number.isInteger(i)&&i>=0&&i<total):[];", "const locks=Array.isArray(locked)?[...new Set(locked.filter(i=>Number.isInteger(i)&&i>=0&&i<total&&g.affixes[i]))]:[];\n  if(locks.length===total)return this.fail('至少保留一个未锁定的词条槽');")
    replace("if(!this.enough({stone:cost.stone}))return this.fail('灵石不足（需'+cost.stone+'）');", "if(!this.enough({stone:cost.stone}))return this.fail('灵石不足（需'+cost.stone+'）');\n  if(this.s.xp<cost.xp)return this.fail('修为不足（现有'+this.s.xp+'，需'+cost.xp+'；采集、战斗或吐纳可获取）');")
    # Use the configured carried supplies, retaining the normal battle-turn settlement.
    region("  }else if(mode==='heal'){", "  if(!b.training&&!this.tick(15,1,1,2))", """  }else if(mode==='heal'||mode==='mana'){
   const slot=mode==='heal'?0:1,item=id||this.s.quickSlots[slot];
   if(D.SUPPLIES[item]?.kind!==D.QUICK_KINDS[slot])return this.fail('补给类型不匹配');
   if(b.training&&mode==='heal'&&!b.virtualHeals)return this.fail('练习药已用完');
   const used=this.useSupply(item,true,b.training);if(!used.ok)return used;
   if(b.training&&mode==='heal')b.virtualHeals--;
  }
""")
    oldheal="${game.character.healSpell?'回春术':'回春散'}<small>${game.character.healSpell&&s.spirit>=14?'灵力−14':b.training?'练习药'+b.virtualHeals:'药'+(s.inv.salve||0)}"
    replace(oldheal,"${esc(quickLabel975(0))}<small>${b.training?'练习药'+b.virtualHeals:'余'+(s.inv[s.quickSlots[0]]||0)}",2)
    replace("回灵丹<small>${b.training?'练习用':'余'+(s.inv.mana||0)}", "${esc(quickLabel975(1))}<small>${b.training?'练习用':'余'+(s.inv[s.quickSlots[1]]||0)}",2)
    # Preserve original bytes before the first automatic new-schema save.
    anchor="root.QAscensionScore=ascensionScore;root.QCharacterSlots=RaceSlots;"
    extra="""
const saveBeforeHome975=RaceSlots.prototype.save;
RaceSlots.prototype.save=function(id,g,n=1,options={}){
 this.check(id);this.slot(n);
 for(const key of [this.key(id,n),this.backupKey(id,n)]){
  const raw=this.readKey(key);if(!raw)continue;
  let old;try{old=JSON.parse(raw);}catch{continue;}
  if(old.version===14&&old.rebuilt&&old.homeSchema!==1){
   const archive=this.key(id,n)+'-pre-global-home-v975',prior=this.readKey(archive);
   if(!prior)this.storage.setItem(archive,raw);
   if(!this.readKey(archive))throw Error('升级前原档归档失败，取消保存');
   if(!prior&&this.readKey(archive)!==raw)throw Error('升级前原档读回校验失败，取消保存');
   break;
  }
 }
 return saveBeforeHome975.call(this,id,g,n,options);
};
"""
    replace(anchor,extra+anchor)
    replace("'shanye-v907-local-ascension-board-v1'", "'shanye-v975-local-ascension-board-v1'")
    replace("   s.stageIndex===3?", "   game.stageIndex===3?")
    replace("const full=s.stageIndex===3&&s.xp>=game.required;", "const full=game.stageIndex===3&&s.xp>=game.required;")
    # UI integration is in the same closure, keeping ten script blocks and offline packaging.
    replace("document.addEventListener('click',e=>{", ui+"\ndocument.addEventListener('click',e=>{")
    replace("const names={'quest-guide'", "const names={quicksetup:'快捷补给配置','quest-guide'")
    replace("const content=panel==='birth'?", "const content=panel==='quicksetup'?quicksetupBody():panel==='birth'?")
    replace("$('berry-count').textContent=s.inv.berry||0;$('water-count').textContent=s.inv.water||0;$('salve-count').textContent=s.inv.salve||0;", "renderQuick975();")
    replace("const htmlUnused975='';", "") if False else None
    start='<div class="supplies"><button id="food-button"'
    a=text.index(start);b=text.index('</div>',a)+6
    text=text[:a]+'<div class="supplies" id="supply-slots"></div>'+text[b:]
    replace('<button id="stop-button" data-a="stop" disabled>停步</button>', '<button id="stop-button" data-a="stop" disabled>停步</button><button data-a="quick-config">配置</button>')
    # Keep the rest control accessible without stealing a supply slot.
    replace('<span id="weight-caption"></span>', '<span id="weight-caption"></span><button id="rest-button" data-a="quick-rest">调息</button>')
    replace("spiritRetryReset();panel='craft';", "QGame.resetSpiritRetry();panel='craft';")
    replace('</head>', '<style>\n'+css+'\n</style>\n</head>')
    # Visible version and stale location language. Historical functions stay optional.
    text=text.replace('V90.74 · 存档安全修复','V90.75 · 洞天十二阶').replace('V90.74 ·','V90.75 ·').replace("subtitle='三档难度 · V90.74'", "subtitle='洞天十二阶 · V90.75'")
    text=text.replace('每境仓库独立。','全地图共用当前角色仓库；超容量迁入物资不会被截断。')
    text=text.replace('本境仓房','洞府仓房')
    text=text.replace('本境洞府','洞府').replace('本境自己的洞府','自己的洞府').replace('本境仓库','洞府仓库')
    text=text.replace('身处洞府','身处洞府').replace('府 自建洞府','府 固定入口').replace('三档难度 · V90.73','洞天十二阶 · V90.75')
    text=text.replace('寻找营地 · 择地筑庐','点击洞府 · 建造一次').replace('其他地图不能隔空使用本仓。','返回探索后不能远程取仓物。')
    text=text.replace('最高开放第 ', '最高开放第 ')
    text=text.replace('本机飞升榜.json', '本机飞升榜.json').replace('山野修仙记_V90.64_', '山野修仙记_V90.75_')
    # Correct the travel-lock copy's indexing of the realm table.
    text=text.replace("D.REALM12[(i+2)-1]?.human", "(D.REALM12[game.s.character]||D.REALM12.human)[Math.min(11,i)]")
    out=text.encode('utf-8');(ROOT/'index.html').write_bytes(out);(RELEASES/OUT_NAME).write_bytes(out)
    print('V90.75 BUILD PASS',len(out),'bytes',hashlib.sha256(out).hexdigest().upper(),len(applied),'exact edits')
if __name__=='__main__':main()
