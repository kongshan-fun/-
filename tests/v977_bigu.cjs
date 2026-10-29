'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const ss=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(x=>x[1]);
const c=vm.createContext({console});c.globalThis=c;c.window=c;for(let i=0;i<6;i++)vm.runInContext(ss[i],c);
const {QGame:G,QData:D,QCharacterSlots:S}=c;let count=0;const cases=[];
function eq(a,b,msg){assert.deepEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)),msg);count++;}
function ok(a,msg){assert.ok(a,msg);count++;}
function fixture(tier=7,race='human',mode='challenge'){
 let g=new G(null,123456,race,null,mode);g.s.level=tier*3-2;g.syncMajor();
 const stats=D.statsForLevel(g.s.level);g.s.maxHp=stats.hp;g.s.maxSpirit=stats.spirit;g.s.attack=stats.atk;g.s.hp=stats.hp;g.s.spirit=stats.spirit;
 g.s.hunger=g.s.water=100;g.s.life.left=500*D.LIFE.yearMinutes;g.s.guide.status='skipped';
 return g;
}
function home(g){g.enterHome();for(const[k,v]of Object.entries(D.SETTLE_COST))g.s.inv[k]=v+20;ok(g.act('settle').ok,'fixture house');}
function reload(g){return new G(g.state(),123456,g.s.character,null,g.s.difficulty);}
function params(g){return {h:g.s.hunger,w:g.s.water,sp:g.s.spirit,b:g.s.bigu};}
function test(name,fn){const before=count;fn();cases.push({name,assertions:count-before,pass:true});console.log('PASS',name,count-before);}
test('all 12 realms x 2 races x 3 difficulties; default opt-out and passive arithmetic',()=>{
 for(const mode of ['easy','standard','challenge'])for(const race of ['human','demon'])for(let t=1;t<=12;t++){
  let g=fixture(t,race,mode);const percent=t<5?100:t<7?75:t<9?50:t<11?30:15;
  eq(g.biguInfo().percent,percent,'realm tier');ok(!g.s.bigu.enabled,'default off');
  const original=JSON.stringify(g.state());const p=g.survivalForecast(30,4,4,3);
  eq(JSON.stringify(g.state()),original,'forecast has no writes');eq(p.spiritCost,3,'passive costs no energy');
  const b=g.s.spirit;ok(g.tick(30,4,4,3),'tick');eq(g.s.hunger,100-Math.floor(4*percent/100),'hunger integer display');
  eq(g.s.bigu.hungerRemainder,Math.round(4*percent*10)%1000,'fractional debt');eq(g.s.spirit,b-3,'only action cost');
  g=reload(g);eq(g.s.bigu.hungerRemainder,p.nextBigu.hungerRemainder,'reloaded remainder');
  const toggle=g.act('bigu-toggle',{enabled:true});eq(toggle.ok,t>=7,'no early unlock');
 }
});
test('single action, split actions and every-step reload consume identical totals',()=>{
 for(const t of [5,7,9,11,12])for(const on of [false,true]){
  if(on&&t<7)continue;
  const a=fixture(t),b=fixture(t);if(on){a.setBigu(true);b.setBigu(true);}a.tick(100,20,30,0);
  let x=b;for(let i=0;i<20;i++){x.tick(5,1,1.5,0);x=reload(x);}
  eq(params(a),params(x),'chunk independent t'+t+' active '+on);
 }
});
test('reserve threshold, action cost precedence, no negative balances',()=>{
 for(let energy=0;energy<=200;energy++){
  const g=fixture(7);g.s.maxSpirit=100;g.s.spirit=energy;g.setBigu(true);
  const p=g.survivalForecast(15,10,10,7);const floor=40;
  ok(p.energyCost>=0&&p.energyCost<=Math.max(0,energy-7-floor),'active surplus only');
  ok(p.spirit>=0,'nonnegative spirit');if(p.energyCost)ok(p.spirit>=floor,'active cannot cross floor');
  if(energy<=47)eq(p.energyCost,0,'baseline cost protected');
 }
 const g=fixture(7);g.s.maxSpirit=100;g.s.spirit=41;g.setBigu(true);
 g.tick(15,4,4,0);eq(g.s.spirit,40,'one point leaves floor');eq(g.biguInfo().reason,'reserve','paused at reserve');
 g.s.spirit=80;eq(g.biguInfo().reason,'active','auto resumes when enough');
});
test('prepaid credit survives toggles, reloads, partial cover and does not regenerate energy',()=>{
 let g=fixture(12);g.setBigu(true);g.tick(1,1,1,0);eq(g.s.bigu.credit,1700,'one energy prepays two points');
 const spent=g.s.bigu.spentSpirit;g.setBigu(false);g.tick(1,1,1,0);eq(g.s.bigu.credit,1700,'off preserves but does not consume credit');
 g=reload(g);g.setBigu(true);g.tick(1,1,1,0);eq(g.s.bigu.spentSpirit,spent,'credit used once without recharging');eq(g.s.bigu.credit,1400,'correct credit remaining');
 const b=g.s.spirit;for(let n=0;n<30;n++){g.setBigu(false);g.setBigu(true);}eq(g.s.spirit,b,'toggles never refund energy');
});
test('battle, recovery and environment are not bypassed',()=>{
 const g=fixture(9);g.setBigu(true);g.startBattle('boss0');const p=g.survivalForecast(15,1,1,2);
 eq(p.energyCost,0,'combat paused');eq(g.biguInfo().reason,'combat','status');eq(p.hEffective,.3,'passive stays in battle');g.s.combat=null;
 g.s.zone=2;g.s.buffs.fireward=0;let x=g.survivalForecast(60,4,4,0);
 eq(x.environmentWater,2,'heat still two water');eq(x.waterCost,2,'heat cannot be converted');
 g.s.buffs.fireward=g.s.minutes+100;eq(g.survivalForecast(60,4,4,0).waterCost,0,'fire protection still works');
 g.s.zone=0;home(g);const before=g.s.bigu.spentSpirit;const f=g.restForecast('camp');eq(f.energyCost,0,'rest preview pauses');
 const hp=Math.max(1,g.s.maxHp-10);g.s.hp=hp;const forecast=g.restForecast('camp');const result=g.act('rest',{mode:'camp'});ok(result.ok,'rest executes');
 eq(g.s.hunger,forecast.hunger,'rest does not double-reduce hunger');eq(g.s.water,forecast.water,'rest does not double-reduce water');
 eq(g.s.hp,forecast.expectedHp,'rest HP preview exact');eq(g.s.spirit,forecast.expectedSpirit,'rest energy preview exact');eq(g.s.bigu.spentSpirit,before,'rest cannot feed active conversion');
 g.s.inv.stone=100;g.act('meditate');eq(g.s.bigu.spentSpirit,before,'meditation also paused');eq(g._biguRecovering977,0,'no recovery lock leak');
});
test('old-save compatibility, corrupt state rejected and 600 isolated slots',()=>{
 let g=fixture(12);delete g.s.bigu;g=reload(g);eq(g.s.bigu.enabled,false,'old high save does not opt in');eq(g.s.bigu.noticeTier,0,'old save needs one notice');
 const malformed=g.state();malformed.bigu.credit=-1;assert.throws(()=>new G(malformed),/辟谷/);count++;
 const map=new Map(),disk={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};
 for(const mode of ['easy','standard','challenge'])for(const race of ['human','demon']){
  const store=new S(disk,mode);for(let n=1;n<=100;n++){
   const f=fixture(n%12+1,race,mode);if(f.realmIndex>=7)f.setBigu(n%2===0);
   f.tick(1,1,1,0);store.save(race,f,n);const v=store.read(race,n).game;
   eq(v.s.bigu,f.s.bigu,'slot state exact '+mode+race+n);eq(v.biguInfo().enabled,f.biguInfo().enabled,'slot switch isolation');
  }
 }
 eq(map.size,600,'600 distinct keys');
});
test('life expiry, food zero, healing and fractional starvation safety',()=>{
 const g=fixture(12);g.setBigu(true);g.s.life.left=1;ok(!g.tick(30,1,1,0),'life expiry still occurs');ok(g.s.ended,'ended remains');eq(g.s.bigu.spentSpirit,0,'no conversion committed on age failure');
 const f=fixture(12);f.setBigu(true);f.s.hunger=f.s.water=0;let p=f.survivalForecast(30,1,1,0);eq(p.hunger,0,'conversion not feeding');eq(p.water,0,'conversion not hydrating');eq(p.damage,0,'paid normal action can sustain life');
 f.s.zone=2;p=f.survivalForecast(30,1,1,0);ok(p.damage>0,'zero-water heat remains harmful');
 f.s.zone=0;home(f);eq(f.restForecast('camp').factor,0,'empty nutrition cannot heal via recovery loop');
 const x=fixture(12);x.s.hunger=1;x.s.bigu.hungerRemainder=900;p=x.survivalForecast(60,1,0,0);ok(p.damage>0,'fractional shortage not erased by rounding');
});
const report={version:D.RELEASE,passed:count,cases,sourceSha256:require('node:crypto').createHash('sha256').update(html).digest('hex')};
fs.mkdirSync(path.join(ROOT,'artifacts/v977'),{recursive:true});fs.writeFileSync(path.join(ROOT,'artifacts/v977/bigu-engine.json'),JSON.stringify(report,null,2));
console.log('V90.77 BIGU PASS',count,'assertions');
