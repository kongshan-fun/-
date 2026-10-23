/* V90.64 TapTap difficulty leaderboard router.
   Runs immediately AFTER the existing QTap adapter and BEFORE the gameplay scripts.
   Challenge: preserve pre-existing live leaderboard IDs.
   Standard: requires new separate platform leaderboard IDs; fail closed if absent.
   Easy: excluded from all score submissions and rankings.
   No official ID is invented here. */
(function(g){
'use strict';
const q=g.QTap, cfg=q?.config?.leaderboard, api=q?.leaderboard;
if(!cfg||!api||api.__difficultyWrapped)return;
const challenge={power:cfg.power,speedrun:cfg.speedrun};
const standard=Object.assign({power:'',speedrun:''},g.__SHANYE_STANDARD_BOARD_IDS||{});
const originals={submit:api.submit,submitAscension:api.submitAscension,open:api.open,openSpeedrun:api.openSpeedrun};
let previouslySubmittedMode=null;
function currentMode(record,write){
 const s=g.__QTAP_STATE;
 if(record&&Object.hasOwn(record,'difficulty'))return String(record.difficulty);
 if(write&&!s?.role)return null;
 if(s?.role&&s.game?.s?.difficulty)return s.game.s.difficulty;
 return g.__SHANYE_SELECTED_DIFFICULTY||null;
}
function modeId(mode,kind){
 if(mode==='challenge')return challenge[kind]||'';
 if(mode==='standard')return standard[kind]||'';
 return '';
}
function callScoped(kind,fn,record,args,write){
 const mode=currentMode(record,write);
 if(!mode||mode==='easy'){
  return Promise.resolve({skipped:true,reason:mode==='easy'?'easy-unranked':'no-active-character'});
 }
 if(mode!=='challenge'&&mode!=='standard')return Promise.reject(new Error('未知难度，拒绝上榜'));
 const id=modeId(mode,kind);
 if(!id)return Promise.reject(new Error(mode==='standard'?'标准模式独立 TapTap 排行榜尚未配置，禁止写入挑战榜':'挑战榜 ID 缺失'));
 const previous=cfg[kind];
 cfg[kind]=id;
 try{return Promise.resolve(fn.apply(api,args));}
 catch(error){return Promise.reject(error);}
 finally{cfg[kind]=previous;}
}
api.submit=function(force){
 const mode=currentMode(null,true),initial=previouslySubmittedMode!==mode;
 previouslySubmittedMode=mode;
 return callScoped('power',originals.submit,null,[!!force||initial],true);
};
api.submitAscension=function(record){
 return callScoped('speedrun',originals.submitAscension,record,[record],true);
};
api.open=function(){
 return callScoped('power',originals.open,null,[],false);
};
api.openSpeedrun=function(){
 return callScoped('speedrun',originals.openSpeedrun,null,[],false);
};
api.__difficultyWrapped=true;
q.rankDifficulty={
 getMode:()=>currentMode(null,false),
 isEnabled:(mode,kind)=>!!modeId(mode,kind),
 idsConfigured:{challenge:!!challenge.power&&!!challenge.speedrun,standard:!!standard.power&&!!standard.speedrun},
 standardHasIndependentIds:!!standard.power&&!!standard.speedrun&&standard.power!==challenge.power&&standard.speedrun!==challenge.speedrun
};
if(standard.power===challenge.power||standard.speedrun===challenge.speedrun){
 standard.power='';standard.speedrun='';
 q.rankDifficulty.idsConfigured.standard=false;
 q.rankDifficulty.standardHasIndependentIds=false;
}
})(globalThis);
