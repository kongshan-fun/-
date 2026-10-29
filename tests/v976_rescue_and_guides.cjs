'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),blocks=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
const ctx=vm.createContext({console});ctx.globalThis=ctx;ctx.window=ctx;for(let i=0;i<6;i++)vm.runInContext(blocks[i],ctx,{timeout:10000});
const {QGame:G,QCharacterSlots:S,QData:D}=ctx;
const fake=()=>{const map=new Map();return {map,fail:null,failRemove:null,getItem(k){return map.get(k)||null},setItem(k,v){if(this.fail===k)throw Error('quota');map.set(k,String(v))},removeItem(k){if(this.failRemove===k)throw Error('storage erase denied');map.delete(k)}}};
let checks=0;const eq=(a,b,msg)=>{assert.equal(a,b,msg);checks++},ok=(a,msg)=>{assert.ok(a,msg);checks++};
for(const race of ['human','demon'])for(const diff of ['easy','standard','challenge']){
 const store=fake(),slots=new S(store,diff),g=slots.newGame(race,997311,1),key=slots.key(race,1),rescue=slots.rescueKey(race,1);
 const primary=store.getItem(key);g.s.stats.kills=4;g.expire('单测模拟真实寿尽');
 ok(slots.markRescuePending(race,1,g),'post-death receipt saved');eq(store.getItem(key),primary,'primary untouched');
 eq(slots.read(race,1).pendingRescue.stats.kills,4,'post-death stats retained');
 eq(slots.read(race,1).pendingRescue.life.left,0,'dead body persisted');
 eq(slots.status(race,1).rescuePending,true,'save list is pending');
 g.s.stats.kills=900;ok(slots.markRescuePending(race,1,g),'repeated pagehide idempotent');eq(slots.read(race,1).pendingRescue.stats.kills,4,'first death snapshot immutable');
 const bad=new G(JSON.parse(primary),997311,race,null,diff);assert.throws(()=>slots.save(race,bad,1),/寿尽待救援/);checks++;
 const restart=slots.read(race,1).game;restart.s=JSON.parse(JSON.stringify(slots.read(race,1).pendingRescue));
 restart.s.ended=false;restart.s.hp=Math.round(restart.s.maxHp*.35);restart.s.life.left=15*D.LIFE.yearMinutes;restart.s.life.rescued=true;
 store.failRemove=rescue;slots.save(race,restart,1);eq(slots.read(race,1).pendingRescue,undefined,'saved rescue supersedes uncleaned marker');eq(slots.status(race,1).rescuePending,undefined,'rescued primary playable');eq(slots.read(race,1).game.s.life.rescued,true,'rescue used exactly once');
 store.failRemove=null;slots.expire(race,1);eq(store.getItem(rescue),null,'postdeath marker removed');eq(slots.status(race,1).status,'dead','tombstone dominates');
 const second=slots.newGame(race,997313,1);ok(second&&!slots.read(race,1).pendingRescue,'next generation no old rescue');
}
{
 const store=fake(),s=new S(store),g=s.newGame('human',23456,1),raw=store.getItem(s.key('human',1));g.expire('quota');store.fail=s.rescueKey('human',1);
 assert.throws(()=>s.markRescuePending('human',1,g),/quota/);checks++;eq(store.getItem(s.key('human',1)),raw,'failed pending commit does not destroy primary');
 store.fail=null;s.markRescuePending('human',1,g);store.map.set(s.rescueKey('human',1),'not-json');eq(s.status('human',1).status,'invalid','corrupt receipt locks slot');
}
{
 const g=new G();g.s.guide.status='skipped';g.s.ritual[0]=true;g.s.cleared[0]=true;g.s.unlocked=2;g.s.zone=0;
 g.s.homestead={level:1,buildings:{},stash:{},storedGears:[],foundedAt:0,farmAt:0};g.s.atHome=false;
 const r=g.travel(1);eq(r.ok,true,'travel succeeds');ok(/入口/.test(r.msg),'arrival says entrance, not home');ok(!g.atCamp,'arrival is NOT home');
 const log=g.s.logs[0]?.msg;ok(/地图入口/.test(log),'travel log says entrance');
 g.s.life.left=60*D.LIFE.yearMinutes;g.s.hp=1;g.collapse();eq(g.s.atHome,false,'collapse clears home flag');ok(/入口/.test(g.s.logs[0]?.msg),'defeat log says entrance');
}
const ids=new Set(D.HELP.map(x=>x.id));ok(D.HELP.length>=25,'at least 25 current help chapters');ok(ids.has('roots')&&ids.has('storage-bags')&&ids.has('p11-high-realm'),'legacy evergreen topics present');eq(D.HELP.find(x=>x.id==='home975').paragraphs.length,4,'home guide preserved');
const total=Object.keys(D.ITEMS).length+Object.values(D.ENEMIES).filter(x=>!x.training).length+D.RECIPES.filter(r=>r.gear).length+D.STORAGE_BAGS.length+D.HOME_ROOMS.length;eq(total,211,'codex category membership total');
const report={version:'V90.76',checks,helpPages:D.HELP.length,catalogTotal:total,tests:'pending rescue, reload, idempotency, quota, corruption, migration, location and help'};
fs.mkdirSync(path.join(__dirname,'../artifacts/v976'),{recursive:true});fs.writeFileSync(path.join(__dirname,'../artifacts/v976/rescue-and-help.json'),JSON.stringify(report,null,2));console.log('V90.76 RESCUE + GUIDES PASS',report);
