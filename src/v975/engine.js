/* V90.75. Inserted inside the engine closure: no global mutable player state. */
function fresh(seed=261014,character='human',birth=null,difficulty='challenge'){
 const s=_fresh975(seed,character,birth,difficulty);
 s.homeSchema=1;s.homestead=null;s.atHome=false;s.quickSlots=D.QUICK_DEFAULTS.slice();
 return s;
}
function validateHome975(home){
 if(home===null)return;
 if(!obj(home)||!Number.isInteger(home.level)||home.level<1||home.level>12||!obj(home.buildings)||!obj(home.stash)||!Array.isArray(home.storedGears)||home.storedGears.length>2000)throw Error('洞府存档格式无效，拒绝覆盖');
 for(const [id,n] of Object.entries(home.buildings))if(!D.HOME_ROOMS.includes(id)||id==='residence'||!Number.isInteger(n)||n<0||n>12)throw Error('洞府设施等级异常');
 for(const bag of [home.stash,home.pendingHarvest||{}])for(const [id,n] of Object.entries(bag))if(!own(D.ITEMS,id)||!Number.isSafeInteger(n)||n<0||n>100000000)throw Error('洞府物资数据异常，拒绝截断');
 if(!Number.isSafeInteger(home.farmAt)||home.farmAt<0)throw Error('灵田时钟异常');
}
function normalize(raw,character='human',difficulty='challenge'){
 const x=copy(raw),canonical=x.homeSchema===1;
 if(x.homeSchema!==undefined&&x.homeSchema!==1)throw Error('不支持的洞府存档版本');
 if(canonical){
  validateHome975(x.homestead);
  x.settlements=Array(12).fill(null);
  if(x.homestead)x.settlements[0]={...copy(x.homestead),pos:{x:1,y:5}};
 }
 const n=_normalize975(x,character,difficulty),homes=n.settlements.filter(Boolean);
 if(canonical){
  n.homestead=homes[0]||null;
  if(n.homestead){n.homestead.version=1;n.homestead.pendingHarvest=copy(x.homestead.pendingHarvest||{});n.homestead.migratedFrom=x.homestead.migratedFrom||0;}
 }else if(homes.length){
  const h={version:1,pos:{x:1,y:5},level:1,buildings:{},stash:{},storedGears:[],foundedAt:n.minutes,farmAt:n.minutes,pendingHarvest:{},migratedFrom:homes.length};
  let partial=0;
  for(const c of homes){
   h.level=Math.max(h.level,D.OLD_HOME_TIERS[Math.min(5,c.level)]);
   h.foundedAt=Math.min(h.foundedAt,c.foundedAt||0);
   for(const id of D.HOME_ROOMS.filter(k=>k!=='residence'))h.buildings[id]=Math.max(h.buildings[id]||0,D.OLD_HOME_TIERS[Math.min(5,c.buildings[id]||0)]);
   for(const [id,q] of Object.entries(c.stash)){const sum=(h.stash[id]||0)+q;if(!Number.isSafeInteger(sum)||sum>100000000)throw Error('合并仓物超出安全范围，原档保持不变');h.stash[id]=sum;}
   h.storedGears.push(...(c.storedGears||[]));
   const fl=c.buildings.farm||0;
   if(fl){const elapsed=Math.max(0,n.minutes-c.farmAt),batches=Math.min(3,Math.floor(elapsed/1440));partial=Math.max(partial,elapsed%1440);
    for(const [id,q] of Object.entries(D.OLD_FARM_LOOT[Math.min(5,fl)]||{}))h.pendingHarvest[id]=(h.pendingHarvest[id]||0)+q*batches;}
  }
  h.level=Math.max(h.level,...Object.values(h.buildings));h.farmAt=n.minutes-partial;
  n.homestead=h;
 }else n.homestead=null;
 // Optional historical choices remain records even after advancing beyond their realm.
 const core=x.flags?.coreTribulation,heart=x.flags?.heartTrial;
 if(core?.complete===true&&core.phase===3)n.flags.coreTribulation={phase:3,marks:integer(core.marks,0,3),started:true,complete:true};
 if(heart?.complete===true&&heart.phase===3&&Array.isArray(heart.choices)&&heart.choices.length===3&&heart.choices.every(c=>['observe','anchor','force'].includes(c)))n.flags.heartTrial={phase:3,started:true,complete:true,choices:heart.choices.slice()};
 n.homeSchema=1;n.settlements=Array(12).fill(null);
 n.atHome=!!(canonical&&x.atHome&&!n.combat&&!n.secretRealm&&!n.ended);
 n.quickSlots=D.QUICK_DEFAULTS.map((fallback,i)=>D.SUPPLIES[x.quickSlots?.[i]]?.kind===D.QUICK_KINDS[i]?x.quickSlots[i]:fallback);
 n.pendingTribulation=n.level<36&&(n.level-1)%3===2&&n.xp>=Math.round(D.REALM_BASE[Math.ceil(n.level/3)-1]*D.STAGE_MULT[2]*D.difficultyOf(n).scale)?n.level:0;
 return n;
}
Object.defineProperties(Game.prototype,{
 camp:{get(){return this.s.homestead||null;}},
 atCamp:{get(){return !!(this.s.atHome&&this.camp&&!this.s.combat&&!this.s.secretRealm);}},
 bookCount:{get(){return ['items','enemies','gears'].reduce((n,k)=>n+Object.keys(this.s.codex[k]).filter(id=>id!=='dummy').length,0)+D.HOME_ROOMS.filter(id=>this.roomLevel(id)>0).length+Object.values(this.s.storageBags).filter(Boolean).length;}},
 maxHomeTier:{get(){return Math.min(12,this.s.unlocked,this.realmIndex);}},
 vaultGearCapacity:{get(){return D.WAREHOUSE_GEAR_CAPS[this.roomLevel('warehouse')]||0;}}
});
Game.prototype.stashCapacity=function(c=this.camp){return D.WAREHOUSE_CAPS[this.roomLevel('warehouse',c)]||0;};
Game.prototype.campName=function(c=this.camp){return c?D.HOME_NAMES[c.level-1]+' · '+c.level+'阶':'本世洞府 · 尚未建造';};
Game.prototype.isCampTile=function(){return false;};
Game.prototype.entry=function(z=this.s.zone){return z?{x:0,y:5}:{x:1,y:5};};
Game.prototype.enterHome=function(){
 if(this.s.ended)return this.fail('本世已终结');
 if(this.s.combat)return this.fail('斗法中不可进入洞府');
 if(this.s.secretRealm)return this.fail('请先离开秘境，再进入洞府');
 this.s.atHome=true;return {ok:true};
};
Game.prototype.leaveHome=function(){this.s.atHome=false;return {ok:true};};
Game.prototype.canSettle=function(){
 if(this.s.combat||this.s.secretRealm)return '斗法或秘境中不能建造洞府';
 if(this.camp)return '本世已有唯一洞府，无需重复建造';
 if(!this.s.atHome)return '点击洞府按钮后建造';
 return '';
};
Game.prototype.settle=function(){
 const why=this.canSettle();if(why)return this.fail(why);
 if(!this.enough(D.SETTLE_COST))return this.fail(this.missing(D.SETTLE_COST));
 const started=this.s.minutes;if(!this.tick(120,3,3,0))return {ok:false};this.spend(D.SETTLE_COST);
 this.s.homestead={version:1,pos:{x:1,y:5},level:1,buildings:{},stash:{},storedGears:[],pendingHarvest:{},foundedAt:started,farmAt:this.s.minutes,migratedFrom:0};
 this.s.homeSchema=1;this.s.stats.settled++;this.s.stats.built++;
 this.log('草庐落成 · 本世全地图共用，设施只需建设一次','good');return this.note('唯一洞府落成 · 可修建仓房与炼器室','ok');
};
Game.prototype.buildReason=function(id){
 if(id==='gate')return this.s.ritual[0]?'青岚护山阵已完成':this.s.zone!==0?'请回青岚完成地图仪式':!this.atCamp?'请进入洞府准备护山阵':!this.enough(D.ZONES[0].need)?this.missing(D.ZONES[0].need):'';
 if(!D.HOME_ROOMS.includes(id))return '未知洞府设施';
 if(this.s.combat||this.s.secretRealm)return '当前不能营建';
 if(!this.camp)return '先在洞府页面建造草庐';
 if(!this.atCamp)return '请进入洞府营建';
 const t=this.roomLevel(id)+1,level=D.BUILDINGS[id].levels[t-1];
 if(!level)return '已达十二阶';
 if(t>this.s.unlocked)return '先开放第'+t+'图 · '+D.ZONES[t-1].name;
 if(t>this.realmIndex)return '需修至'+(D.REALM12[this.s.character]||D.REALM12.human)[t-1]+'境';
 if(id!=='residence'&&this.camp.level<t)return '先将洞府升至'+t+'阶';
 if(!this.enough(level.cost))return this.missing(level.cost);
 return '';
};
const build975=Game.prototype.build;
Game.prototype.build=function(id){
 if(id==='gate')return this.repair();
 const farm=id==='farm'&&this.roomLevel('farm')?{level:this.roomLevel('farm'),at:this.camp.farmAt}:null;
 const result=build975.call(this,id);
 if(result.ok&&farm){
  const elapsed=Math.max(0,this.s.minutes-farm.at),batches=Math.min(3,Math.floor(elapsed/1440));
  this.camp.pendingHarvest||={};
  for(const[k,n]of Object.entries(D.FARM_LOOT[farm.level]))this.camp.pendingHarvest[k]=(this.camp.pendingHarvest[k]||0)+n*batches;
  this.camp.farmAt=this.s.minutes-elapsed%1440;
 }
 return result;
};
Game.prototype.recipeRequirement=function(r){
 const t=r.mapTier||((r.zone||0)+1);
 if(t>this.s.unlocked)return '先开放第'+t+'图 · '+D.ZONES[t-1].name;
 if((r.gear||r.storageBag||r.mapTier)&&t>this.realmIndex)return '需修至'+(D.REALM12[this.s.character]||D.REALM12.human)[t-1]+'境';
 if(r.room){if(!this.atCamp)return '请进入洞府'+D.BUILDINGS[r.room].name;
  if(this.roomLevel(r.room)<r.tier)return '需'+D.BUILDINGS[r.room].name+r.tier+'阶（当前'+this.roomLevel(r.room)+'阶）';}
 else if(r.home&&!this.atCamp)return '请进入洞府炼制';
 return '';
};
const repair975=Game.prototype.repair;
Game.prototype.repair=function(){
 if(this.s.zone!==0)return repair975.call(this);
 if(this.s.combat||this.s.secretRealm)return this.fail('当前不能进行地图仪式');
 if(this.s.ritual[0])return this.fail('青岚护山阵已完成');
 if(!this.atCamp)return this.fail('进入洞府，准备青岚护山阵');
 if(!this.enough(this.zone.need))return this.fail(this.missing(this.zone.need));
 if(!this.tick(70,4,5,6))return {ok:false};this.spend(this.zone.need);this.s.ritual[0]=true;this.s.flags.repaired=true;this.xp(this.xpRatio('main'));
 return this.note('护山阵完成 · 青岚首领可挑战','ok','unlock');
};
Game.prototype.spendProgress=function(value){
 const n=Number(value);if(!Number.isSafeInteger(n)||n<0)return false;
 if(!Number.isFinite(this.s.xp)||this.s.xp<n)return false;
 this.s.xp-=n;this.s.daoXp=0;
 this.s.pendingTribulation=this.s.level<36&&this.stageIndex===3&&this.s.xp>=this.required?this.s.level:0;
 return true;
};
Game.prototype.supplyEffect=function(id){
 const base=D.SUPPLIES[id];if(!base)return null;
 return {...base,...(base.hp?{hp:Math.round(base.hp*(1+this.birthEffects.heal/100))}:{})};
};
Game.prototype.useSupply=function(id,inBattle=false,virtual=false){
 const e=this.supplyEffect(id);if(!e)return this.fail('不是可用补给');
 if(this.s.ended)return this.fail('本世已终结');
 if(inBattle&&!e.battle)return this.fail('食物与饮水不能在斗法中使用');
 if(!virtual&&!(this.s.inv[id]>0))return this.fail(D.ITEMS[id].name+'不足，请在快捷配置中更换');
 const cap={hp:this.s.maxHp,spirit:this.s.maxSpirit,hunger:100,water:100};
 const changes=Object.keys(cap).filter(k=>e[k]>0&&this.s[k]<cap[k]);
 if(!changes.length)return this.fail('对应状态已满，不消耗补给');
 if(!virtual)this.s.inv[id]--;
 const gains={};for(const k of changes){const before=this.s[k];this.s[k]=Math.min(cap[k],this.s[k]+e[k]);gains[k]=this.s[k]-before;}
 if(e.kind==='water')this.s.stats.drinks++;
 this.log('使用'+D.ITEMS[id].name+' · '+D.supplyText(gains),'good');
 return this.note(D.ITEMS[id].name+' · '+D.supplyText(gains),'ok');
};
const consume975=Game.prototype.consume;
Game.prototype.consume=function(id){if(D.SUPPLIES[id]){if(this.s.combat)return this.fail('斗法请使用战斗补给按钮');return this.useSupply(id);}return consume975.call(this,id);};
Game.prototype.setQuickSlot=function(slot,id){
 if(this.s.combat||this.s.secretRealm)return this.fail('请在非战斗、非秘境状态配置补给');
 if(!Number.isInteger(slot)||slot<0||slot>3||D.SUPPLIES[id]?.kind!==D.QUICK_KINDS[slot])return this.fail('补给类型不匹配');
 if(!(this.s.inv[id]>0)&&!this.s.codex.items[id]&&!D.QUICK_DEFAULTS.includes(id))return this.fail('尚未获得该补给');
 this.s.quickSlots[slot]=id;return this.note('已配置'+D.ITEMS[id].name,'ok');
};
Game.prototype.provision=function(){
 if(!this.storageReady||this.s.combat)return this.fail('请在洞府仓房整理行装');
 const parts=[];for(const id of this.s.quickSlots){const need=Math.max(0,4-(this.s.inv[id]||0)),wt=D.ITEMS[id].wt||1,qty=Math.min(need,this.camp.stash[id]||0,Math.max(0,Math.floor((this.capacity-this.weight)/wt)));
  if(qty){this.camp.stash[id]-=qty;this.s.inv[id]=(this.s.inv[id]||0)+qty;parts.push(D.ITEMS[id].name+'×'+qty);}}
 if(!parts.length)return this.fail('已配置补给已带足，或仓库无库存');this.s.stats.withdraws++;return this.note('行装补齐 · '+parts.join(' · '),'ok');
};
const harvest975=Game.prototype.harvestFarm;
Game.prototype.harvestFarm=function(){
 if(!this.atCamp||this.s.combat)return this.fail('请进入洞府收获');
 const pending=this.camp.pendingHarvest||{};let restored=false;
 if(Object.values(pending).some(n=>n>0)){
  if(!this.storageReady)return this.fail('灵田产出已完整保留，请先修建仓房后领取');
  for(const [id,n] of Object.entries(pending))if(n>0){this.camp.stash[id]=(this.camp.stash[id]||0)+n;this.s.codex.items[id]=(this.s.codex.items[id]||0)+n;}
  this.camp.pendingHarvest={};restored=true;this.log('保留的灵田产出已完整归仓','good');
 }
 return this.farmBatches?harvest975.call(this):restored?this.note('旧灵田产出已归仓；后续按统一灵田计时','ok'):harvest975.call(this);
};
const collapse975=Game.prototype.collapse;
Game.prototype.collapse=function(){this.s.atHome=false;return collapse975.call(this);};
const travel975=Game.prototype.travel;
Game.prototype.travel=function(z,home=false){if(home)return this.enterHome();this.s.atHome=false;return travel975.call(this,z,false);};
const act975=Game.prototype.act;
Game.prototype.act=function(name,args={}){
 if(name==='home-enter')return this.enterHome();if(name==='home-exit')return this.leaveHome();
 if(name==='quick-config')return this.setQuickSlot(Number(args.slot),args.id);
 if(this.s.atHome&&['move','gather','challenge','secret-enter','hunt','event','high-event'].includes(name))return this.fail('请先返回探索');
 return act975.call(this,name,args);
};
Game.resetSpiritRetry=spiritRetryReset;
