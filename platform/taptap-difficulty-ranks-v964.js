/* V90.64 TapTap ranked modes. Install immediately AFTER the existing QTap adapter.
   This guard also protects the adapter's PRIVATE auto-power and settings handlers:
   those read QTap.config.leaderboard, not the public methods alone.
   Never invent an official standard leaderboard ID. */
(function (g) {
  'use strict';
  const q=g.QTap;
  if (!q?.config?.leaderboard || !q.leaderboard || q.rankDifficulty?.sync) return;
  const cfg=q.config.leaderboard;
  const original={
    power:String(cfg.power||''), speedrun:String(cfg.speedrun||'')
  };
  const supplied=g.__SHANYE_STANDARD_BOARD_IDS||{};
  const standard={
    power:String(supplied.power||''), speedrun:String(supplied.speedrun||'')
  };
  if(standard.power===original.power||standard.speedrun===original.speedrun ||
     (standard.power && standard.power===standard.speedrun)){
    standard.power='';standard.speedrun='';
  }
  // Underlying qtap-3 adapter otherwise submits to its single hardcoded power
  // leaderboard from a private watchSave() closure, bypassing public API guards.
  // Disable THAT watcher and reimplement safe, mode-scoped auto-submission.
  const auto=q.config.leaderboardAuto;
  const autoInterval=auto?.minIntervalMs||120000;
  if(auto)auto.enabled=false;
  const baseApi={
    submit:q.leaderboard.submit,
    submitAscension:q.leaderboard.submitAscension,
    open:q.leaderboard.open,
    openSpeedrun:q.leaderboard.openSpeedrun
  };
  function currentMode(){
    const st=g.__QTAP_STATE;
    if(!st?.role || !st?.game?.s?.difficulty)return null;
    const mode=st.game.s.difficulty;
    return mode==='standard'||mode==='challenge'||mode==='easy'?mode:null;
  }
  function sync(){
    const mode=currentMode();
    const dest=mode==='challenge'?original:mode==='standard'?standard:null;
    // Empty SDK IDs are fail-closed for easy, missing, or unconfigured standard;
    // no score is ever written to a challenge board by a standard/easy player.
    cfg.power=dest?.power||'';
    cfg.speedrun=dest?.speedrun||'';
    if(auto)auto.enabled=false;
    return {mode, powerReady:!!cfg.power,speedrunReady:!!cfg.speedrun};
  }
  function guard(method,kind,args){
    const state=sync();
    if(state.mode==='easy'||!state.mode)
      return Promise.resolve({skipped:true,reason:state.mode==='easy'?'easy-unranked':'no-playing-character'});
    if(!state[kind+'Ready'])
      return Promise.reject(new Error(state.mode==='standard'?'标准模式排行榜未配置独立 TapTap 榜单 ID':'挑战排行榜暂不可用'));
    const fn=baseApi[method];
    if(typeof fn!=='function')return Promise.reject(new Error('TapTap 排行榜接口不可用'));
    try{return Promise.resolve(fn.apply(q.leaderboard,args))}
    catch(e){return Promise.reject(e)}
  }
  q.leaderboard.submit=function(force){return guard('submit','power',[force]);};
  q.leaderboard.submitAscension=function(record){
    const mode=currentMode();
    if(record?.difficulty && record.difficulty!==mode)
      return Promise.reject(new Error('飞升成绩难度与角色存档不一致'));
    return guard('submitAscension','speedrun',[record]);
  };
  q.leaderboard.open=function(){return guard('open','power',[]);};
  q.leaderboard.openSpeedrun=function(){return guard('openSpeedrun','speedrun',[]);};
  q.rankDifficulty={
    sync,
    mode:currentMode,
    standardConfigured:()=>!!standard.power&&!!standard.speedrun,
    originalChallengeIdsUnchanged:()=>!!original.power&&!!original.speedrun,
    // Client IDs are not secrets; diagnostics avoid logging user identifiers.
    readiness:()=>sync()
  };
  // Begin with no leaderboard available until a SAVED/PLAYING character is
  // known. The render/persist bridge should call rankDifficulty.sync().
  sync();
  let lastTick=-1, lastSubmitAt=0, lastMode=null;
  if(typeof g.setInterval==='function')g.setInterval(function(){
    const tick=g.__QTAP_SAVE_TICK||0;
    if(tick===lastTick)return;
    lastTick=tick;
    const state=sync();
    if(!state.powerReady || !q.env?.leaderboard?.())return;
    const now=Date.now(),change=lastMode!==state.mode;
    if(!change && now-lastSubmitAt<autoInterval)return;
    lastSubmitAt=now;lastMode=state.mode;
    q.leaderboard.submit(true).catch(function(){});
  },5000);
})(globalThis);
