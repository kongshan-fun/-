'use strict';
/* V90.82 independent old-save, storage fault, cultivation, battle and board tests. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
const scope={};for(const code of scripts.slice(0,6))new Function('globalThis',code)(scope);
const {QData:D,QGame:G,QCharacterSlots:S}=scope;
let checks=0;const ok=(b,label)=>{assert.ok(b,label);checks++};
function storage(){const data=new Map();return{data,getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)}}
ok(D.RELEASE==='V90.82','release');
for(const race of ['human','demon']){
 const st=storage(),slots=new S(st,'challenge'),key=slots.key(race);
 const state=new G(null,8202,race).state();delete state.difficulty;delete state.garden;const original=JSON.stringify(state);
 st.setItem(key,original);const game=slots.read(race).game;ok(game.s.difficulty==='challenge','old missing difficulty loaded');
 game.s.xp+=55;ok(slots.save(race,game),'old character saved');
 ok(st.getItem(slots.backupKey(race))===original,'old original backup');
 ok(st.getItem(slots.gardenArchiveKey(race))===original,'old original archive');
 ok(slots.read(race).game.s.xp===game.s.xp,'roundtrip');
 const prior=st.getItem(key),modified=slots.read(race).game;modified.s.xp+=60;
 let trigger=true;
 const fail=new S({getItem:st.getItem,setItem:(k,v)=>{st.setItem(k,v);if(k===key&&trigger){trigger=false;throw Error('disk failure')}},removeItem:st.removeItem},'challenge');
 assert.throws(()=>fail.save(race,modified),/保存失败/);checks++;
 ok(st.getItem(key)===prior,'write fault rollback');ok(st.getItem(slots.backupKey(race))===prior,'backup retained after rollback');
 const backupFail=new S({getItem:st.getItem,setItem:(k,v)=>{if(k===slots.backupKey(race))throw Error('quota');st.setItem(k,v)},removeItem:st.removeItem},'challenge');
 assert.throws(()=>backupFail.save(race,modified),/备份失败/);checks++;ok(st.getItem(key)===prior,'backup failure prevents overwrite');
 let once=true;
 const silentFail=new S({getItem:st.getItem,setItem:(k,v)=>st.setItem(k,k===key&&once?(once=false,'INVALID'):v),removeItem:st.removeItem},'challenge');
 assert.throws(()=>silentFail.save(race,modified),/主档写入读回校验失败/);checks++;
 ok(st.getItem(key)===prior,'silent write corruption restored');ok(new S(st,'standard').status(race).status==='empty','cross-mode records isolated');
}
for(const race of ['human','demon']){
 const game=new G(null,8100,race);
 for(const action of ['core-trial-start','core-trial-act','heart-trial-start','heart-trial-act']){
 const before=JSON.stringify(game.state());const result=game.act(action,{mode:'ward'});
 ok(!result.ok&&JSON.stringify(game.state())===before,'retired ordeal rejected without mutation');
 }
 const meditate=new G(null,8200,race);meditate.s.level=32;meditate.syncMajor();meditate.s.inv.stone=90;
 Object.defineProperty(meditate,'workshop',{value:true});meditate.roomLevel=()=>0;
 const stamp=JSON.stringify([meditate.s.xp,meditate.s.minutes,meditate.s.inv.stone]);
 ok(!meditate.meditate().ok&&stamp===JSON.stringify([meditate.s.xp,meditate.s.minutes,meditate.s.inv.stone]),'low-tier meditation cap');
 const large=new G(null,8400,race);large.s.level=21;large.syncMajor();large.s.xp=3000;large.s.daoXp=0;
 ok(large.spendProgress(100)&&large.s.xp===2900&&large.s.daoXp===0,'daoXp retirement preserved');
}
const rows=[];
for(const [zone,level,id] of [[4,15,'boss4'],[5,18,'boss5'],[6,21,'boss6'],[7,24,'boss7']]){
 const g=new G(null,8551,'human');g.s.zone=zone;g.s.level=level;g.syncMajor();ok(g.startBattle(id).ok,'battle '+id);
 rows.push([id,g.s.combat.maxHp,g.s.combat.atk]);
}
ok(rows[1][1]<2000&&rows[1][2]<200,'zone six softened');
ok(rows[2][1]<4000&&rows[2][2]<400,'zone seven softened');
ok(rows[0][1]===758&&rows[3][1]===6839,'unrelated bosses unchanged');
ok(D.ENEMIES.boss5.hp===2904&&D.ENEMIES.boss6.hp===4259,'source tables untouched');
const saved=storage(),oldBoard='shanye-v978-local-ascension-board-v1-standard';
saved.setItem(oldBoard,JSON.stringify({schemaVersion:1,source:'local_unverified',records:[]}));
const ranks=new S(saved,'standard');
ok(ranks.leaderboardKey()!==oldBoard&&ranks.leaderboard().records.length===0,'season isolated');
ok(!!saved.getItem(oldBoard),'old season still exists');
console.log('V90.82 P0/P1 PASS',checks,'checks',JSON.stringify(rows));
