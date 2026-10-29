/* V90.76 — same document closure, after the V90.75 UI augmentation. */
const persistBeforeRescue976=persist;
persist=function(){
 if(activeRole&&game?.s?.ended&&lifeRescueReady()){
  try{
   const store=game.s.difficulty===selectedDifficulty?slots:new QCharacterSlots(saveStorage,game.s.difficulty);
   store.markRescuePending(activeRole,activeSlot,game);
   saveAvailable=true;saveStatus='寿尽待救援 · 已保存决定状态，刷新不会回档';return true;
  }catch(e){saveAvailable=false;saveStatus='救援状态未落盘 · 请勿刷新';notify('救援记录无法安全保存：'+e.message,'warn');return false;}
 }
 return persistBeforeRescue976();
};
const selectCharacterBeforeRescue976=selectCharacter;
selectCharacter=function(id,mode='open',n=1){
 selectCharacterBeforeRescue976(id,mode,n);
 if(mode==='new'||!activeRole||activeRole!==id||activeSlot!==Number(n)||deathBoot)return;
 try{
  const store=game.s.difficulty===selectedDifficulty?slots:new QCharacterSlots(saveStorage,game.s.difficulty);
  const pending=store.rescuePending(id,n);
  if(pending){
   game.s=JSON.parse(JSON.stringify(pending));game.effects=[];
   panel=null;frontPage=null;modal=null;deathBoot=false;
   renderPage();render();showModal({kind:'life-rescue'});
   saveStatus='寿尽救援待选择 · 刷新后已恢复待决状态';
  }
 }catch(e){saveStatus='救援凭据异常，已锁定：'+e.message;notify(saveStatus,'warn');}
};
