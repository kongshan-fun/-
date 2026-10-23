'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../platform/taptap-difficulty-ranks-v964.js'),'utf8');
let count=0;
const ok=(v,t)=>{assert.ok(v,t);count++},eq=(a,b,t)=>{assert.equal(a,b,t);count++};
async function test(withIds,scenario){
 const posted=[],opened=[],timers=[];
 const q={config:{leaderboard:{power:'challengePower',speedrun:'challengeSpeed'},leaderboardAuto:{enabled:true,minIntervalMs:120000}},env:{leaderboard:()=>!!q.config.leaderboard.power},leaderboard:{
  submit:(force)=>{posted.push({kind:'power',board:q.config.leaderboard.power,force});return Promise.resolve({ok:true})},
  submitAscension:(record)=>{posted.push({kind:'speedrun',board:q.config.leaderboard.speedrun,record});return Promise.resolve({ok:true})},
  open:()=>{opened.push(q.config.leaderboard.power);return Promise.resolve({ok:true})},
  openSpeedrun:()=>{opened.push(q.config.leaderboard.speedrun);return Promise.resolve({ok:true})}
 }};
 const context={console,Date,QTap:q,__QTAP_SAVE_TICK:0,__QTAP_STATE:null,
  setInterval:fn=>{timers.push(fn);return 1;}};
 if(withIds)context.__SHANYE_STANDARD_BOARD_IDS=withIds;
 context.globalThis=context;
 vm.runInNewContext(source,context);
 const change=(mode)=>{context.__QTAP_STATE={role:'human',slot:1,game:{s:{difficulty:mode}}};context.__QTAP_SAVE_TICK++;q.rankDifficulty.sync();};
 eq(q.config.leaderboardAuto.enabled,false,scenario+' legacy automatic posting disabled');
 eq(q.config.leaderboard.power,'',scenario+' no game startup has no leaderboard id');
 eq(timers.length,1,scenario+' safe mode-aware auto setup');
 change('easy');
 eq(q.config.leaderboard.power,'',scenario+' easy power id blocked');
 eq(q.config.leaderboard.speedrun,'',scenario+' easy speedrun id blocked');
 const e=await q.leaderboard.submit(false);
 ok(e.skipped,scenario+' easy power skipped');await q.leaderboard.submitAscension({difficulty:'easy'});
 eq(posted.length,0,scenario+' easy never posts');
 timers[0]();eq(posted.length,0,scenario+' easy automatic polling never posts');
 change('challenge');
 eq(q.config.leaderboard.power,'challengePower',scenario+' retains official challenge power id');
 eq(q.config.leaderboard.speedrun,'challengeSpeed',scenario+' retains official challenge speed id');
 await q.leaderboard.submit(true);
 await q.leaderboard.submitAscension({difficulty:'challenge',elapsedMinutes:12000});
 eq(posted.length,2,scenario+' challenge can post');
 eq(posted[0].board,'challengePower',scenario+' challenge power board id');
 eq(posted[1].board,'challengeSpeed',scenario+' challenge speed board id');
 change('standard');
 if(withIds&&withIds.power!=='challengePower'&&withIds.speedrun!=='challengeSpeed'){
  eq(q.config.leaderboard.power,withIds.power,scenario+' separate standard power');
  eq(q.config.leaderboard.speedrun,withIds.speedrun,scenario+' separate standard speedrun');
  await q.leaderboard.submit(true);await q.leaderboard.submitAscension({difficulty:'standard',elapsedMinutes:9000});
  eq(posted[2].board,withIds.power,scenario+' standard writes only standard power board');
  eq(posted[3].board,withIds.speedrun,scenario+' standard writes only standard speedrun board');
  await q.leaderboard.open();await q.leaderboard.openSpeedrun();
  eq(opened[0],withIds.power,scenario+' standard opens its power board');
  eq(opened[1],withIds.speedrun,scenario+' standard opens its speedrun board');
 }else{
  eq(q.config.leaderboard.power,'',scenario+' unconfigured standard power inaccessible');
  eq(q.config.leaderboard.speedrun,'',scenario+' unconfigured standard speedrun inaccessible');
  let blocked=false;try{await q.leaderboard.submit(true)}catch{blocked=true}
  ok(blocked,scenario+' standard cannot post into challenge by mistake');
  eq(posted.length,2,scenario+' standard failure never posts');
 }
 change('easy');await q.leaderboard.openSpeedrun();eq(opened.length,withIds&&withIds.power!=='challengePower'&&withIds.speedrun!=='challengeSpeed'?2:0,scenario+' easy cannot open ranked board');
 await q.leaderboard.submit(false);eq(posted.length,withIds&&withIds.power!=='challengePower'&&withIds.speedrun!=='challengeSpeed'?4:2,scenario+' easy post still suppressed');
 ok(q.rankDifficulty.sync(),scenario+' sync API works');
}
(async()=>{
 await test({power:'standardPower',speedrun:'standardSpeed'},'configured');
 await test(null,'unconfigured');
 await test({power:'challengePower',speedrun:'challengeSpeed'},'reused-invalid');
 console.log('V90.64 TapTap DIFFICULTY RANK GUARD PASS '+count+' assertions');
})().catch(e=>{console.error(e);process.exitCode=1});
