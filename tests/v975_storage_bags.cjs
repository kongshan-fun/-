'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const files={
 old:path.join(root,'releases','山野修仙记_V90.5_战斗平衡与顶部状态栏优化版.html'),
 latest:path.join(root,'index.html')
};
function load(filename){
 const html=fs.readFileSync(filename,'utf8');
 const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
 assert.equal(scripts.length,10); scripts.forEach((s,i)=>new vm.Script(s,{filename:'inline-'+i+'.js'}));
 const ctx=vm.createContext({console});ctx.globalThis=ctx;
 for(let i=0;i<=5;i++)vm.runInContext(scripts[i],ctx,{timeout:15000});
 return {D:ctx.QData,G:ctx.QGame,Slots:ctx.QCharacterSlots,scripts,html};
}
const prev=load(files.old),now=load(files.latest),baseline=load(path.join(root,'releases','山野修仙记_V90.74_存档安全修复版.html'));
const {G:Game,D,Slots}=now;
let checks=0;
const check=(title,ok)=>{assert.ok(ok,title);checks++;};
function fixture(role='human',seed=312006){
 const g=new Game(Game.fresh(seed,role),seed,role);
 g.s.level=36;g.syncMajor();g.s.maxHp=D.statsForLevel(36).hp;g.s.hp=g.s.maxHp;g.s.maxSpirit=D.statsForLevel(36).spirit;g.s.spirit=g.s.maxSpirit;
 g.s.hunger=g.s.water=100;g.s.atHome=true;g.s.homestead={pos:{x:1,y:5},level:12,buildings:{forge:12,warehouse:12,alchemy:12},stash:{},storedGears:[],foundedAt:420,farmAt:420};
 g.s.unlocked=12;g.s.cleared.fill(true);g.s.ritual.fill(true);
 return g;
}
const bags=D.STORAGE_BAGS;
check('14 storage artifacts',bags.length===14);
check('12 ordinary stages with monotonic bonuses',bags.filter(b=>b.tier).length===12&&bags.filter(b=>b.tier).every((b,i)=>b.tier===i+1&&(i===0||b.bonus>bags[i-1].bonus)));
check('void > slayer > highest normal',bags.find(b=>b.id==='bagVoid').bonus>bags.find(b=>b.id==='bagSlayer').bonus&&bags.find(b=>b.id==='bagSlayer').bonus>bags[11].bonus);
for(let i=0;i<12;i++){
 const b=bags[i],r=D.RECIPES.find(r=>r.id===b.id);
 check(`rank ${i+1} recipe complete`,r&&r.type==='储物袋'&&r.storageBag===b.id&&r.zone===i&&r.tier===b.forgeTier&&Object.values(r.cost).every(n=>n>=2));
 check(`rank ${i+1} recipe material IDs known`,Object.keys(r.cost).every(id=>D.ITEMS[id]&&D.ITEMS[id].wt>=0));
}
const g=fixture();const originalCapacity=g.capacity;
check('no bag base capacity unchanged',g.storageBonus===0&&g.capacity===g.baseCapacity);
function restock(game,recipe){Object.assign(game.s.inv,Object.fromEntries(Object.entries(recipe.cost).map(([k,v])=>[k,v+8])));game.s.spirit=game.s.maxSpirit;game.s.hp=game.s.maxHp;game.s.hunger=game.s.water=100;}
for(let i=0;i<12;i++){
 const b=bags[i],r=D.RECIPES.find(r=>r.id===b.id);
 restock(g,r);const before=g.s.stats.crafted;
 const result=g.craft(r.id);
 check(`rank ${i+1} crafted`,result.ok&&g.hasStorageBag(b.id)&&g.s.stats.crafted===before+1);
 check(`rank ${i+1} carries maximum only`,g.storageBonus===b.bonus&&g.capacity===g.baseCapacity+b.bonus);
 const inv=JSON.stringify(g.s.inv);const repeated=g.craft(r.id);
 check(`rank ${i+1} once, duplicate rejected without consuming`,repeated.ok===false&&JSON.stringify(g.s.inv)===inv);
 check(`rank ${i+1} no ghost inventory stack`,!Object.hasOwn(g.s.inv,b.id)&&!Object.hasOwn(D.ITEMS,b.id));
}
check('no recipes for unique bags',!D.RECIPES.some(r=>['bagSlayer','bagVoid'].includes(r.id)));
const saved=Game.normalize(g.state(),'human');
check('all twelve ranks survive JSON and normalization',bags.slice(0,12).every(b=>saved.storageBags[b.id]===true));
check('capacity still highest after save',new Game(g.state(),312006,'human').storageBonus===bags[11].bonus);
const oldRaw=prev.G.fresh(8888,'human');
check('previous version generated valid old state',oldRaw.version===14&&!oldRaw.storageBags);
const migr=new Game(oldRaw,8888,'human');
check('previous V90.5 save imports with no bags',migr.storageBonus===0&&Object.keys(migr.s.storageBags).length===0);
const slayer=fixture('human',333);
slayer.s.stats.kills=99;slayer.s.attack=1000;
check('before 100 no slayer',!slayer.hasStorageBag('bagSlayer'));
slayer.startBattle('wolf');slayer.s.combat.hp=1;
check('real kill resolves',slayer.fight('attack').ok);
check('100th kill gives one slayer bag',slayer.s.stats.kills===100&&slayer.hasStorageBag('bagSlayer')&&slayer.storageBonus===780);
check('slayer survives reloading',new Game(slayer.state(),333,'human').hasStorageBag('bagSlayer'));
const training=fixture('human',444);training.s.stats.kills=99;training.s.attack=1000;
training.startBattle('dummy');training.s.combat.hp=1;training.fight('attack');
check('training does not count kill or grant slayer',training.s.stats.kills===99&&!training.hasStorageBag('bagSlayer'));
const legacy=prev.G.fresh(9999,'human');legacy.stats.kills=120;
const oldProgress=new Game(legacy,9999,'human');
check('existing 100+ kill archives retroactively grant slayer',oldProgress.hasStorageBag('bagSlayer'));
const drop=fixture('human',555);
drop.s.secretRealm={zone:0,x:2,y:2,done:[],reward:false};drop.secretCellKind=()=> 'event';
let draw=0; drop.random=()=>{draw++;return .009999;};
const secretResult=drop.secretAction();
check('completed new secret node rolls 1% and drops void',secretResult.ok&&draw===1&&drop.hasStorageBag('bagVoid')&&drop.storageBonus===1250);
const savedDraw=draw;const repeat=drop.secretAction();
check('same secret node never double rolls',repeat.ok===false&&draw===savedDraw);
check('void persists',new Game(drop.state(),555,'human').hasStorageBag('bagVoid'));
const miss=fixture('human',556);miss.s.secretRealm={zone:0,x:2,y:2,done:[],reward:false};miss.secretCellKind=()=> 'event';
miss.random=()=>0.01;
miss.secretAction();
check('exact boundary 1% excludes .01',!miss.hasStorageBag('bagVoid'));
const fightDrop=fixture('human',557);fightDrop.s.secretRealm={zone:0,x:2,y:2,done:[],reward:false};
fightDrop.s.attack=900;fightDrop.startBattle('wolf');fightDrop.s.combat.secretCell=4;fightDrop.s.combat.hp=1;
let draws=0;fightDrop.random=()=>{draws++;return 0.001;};fightDrop.fight('attack');
check('secret battle completion yields exactly one eligibility',fightDrop.hasStorageBag('bagVoid')&&fightDrop.s.secretRealm.done.includes(4));
const onlySlayer=fixture('demon',777);onlySlayer.s.storageBags.bagSlayer=true;onlySlayer.s.storageBags.bag03=true;
check('slayer overrides regular capacity, no stacking',onlySlayer.storageBonus===780);
onlySlayer.s.storageBags.bagVoid=true;
check('void wins while keeping earlier bag records',onlySlayer.storageBonus===1250&&onlySlayer.hasStorageBag('bag03'));
const table=new Map();const storage={getItem:k=>table.get(k)||null,setItem:(k,v)=>{table.set(k,String(v));},removeItem:k=>table.delete(k)};
const slots=new Slots(storage);
const a=slots.newGame('human',3109,1),b=slots.newGame('human',3109,2),d=slots.newGame('demon',3109,1);
a.s.storageBags.bagVoid=true;a.s.storageBags.bag01=true;
check('saving slot 1 succeeds',slots.save('human',a,1));
check('slot 2 and demon slot remain separate',!slots.read('human',2)?.game?.hasStorageBag('bagVoid')&&!slots.read('demon',1)?.game?.hasStorageBag('bagVoid'));
check('slot 1 restores bound bag',slots.read('human',1).game.hasStorageBag('bagVoid'));
// Shared capacity getter must affect real-game loot and warehouse withdrawal paths.
const stockPlain=fixture('human',1091),stockBlessed=fixture('human',1092);
stockPlain.s.inv={};stockBlessed.s.inv={};stockBlessed.s.storageBags.bagSlayer=true;
stockPlain.loot({wood:120},'capacity test');stockBlessed.loot({wood:120},'capacity test');
check('pickup can keep more material after storage bag bonus',(stockBlessed.s.inv.wood||0)>(stockPlain.s.inv.wood||0));
const warehouseTest=fixture('human',1093);
warehouseTest.s.inv={};warehouseTest.camp.stash={wood:1000};
warehouseTest.withdraw('wood',1000);const beforeUpgrade=warehouseTest.s.inv.wood||0;
warehouseTest.s.storageBags.bagSlayer=true;warehouseTest.withdraw('wood',1000);const afterUpgrade=warehouseTest.s.inv.wood||0;
check('warehouse withdrawal now uses actual expanded carry limit',afterUpgrade>beforeUpgrade);
// No bag IDs enter normal stock, donation or ordinary gear loops.
check('no physical bag IDs in material registry or weight slots',bags.every(b=>!Object.hasOwn(D.ITEMS,b.id)));
check('existing twelve maps and enemy tuning unchanged',D.ZONES.length===12&&JSON.stringify([...Object.entries(D.ENEMIES)].map(([k,v])=>[k,v.hp,v.atk,v.armor]))===JSON.stringify([...Object.entries(baseline.D.ENEMIES)].map(([k,v])=>[k,v.hp,v.atk,v.armor])));
check('old HUD markers still present',now.html.includes('v905-status-head')&&now.html.includes('v905-status-sub'));
check('UI bag, codex, filter, descriptions wired',now.html.includes('storage-bag-card')&&now.html.includes("['bag','储物袋']")&&now.html.includes('bag-'+"'"+'+bag.id')&&now.html.includes('永久储物袋'));
check('single HTML is self-contained',now.html.match(/<\/html>/g).length===1);
console.log(`V90.75 CURRENT STORAGE REGRESSION PASS ${checks} checks, all 14 bag types, old slots and drop boundaries`);
