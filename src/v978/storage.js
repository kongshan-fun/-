/* Store the original slot before first garden migration; never overwrite archive. */
RaceSlots.prototype.gardenArchiveKey=function(id,n=1){return this.key(id,n)+'-pre-garden-v978';};
const saveGarden978=RaceSlots.prototype.save;
RaceSlots.prototype.save=function(id,g,n=1,options={}){
 this.check(id);this.slot(n);
 for(const key of [this.key(id,n),this.backupKey(id,n)]){
  const raw=this.readKey(key);if(!raw)continue;let old;try{old=JSON.parse(raw);}catch{continue;}
  if(old.version!==14||!old.rebuilt||old.garden!==undefined)continue;
  if(old.race!==id||old.difficulty!==this.difficulty)throw Error('旧灵田归档身份不符');
  const archive=this.gardenArchiveKey(id,n),prior=this.readKey(archive);
  if(!prior){this.storage.setItem(archive,raw);if(this.readKey(archive)!==raw)throw Error('灵田升级前归档校验失败，取消覆盖');}
  break;
 }
 return saveGarden978.call(this,id,g,n,options);
};

// Pending rescue receipts can originate in V90.77. Adapt a temporary alive
// snapshot, then restore the exact dead-state fields. Never rewrite the receipt.
const rescueGarden978=RaceSlots.prototype.rescuePending;
RaceSlots.prototype.rescuePending=function(id,n=1,primary=null){
 const dead=rescueGarden978.call(this,id,n,primary);if(!dead||dead.garden!==undefined)return dead;
 const temp={...dead,ended:false,life:{...dead.life,left:1}};
 const migrated=new Game(temp,1,id,null,this.difficulty).state();
 return {...dead,garden:migrated.garden,inv:migrated.inv,homestead:migrated.homestead,homeSchema:migrated.homeSchema,settlements:migrated.settlements};
};
