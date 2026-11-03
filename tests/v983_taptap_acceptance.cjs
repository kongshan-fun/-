'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../releases/山野修仙记_V90.83_TapTap候选版.html'),'utf8');
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
let count=0;function ok(b,msg){assert.ok(b,msg);count++}
ok(scripts.length===12,'12 inline scripts');
scripts.forEach((s,i)=>{assert.doesNotThrow(()=>new Function(s),'syntax script '+i);count++});
ok(!/<script[^>]+src=/i.test(html),'self contained');
const game={};for(const s of scripts.slice(2,8))new Function('globalThis',s)(game);
const {QGame:G,QData:D,QCharacterSlots:S}=game;
ok(D.RELEASE==='V90.83','candidate version');
ok(new S({getItem(){return null},setItem(){},removeItem(){}},'standard').leaderboardKey().includes('v982'),'score ruleset retained');
const sdk=scripts[1].replace('  function restoreCloud(uuid) {',
  '  globalThis.__testApplyPayload=applyPayload;\n  function restoreCloud(uuid) {');
ok(sdk.includes('globalThis.__testApplyPayload=applyPayload;'),'test hook only in VM');
const key=(mode,race,n=1)=>'qinglan-wendao-v14-'+(mode==='challenge'?'':mode+'-')+race+'-slot-'+String(n).padStart(3,'0');
const state=(mode,race)=>JSON.stringify(new G(null,20261103,race,null,mode).state());
function mock(initial={},opts={}){
 const data=new Map(Object.entries(initial)),fault={key:null,kind:null,once:true};
 let grants=0,onError=null,onClose=null,showCalls=0;
 const localStorage={
  get length(){return data.size},
  key(i){return [...data.keys()][i]??null},
  getItem(k){if(fault.kind==='read'&&fault.key===k)throw Error('read failure');return data.has(k)?data.get(k):null},
  setItem(k,v){
   if(fault.key===k&&fault.kind==='write'){if(fault.once)fault.key=null;throw Error('quota')}
   if(fault.key===k&&fault.kind==='corrupt'){if(fault.once)fault.key=null;data.set(k,'CORRUPT');return}
   data.set(k,String(v));
  },
  removeItem(k){
   if(fault.key===k&&fault.kind==='no-delete'){if(fault.once)fault.key=null;return}
   data.delete(k);
  }
 };
 const button={disabled:false,click(){grants++}};
 const document={readyState:'loading',addEventListener(){},querySelectorAll(q){return q.includes('birth-ad')?[button]:[]},
  getElementById(){return null},createElement(){return {className:'',textContent:''}},body:{appendChild(){}}};
 const ad={onLoad(){},onError(f){onError=f},onClose(f){onClose=f},load(){return Promise.resolve()},
  show(){showCalls++;return opts.rejectAd?Promise.reject(Error('show failed')):Promise.resolve()}};
 const world={localStorage,document,Promise,Date,Math,console,setTimeout(){return 0},clearTimeout(){},
  setInterval(){return 0}};
 world.globalThis=world;world.window=world;
 if(opts.tap)world.tap={createRewardedVideoAd(){return ad}};
 vm.runInNewContext(sdk,world,{timeout:5000});
 return {world,data,fault,get grants(){return grants},get onError(){return onError},get onClose(){return onClose}};
}
async function run(){
 for(const mode of ['easy','standard','challenge'])for(const race of ['human','demon']){
  const id=key(mode,race),m=mock({[id]:state(mode,race)});
  ok(m.world.QTap.cloud.hasLocalMainSave(),'real local save '+mode+'/'+race);
  ok(Object.hasOwn(m.world.QTap.cloud.collect().keys,id),'cloud includes real save');
 }
 const a=key('challenge','human'),b=key('challenge','demon');
 const originalA=state('challenge','human'),originalB=state('challenge','demon');
 const newA=JSON.stringify({...JSON.parse(originalA),xp:37}),newB=JSON.stringify({...JSON.parse(originalB),xp:49});
 {
  const m=mock({[a]:originalA,[b]:originalB,'shanye-v982-local-ascension-board-v1-standard':'SCORES',
    'qinglan-wendao-v14-presync-backup':'OLD'});
  const collect=m.world.QTap.cloud.collect();
  ok(Object.hasOwn(collect.keys,'shanye-v982-local-ascension-board-v1-standard'),'V982 score cloud backup');
  ok(!Object.hasOwn(collect.keys,'qinglan-wendao-v14-presync-backup'),'snapshot not uploaded');
  ok(m.world.__testApplyPayload({keys:{[a]:newA,[b]:newB}})===2,'cloud two slots restored');
  ok(m.data.get(a)===newA&&m.data.get(b)===newB,'both values persisted');
  const backup=JSON.parse(m.data.get('__qtap_presync_backup_v1__'));
  ok(backup.keys[a]===originalA&&backup.keys[b]===originalB,'durable prior slots retained');
 }
 {
  const m=mock({[a]:originalA,[b]:originalB});m.fault.key=b;m.fault.kind='write';
  assert.throws(()=>m.world.__testApplyPayload({keys:{[a]:newA,[b]:newB}}),/已完整恢复原本地存档/);count++;
  ok(m.data.get(a)===originalA&&m.data.get(b)===originalB,'failed second slot restores all');
  ok(m.data.has('__qtap_presync_backup_v1__'),'protect snapshot remains on rollback');
 }
 {
  const m=mock({[a]:originalA});m.fault.key=a;m.fault.kind='corrupt';
  assert.throws(()=>m.world.__testApplyPayload({keys:{[a]:newA}}),/已完整恢复原本地存档/);count++;
  ok(m.data.get(a)===originalA,'silent invalid write rolls back');
 }
 {
  const m=mock({[a]:originalA,[b]:originalB});m.fault.key=b;m.fault.kind='no-delete';
  assert.throws(()=>m.world.__testApplyPayload({keys:{[a]:newA}}),/已完整恢复原本地存档/);count++;
  ok(m.data.get(a)===originalA&&m.data.get(b)===originalB,'failed stale-key cleanup rolls back');
 }
 {
  const m=mock({[a]:originalA});m.fault.key='__qtap_presync_backup_v1__';m.fault.kind='write';
  assert.throws(()=>m.world.__testApplyPayload({keys:{[a]:newA}}),/未改动本地存档/);count++;
  ok(m.data.get(a)===originalA,'cannot restore without snapshot');
 }
 const invalid=[{keys:{'invalid-key':'X'}},{keys:{'shanye-v982-local-ascension-board-v1-standard':'SCORE'}},
  {keys:{[a]:'BAD_JSON'}},{keys:{[a]:JSON.stringify({...JSON.parse(newA),race:'demon'})}},
  {keys:{[a]:JSON.stringify({...JSON.parse(newA),difficulty:'easy'})}}];
 for(const payload of invalid){
  const m=mock({[a]:originalA});
  assert.throws(()=>m.world.__testApplyPayload(payload));count++;
  ok(m.data.get(a)===originalA,'rejected invalid cloud identity / partial payload');
 }
 {
  const m=mock({[a]:originalA});m.fault.key=a;m.fault.kind='read';
  assert.throws(()=>m.world.QTap.cloud.collect(),/读取本地档案失败/);count++;
 }
 {
  const m=mock({[a]:'CORRUPTED_LOCAL_SLOT'});
  ok(m.world.QTap.cloud.hasLocalMainSave(),'damaged local slot cannot be silently replaced');
 }
 {
  const m=mock({}, {tap:true,rejectAd:true});
  m.world.QTap.ads.show('birth-ad');
  await Promise.resolve();
  m.onError({errMsg:'video error'});
  await new Promise(resolve=>setImmediate(resolve));
  m.onClose({isEnded:true});
  await new Promise(resolve=>setImmediate(resolve));
  ok(m.grants===1,'onError plus retry rejection plus late close = one award');
  ok(m.world.QTap.ads.stats().failures===1,'single fallback settlement');
 }
 {
  const m=mock({}, {tap:true});
  m.world.QTap.ads.show('birth-ad');m.onClose({isEnded:true});m.onClose({isEnded:true});
  ok(m.grants===1,'duplicate onClose cannot duplicate reward');
 }
 {
  const m=mock({}, {tap:true}),g=new G(null,17001,'human',null,'easy');
  m.world.__QTAP_STATE={role:'human',slot:1,game:g,power:1234};
  const rank=m.world.QTap.rankDifficulty.sync();
  ok(rank.mode==='easy'&&!rank.powerReady,'easy leaderboard disabled');
  const response=await m.world.QTap.leaderboard.submit();
  ok(response.skipped===true,'easy leaderboard ignored');
 }
 console.log('V90.83 TAPTAP SDK/ROLE/CLOUD/ADS PASS '+count+' assertions');
}
run().catch(e=>{console.error(e);process.exitCode=1});
