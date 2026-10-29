/* V90.76 — durable rescue decision; injected into the RaceSlots closure.
 * The legacy playable primary remains byte-for-byte intact until rescue succeeds
 * or the player explicitly settles death. This second key is NOT a new life.
 */
RaceSlots.prototype.rescueKey=function(id,n=1){return this.key(id,n)+'-rescue-pending-v976';};
RaceSlots.prototype.rescuePending=function(id,n=1,primary=null){
 this.check(id);this.slot(n);
 if(this.dead(id,n))return null;
 const raw=this.readKey(this.rescueKey(id,n));if(!raw)return null;
 let receipt;try{receipt=JSON.parse(raw);}catch{throw Error('救援待决记录损坏，当前档已锁定保护');}
 const state=receipt?.state;
 if(receipt?.version!==1||receipt.race!==id||receipt.slot!==n||receipt.difficulty!==this.difficulty||
    !state||state.version!==14||state.race!==id||state.character!==id||state.difficulty!==this.difficulty||
    state.ended!==true||state.life?.left!==0||state.life?.rescued!==false||
    !state.birth||!Number.isInteger(state.birth.seed)||!Number.isInteger(state.minutes)||state.minutes<0)
  throw Error('救援凭据身份或状态异常，禁止覆盖本档');
 const source=primary||this.readKey(this.key(id,n))||this.readKey(this.backupKey(id,n));
 if(!source)throw Error('救援前原档缺失，已停止自动复活与重置');
 let saved;try{saved=JSON.parse(source);}catch{throw Error('救援前存档无法核对，已停止自动复活');}
 if(saved.version!==14||saved.race!==id||saved.character!==id||saved.difficulty!==this.difficulty||
    saved.birth?.seed!==state.birth.seed||saved.birth?.name!==state.birth.name)
  throw Error('救援凭据与本档世代不符，已锁定保护');
 // The only permitted dismissal is after a durable, successfully rescued save.
 if(saved.life?.rescued===true&&saved.ended!==true&&saved.life.left>0){
  try{this.storage.removeItem(this.rescueKey(id,n));}catch{}
  return null;
 }
 if(saved.ended||saved.minutes>state.minutes)throw Error('待救援记录与主档时间发生冲突，已锁定保护');
 return state;
};
RaceSlots.prototype.markRescuePending=function(id,n,g){
 this.check(id);this.slot(n);
 if(g.s.race!==id||g.s.character!==id||g.s.difficulty!==this.difficulty||
    !g.s.ended||g.s.life.left!==0||g.s.life.rescued)throw Error('并非有效的寿尽待救援事件');
 const existing=this.rescuePending(id,n);
 if(existing)return true; // repeated visibilitychange/pagehide cannot rewrite or reset the death.
 const source=this.readKey(this.key(id,n))||this.readKey(this.backupKey(id,n));
 if(!source)throw Error('未找到救援前可恢复存档');
 const previous=JSON.parse(source);
 if(previous.race!==id||previous.character!==id||previous.difficulty!==this.difficulty||
    previous.birth?.seed!==g.s.birth.seed||previous.birth?.name!==g.s.birth.name)
  throw Error('救援前存档世代发生变化，禁止新建凭据');
 const receipt=JSON.stringify({version:1,race:id,slot:n,difficulty:this.difficulty,state:g.state()});
 this.storage.setItem(this.rescueKey(id,n),receipt);
 if(this.readKey(this.rescueKey(id,n))!==receipt)throw Error('救援凭据落盘校验失败');
 return true;
};
const readBeforeRescue976=RaceSlots.prototype.read;
RaceSlots.prototype.read=function(id,n=1){
 const found=readBeforeRescue976.call(this,id,n);
 if(found?.game){const pending=this.rescuePending(id,n);if(pending)found.pendingRescue=pending;}
 return found;
};
const saveBeforeRescue976=RaceSlots.prototype.save;
RaceSlots.prototype.save=function(id,g,n=1,options={}){
 const pending=this.rescuePending(id,n);
 if(pending&&(!g.s.life?.rescued||g.s.ended||g.s.birth?.seed!==pending.birth.seed||g.s.birth?.name!==pending.birth.name))
  throw Error('本世寿尽待救援，禁止绕过救援覆盖存档');
 const result=saveBeforeRescue976.call(this,id,g,n,options);
 if(pending){
  // A failed cleanup is not a failed rescue. read() recognizes the rescued primary.
  try{this.storage.removeItem(this.rescueKey(id,n));}catch{}
 }
 return result;
};
const statusBeforeRescue976=RaceSlots.prototype.status;
RaceSlots.prototype.status=function(id,n=1){
 const status=statusBeforeRescue976.call(this,id,n);
 if(status.status==='ready'){
  try{if(this.rescuePending(id,n))status.rescuePending=true;}
  catch(e){return {status:'invalid',role:id,slot:n,error:e.message};}
 }
 return status;
};
const newGameBeforeRescue976=RaceSlots.prototype.newGame;
RaceSlots.prototype.newGame=function(id,seed=261014,n=1,birth=null){
 // Never allow reusing a live pending slot to evade its prior death.
 if(!this.dead(id,n)&&this.rescuePending(id,n))throw Error('本档寿尽待救援，请先选择续命或接受轮回');
 const next=newGameBeforeRescue976.call(this,id,seed,n,birth);
 try{this.storage.removeItem(this.rescueKey(id,n));}catch{}
 return next;
};
const expireBeforeRescue976=RaceSlots.prototype.expire;
RaceSlots.prototype.expire=function(id,n=1){
 const ok=expireBeforeRescue976.call(this,id,n);
 if(ok)try{this.storage.removeItem(this.rescueKey(id,n));}catch{}
 return ok;
};
