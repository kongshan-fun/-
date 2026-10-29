/* Inside the engine closure. Existing rules remain authoritative. */
const roomLevel978=Game.prototype.roomLevel;
Game.prototype.roomLevel=function(id,c=this.camp){return id==='workbench'?(c?1:0):roomLevel978.call(this,id,c);};
const buildReason978=Game.prototype.buildReason;
Game.prototype.buildReason=function(id){return id==='workbench'?'工作台随洞府启用，无需建设或升级':buildReason978.call(this,id);};
const req978=Game.prototype.recipeRequirement;
Game.prototype.recipeRequirement=function(r){
 if(r.station!=='workbench')return req978.call(this,r);
 const tier=r.mapTier||1;
 if(tier>this.s.unlocked)return '先开放第'+tier+'图 · '+D.ZONES[tier-1].name;
 if(tier>this.realmIndex)return '当前境界未达到'+tier+'阶配方要求';
 if(!r.portable&&!this.atCamp)return '请进入洞府工作台';
 return '';
};

// The automatic workbench is a discoverable facility, but not an upgrade tree.
const bookCount978=Object.getOwnPropertyDescriptor(Game.prototype,'bookCount').get;
Object.defineProperty(Game.prototype,'bookCount',{get(){return bookCount978.call(this)+(this.camp?1:0);},configurable:true});
