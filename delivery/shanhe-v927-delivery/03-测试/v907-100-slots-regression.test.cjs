'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),filename=path.join(root,'releases/山野修仙记_V90.7_飞升结算与本机资质榜.html');
const html=fs.readFileSync(filename,'utf8');
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
assert.equal(scripts.length,10);
scripts.forEach((s,i)=>new vm.Script(s,{filename:'inline-'+i+'.js'}));
const context=vm.createContext({console});context.globalThis=context;
for(let i=0;i<=5;i++)vm.runInContext(scripts[i],context,{timeout:10000});
const {QGame:Game,QData:D,QCharacterSlots:Slots}=context;
const table=new Map(),disk={
 getItem:key=>table.get(key)||null,
 setItem:(key,value)=>{table.set(key,String(value))},
 removeItem:key=>{table.delete(key)}
};
const slots=new Slots(disk);
const TOTAL=100,byRace={human:0,demon:0};
let saveLoads=0,rituals=0,bossWins=0,breakthroughs=0,trialStages=0,moves=0;
const cases=[],errors=[],nonNatural=[];
function runCase(role,number,seed){
 let g=slots.newGame(role,seed,number),lastVerified=-1;
 const stock=items=>{for(const [id,n] of Object.entries(items))g.s.inv[id]=Math.max(g.s.inv[id]||0,n+10)};
 const feed=()=>{g.s.hunger=g.s.water=100;g.s.spirit=g.s.maxSpirit;g.s.hp=g.s.maxHp;
  stock({wood:20,stone:20,fiber:20,water:100,salve:40,berry:80,herb:30,ore:20,rune:20})};
 const act=(name,args={})=>{const r=g.act(name,args);if(!r.ok)throw Error(name+': '+r.msg);return r};
 const checkpoint=(label)=>{
  assert(slots.save(role,g,number),label+' save');
  const state=g.state(),fresh=slots.read(role,number);
  assert(fresh?.game,label+' read');
  assert.equal(fresh.game.s.character,role,label+' role');
  assert.equal(fresh.game.s.zone,g.s.zone,label+' zone');
  assert.deepEqual([...fresh.game.s.cleared],[...state.cleared],label+' progression');
  assert.equal(fresh.game.s.major,state.major,label+' major');
  assert.equal(fresh.game.s.ascended,state.ascended,label+' ascended');
  g=fresh.game;saveLoads++;
 };
 const fight=()=>{
  if(!g.s.combat)return;
  // Test-only combat strength, not a game reward or a balance claim.
  const attack=g.s.attack;g.s.attack=10000;
  for(let n=0;g.s.combat&&n<20;n++)act('fight',{mode:'attack'});
  if(g.s.combat)throw Error('combat unresolved');
  g.s.attack=attack;feed();
 };
 const travelByPath=(x,y)=>{
  const steps=g.path(x,y);
  if(!steps.length&&(g.s.pos.x!==x||g.s.pos.y!==y))throw Error('path not found '+x+','+y);
  for(const step of steps){
   act('move',step);moves++;
   if(g.s.combat)fight();
  }
  assert.equal(g.s.pos.x,x);assert.equal(g.s.pos.y,y);
 };
 // One-time accelerated XP and abundant test supplies isolate progression from grinding.
 g.xp(50000);feed();checkpoint('start');
 for(let z=0;z<12;z++){
  if(g.s.zone!==z)act('travel',{zone:z});
  assert.equal(g.s.zone,z);
  feed();stock(D.SETTLE_COST);
  if(!g.s.settlements[z])act('settle');
  assert(g.s.settlements[z],'missing housing '+z);
  stock(D.ZONES[z].need);
  if(z===0){stock(D.BUILDINGS.gate.levels[0].cost);act('build',{id:'gate'});}
  else{travelByPath(4,4);feed();stock(D.ZONES[z].need);act('repair');}
  assert.equal(g.s.ritual[z],true);
  rituals++;checkpoint('ritual-'+z);
  travelByPath(7,2);
  if(!g.s.cleared[z]){
   if(!g.s.combat)act('hunt');
   fight();
  }
  assert.equal(g.s.cleared[z],true);
  assert(!g.s.combat,'battle leaked');
  bossWins++;
  checkpoint('boss-'+z);
  if(z>=5){
   act('travel',{zone:z,home:true});feed();
   const stage=D.ASCENSION_STAGES[z-5];
   stock({[stage.primary]:20,[stage.secondary]:20});
   g.xp(stage.needDao+20);
   if(z===5){
    act('core-trial-start');
    for(let i=0;i<3;i++){feed();act('core-trial-act',{mode:'ward'});trialStages++;}
    assert.equal(g.coreTrial.complete,true,'core trial');
   }
   if(z===6){
    act('heart-trial-start');
    for(let i=0;i<3;i++){feed();act('heart-trial-act',{mode:'anchor'});trialStages++;}
    assert.equal(g.heartTrial.complete,true,'heart trial');
   }
   feed();act('breakthrough');breakthroughs++;
   assert.equal(g.s.major,z-3,'breakthrough index');
   checkpoint('major-'+z);
  }
  lastVerified=z;
 }
 assert.equal(lastVerified,11);
 feed();stock(D.ASCENSION_RULE.cost);g.xp(D.ASCENSION_RULE.dao+20);
 travelByPath(7,5);act('ascend');
 assert.equal(g.s.ascended,true);assert.equal(g.s.major,9);
 assert.equal(g.s.cleared.filter(Boolean).length,12);
 checkpoint('ascend');
 assert.equal(slots.status(role,number).ascended,true);
 assert.equal(slots.status(role,number).status,'ready');
 // Unique slot key + race guard + read after completion.
 assert(table.has(slots.key(role,number)));
 const other=role==='human'?'demon':'human';
 assert.notEqual(slots.key(role,number),slots.key(other,number));
 cases.push({role,slot:number,seed,cleared:12,realm:g.realm,ascended:true,stored:true});
 byRace[role]++;
}
for(let i=0;i<TOTAL;i++){
 const role=i%2===0?'human':'demon',number=Math.floor(i/2)+1,seed=26000000+7919*i;
 try{runCase(role,number,seed);}catch(e){errors.push({role,slot:number,seed,error:String(e),trace:e.stack?.slice(0,400)});}
}
assert.equal(errors.length,0,'100-slot accelerated playthrough failed: '+JSON.stringify(errors.slice(0,6)));
assert.equal(cases.length,TOTAL);
assert.equal(byRace.human,50);assert.equal(byRace.demon,50);
for(let i=1;i<=50;i++){
 assert.equal(slots.status('human',i).ascended,true,'human slot '+i);
 assert.equal(slots.status('demon',i).ascended,true,'demon slot '+i);
}
const summary={result:errors.length?'FAIL':'PASS',type:'accelerated end-to-end milestone test',slots:cases.length,races:byRace,
 rituals,bossWins,breakthroughs,trialStages,saveLoads,moves,
 assumptions:['XP granted via engine method','material/food/health provisioned by test fixture','combat attack temporarily boosted to remove balance/grinding','boss, ritual, trials, breakthrough and ascension use actual game actions'],
 naturallyGrinded:false,realBrowserTested:false};

