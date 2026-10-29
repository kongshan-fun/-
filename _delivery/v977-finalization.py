from pathlib import Path
root=Path('.')
engine=root/'src/v977/engine.js'
addon='''
// A pre-V90.77 completion is preserved, never silently imported into the new
// ruleset board just because the player loaded the old character once.
const ascendRules977=Game.prototype.ascend;
Game.prototype.ascend=function(...args){
 const finished=this.s.ascended,result=ascendRules977.apply(this,args);
 if(!finished&&this.s.ascended&&this.s.ascensionRecord)this.s.ascensionRecord.ruleset='bigu-v977';
 return result;
};
const normalizeRules977=normalize;
normalize=function(raw,...args){
 const s=normalizeRules977(raw,...args);
 if(s.ascensionRecord&&raw?.ascensionRecord?.ruleset==='bigu-v977')s.ascensionRecord.ruleset='bigu-v977';
 return s;
};
'''
s=engine.read_text();assert 'const ascendRules977=' not in s;engine.write_text(s+addon)
p=root/'tools/build_v977_from_main.py';s=p.read_text();anchor="    patch(\"'shanye-v975-local-ascension-board-v1'\", \"'shanye-v977-local-ascension-board-v1'\")"
assert s.count(anchor)==1
s=s.replace(anchor,anchor+"\n    patch(\"if(!g.s.ascended||!a||a.race!==id)return null;\", \"if(!g.s.ascended||!a||a.race!==id||a.ruleset!=='bigu-v977')return null;\")")
p.write_text(s)
p=root/'tests/v974_p0_faults.cjs';s=p.read_text();assert s.count('difficulty:s.difficulty};return g}')==1
s=s.replace('difficulty:s.difficulty};return g}',"difficulty:s.difficulty,ruleset:'bigu-v977'};return g}");p.write_text(s)
new='''{
 const disk=storage(),slots=new S(disk),g=fixture(12);g.s.level=36;g.syncMajor();g.s.cleared.fill(true);g.s.ritual.fill(true);g.s.unlocked=12;g.s.zone=11;g.s.pos={x:7,y:5};g.s.xp=g.required;
 for(const[k,v]of Object.entries(D.ASCENSION_RULE.cost))g.s.inv[k]=v+1;
 ok(g.act('ascend').ok,'new ruleset actual ascension');
 eq(g.s.ascensionRecord.ruleset,'bigu-v977','completion stamps exact ruleset');
 slots.save('human',g,99);const reloaded=slots.read('human',99).game;
 eq(reloaded.s.ascensionRecord.ruleset,'bigu-v977','ruleset survives normalization');
 ok(!!slots.recordAscension('human',99,reloaded),'new ruleset may rank');
 const old=reloaded.state();old.ascensionRecord.runId='human:123:456:789';delete old.ascensionRecord.ruleset;
 const oldGame=new G(old);eq(slots.recordAscension('human',98,oldGame),null,'old completion cannot enter new board');
 eq(slots.leaderboard().records.length,1,'old completion does not modify new records');
}
'''
p2=root/'tests/v977_ruleset.cjs'
p2.write_text("'use strict';\nconst fs=require('fs'),vm=require('vm'),assert=require('assert/strict');const h=fs.readFileSync('index.html','utf8');const ss=[...h.matchAll(/<script\\b[^>]*>([\\s\\S]*?)<\\/script>/gi)].map(x=>x[1]);const c=vm.createContext({console});c.globalThis=c;for(let i=0;i<6;i++)vm.runInContext(ss[i],c);const {QGame:G,QData:D,QCharacterSlots:S}=c;let count=0;const ok=(a,m)=>{assert.ok(a,m);count++},eq=(a,b,m)=>{assert.equal(a,b,m);count++};const storage=()=>{const m=new Map();return{getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}};function fixture(){const g=new G();g.s.life.left=500*D.LIFE.yearMinutes;g.s.hunger=g.s.water=100;g.s.hp=g.s.maxHp;g.s.spirit=g.s.maxSpirit;return g;}\n"+new+"console.log('V90.77 ruleset isolation PASS',count);\n")
p=root/'tests/run_v977_acceptance.cjs';s=p.read_text();old="['V90.77 realm and energy arithmetic','node',['tests/v977_bigu.cjs']]";assert s.count(old)==1;s=s.replace(old,old+",['Speedrun ruleset isolation','node',['tests/v977_ruleset.cjs']]");p.write_text(s)
p=root/'tests/v977_browser.py';s=p.read_text();old="p.evaluate('Storage.prototype.setItem=window.origSet')";assert s.count(old)==1;s=s.replace(old,"p.evaluate('()=>{Storage.prototype.setItem=window.origSet;}')");p.write_text(s)