// Evidence is generated only in an independent GitHub Actions run, never saved in user storage.
if(typeof process!=='undefined'&&process.env.GITHUB_ACTIONS==='true'){
 const folder=path.join(root,'artifacts','v904-100-slots');
 fs.mkdirSync(folder,{recursive:true});
 const readme=[
  '山野修仙记 V90.6：100档自动化加速通关证据',
  '50个人族 + 50个妖族，均由真实 Game/CharacterSlots 接口创建、执行、存档与读取。',
  '本批档案属于测试夹具：修为、道材、食水、疗伤和战斗攻击在测试中被加速或补足。',
  '这些完成档并不证明普通玩家零加速自然通关；请勿作为正常游戏数值平衡或生产存档。',
  '所有档案为本次 CI 合成数据，没有用户账户信息。',
 ].join('\n');
 fs.writeFileSync(path.join(folder,'README_测试档案说明.txt'),readme,'utf8');
 fs.writeFileSync(path.join(folder,'100档验收汇总.json'),JSON.stringify({summary,completedArchives:cases},null,2),'utf8');
 for(const row of cases){
  const key=slots.key(row.role,row.slot),raw=table.get(key);
  assert(raw,'missing final character save '+key);
  const file=row.role+'_'+String(row.slot).padStart(3,'0')+'_飞升完成.json';
  fs.writeFileSync(path.join(folder,file),raw,'utf8');
 }
 console.log('V90.6 evidence files created:',cases.length,'synthetic completed character saves + manifest');
}
console.log('V90.6 100-SLOT FULL-MILESTONE TEST',JSON.stringify(summary));
