/* Planted garden: one authoritative clock, atomic snapshots, no render-time loot. */
function emptyGarden978(s){return {schema:1,plots:[],starter:false,seedRng:((s.birth?.seed||s.seed||1)^0x5f3759df)>>>0||1,pity:{},legacyYield:{},legacyDue:null,harvested:0,seedsFound:0};}
function gardenBag978(v){
 if(!obj(v))throw Error('灵田待领物资格式错误');const out={};
 for(const[k,n]of Object.entries(v)){if(!own(D.ITEMS,k)||!Number.isSafeInteger(n)||n<0||n>100000000)throw Error('灵田待领数量无效');if(n)out[k]=n;}
 return out;
}
function seedGift978(s,g){
 if(g.starter)return;g.starter=true;
 for(const[id,n]of Object.entries({seedHerb:2,seedFiber:1,seedBerry:1})){s.inv[id]=(s.inv[id]||0)+n;s.codex.items[id]=(s.codex.items[id]||0)+n;}
}
function gardenNormalize978(raw,s){
 const level=s.homestead?.buildings.farm||0,cap=D.gardenCapacity(level),g=emptyGarden978(s);
 if(raw===undefined){
  const h=s.homestead;
  if(h){
   g.legacyYield=gardenBag978(h.pendingHarvest||{});h.pendingHarvest={};
   if(level){const elapsed=Math.max(0,s.minutes-h.farmAt),batches=Math.min(3,Math.floor(elapsed/1440)),part=elapsed%1440;
    if(batches)for(const[id,n]of Object.entries(D.FARM_LOOT[level]))if(n)g.legacyYield[id]=(g.legacyYield[id]||0)+n*batches;
    if(part)g.legacyDue={at:s.minutes+1440-part,loot:gardenBag978(D.FARM_LOOT[level])};
    seedGift978(s,g);
   }
  }
  g.plots=Array(cap).fill(null);return g;
 }
 if(!obj(raw)||raw.schema!==1||!Array.isArray(raw.plots)||raw.plots.length>26)throw Error('不支持的灵田存档版本或地块数据');
 if(typeof raw.starter!=='boolean')throw Error('种子领取标记异常');g.starter=raw.starter;
 for(const [key,max]of [['seedRng',4294967295],['harvested',1e9],['seedsFound',1e9]]){const n=raw[key];if(!Number.isSafeInteger(n)||n<0||n>max)throw Error('灵田计数无效：'+key);g[key]=n;}
 if(!obj(raw.pity))throw Error('种子采集记录异常');
 for(const[k,n]of Object.entries(raw.pity)){if(!own(D.CROP_SOURCES,k)||!Number.isInteger(n)||n<0||n>=30)throw Error('种子保底记录异常');g.pity[k]=n;}
 g.legacyYield=gardenBag978(raw.legacyYield||{});
 if(raw.legacyDue!==null&&raw.legacyDue!==undefined){const d=raw.legacyDue;if(!obj(d)||!Number.isSafeInteger(d.at)||d.at<0||d.at>1e8)throw Error('旧灵田到期时间无效');g.legacyDue={at:d.at,loot:gardenBag978(d.loot)};}
 g.plots=Array.from({length:cap},(_,i)=>null);
 for(let i=0;i<raw.plots.length;i++){
  const p=raw.plots[i];if(p===null)continue;
  const c=D.CROPS[p?.crop];
  if(i>=cap||!obj(p)||!c||c.tier>level||!Number.isSafeInteger(p.plantedAt)||p.plantedAt<0||p.plantedAt>s.minutes||!Number.isSafeInteger(p.readyAt)||p.readyAt!==p.plantedAt+c.minutes)throw Error('灵田作物或生长时钟异常，保留原档');
  if(p.remaining!==undefined&&(!Number.isInteger(p.remaining)||p.remaining<1||p.remaining>c.yield||p.readyAt>s.minutes))throw Error('灵田剩余收成异常');
  g.plots[i]={crop:p.crop,plantedAt:p.plantedAt,readyAt:p.readyAt,...(p.remaining===undefined?{}:{remaining:p.remaining})};
 }
 return g;
}
const fresh978=fresh;fresh=function(...a){const s=fresh978(...a);s.garden=emptyGarden978(s);return s;};
const normalize978=normalize;normalize=function(raw,...a){const s=normalize978(raw,...a);s.garden=gardenNormalize978(raw.garden,s);return s;};
Game.prototype.gardenCapacity=function(){return D.gardenCapacity(this.roomLevel('farm'));};
Game.prototype.gardenGate=function(){return this.s.ended?'本世寿尽待处理':this.s.combat?'斗法中不能管理灵田':this.s.secretRealm?'请先离开秘境':!this.atCamp?'请进入洞府灵田':!this.roomLevel('farm')?'先修建一阶灵田':'';};
Game.prototype.gardenInfo=function(){
 const cap=this.gardenCapacity(),g=this.s.garden,plots=Array.from({length:cap},(_,i)=>{const p=g.plots[i];return p?{...p,index:i,name:D.CROPS[p.crop].name,kind:D.CROPS[p.crop].kind,state:p.readyAt<=this.s.minutes?'ready':'growing',left:Math.max(0,p.readyAt-this.s.minutes)}:{index:i,state:'empty'};});
 const due=g.legacyDue&&g.legacyDue.at<=this.s.minutes,legacy=Object.values(g.legacyYield).some(n=>n>0)||Object.values(this.camp?.pendingHarvest||{}).some(n=>n>0)||!!due;
 return {capacity:cap,plots,empty:plots.filter(p=>p.state==='empty').length,ready:plots.filter(p=>p.state==='ready').length,growing:plots.filter(p=>p.state==='growing').length,legacy,legacyAt:g.legacyDue?.at??null};
};
Game.prototype.sowGarden=function(cropId,index=null,batch=false){
 const why=this.gardenGate();if(why)return this.fail(why);
 const c=D.CROPS[cropId];if(!c)return this.fail('未知种子');
 if(c.tier>this.roomLevel('farm')||c.tier>this.realmIndex||c.tier>this.s.unlocked)return this.fail('需对应地图、境界及'+c.tier+'阶灵田');
 const cap=this.gardenCapacity(),g=this.s.garden;
 const ids=batch?Array.from({length:cap},(_,i)=>i).filter(i=>!g.plots[i]):[index];
 if(!batch&&(!Number.isInteger(index)||index<0||index>=cap))return this.fail('田地编号无效');
 if(!ids.length||ids.some(i=>g.plots[i]))return this.fail('田地不为空');
 // Batch means as many as BOTH seeds and water permit, with exact preview.
 const n=batch?Math.min(ids.length,this.has(cropId),this.has('water')):1;
 if(n<1||this.has(cropId)<n||this.has('water')<n)return this.fail('播种需种子1与清水1');
 if(!this.tick(D.GARDEN.sowMinutes*n,n,n,0))return {ok:false,msg:'播种中断，未扣种子与清水'};
 this.spend({[cropId]:n,water:n});while(g.plots.length<cap)g.plots.push(null);
 for(const i of ids.slice(0,n))g.plots[i]={crop:cropId,plantedAt:this.s.minutes,readyAt:this.s.minutes+c.minutes};
 this.log('播种'+c.name+' '+n+'块 · '+c.minutes/60+'游戏小时后成熟','good');return this.note('已播种'+n+'块'+c.name,'ok');
};
Game.prototype.gardenDeposit=function(id,amount){
 let left=amount;
 if(this.storageReady){const wt=D.ITEMS[id].wt||0,fit=wt?Math.max(0,Math.floor((this.stashCapacity()-this.stashWeight())/wt)):left,n=Math.min(left,fit);if(n){this.camp.stash[id]=(this.camp.stash[id]||0)+n;left-=n;}}
 const wt=D.ITEMS[id].wt||0,fit=wt?Math.max(0,Math.floor((this.capacity-this.weight)/wt)):left,n=Math.min(left,fit);
 if(n){this.s.inv[id]=(this.s.inv[id]||0)+n;left-=n;}
 const got=amount-left;if(got)this.s.codex.items[id]=(this.s.codex.items[id]||0)+got;
 return got;
};
Game.prototype.harvestGarden=function(index=null){
 const why=this.gardenGate();if(why)return this.fail(why);const g=this.s.garden,cap=this.gardenCapacity();
 if(index!==null&&(!Number.isInteger(index)||index<0||index>=cap))return this.fail('田地编号无效');
 const ids=index===null?Array.from({length:cap},(_,i)=>i):[index];let got=0,finished=0;
 for(const i of ids){const p=g.plots[i];if(!p||p.readyAt>this.s.minutes)continue;const c=D.CROPS[p.crop],n=p.remaining??c.yield,m=this.gardenDeposit(c.item,n);got+=m;
  if(m===n){g.plots[i]=null;finished++;}else if(m)p.remaining=n-m;
 }
 if(!got)return this.fail(ids.some(i=>g.plots[i]?.readyAt<=this.s.minutes)?'仓房和行囊已满，收成仍保留在田中':'尚无成熟作物');
 g.harvested+=finished;this.s.stats.farms+=finished;this.log('灵田收获 '+got+'份 · 清空'+finished+'块，未取完留田','good');return this.note('收获'+got+'份灵植','ok');
};
Game.prototype.claimGardenLegacy=function(){
 if(this.s.ended||this.s.combat||this.s.secretRealm||!this.atCamp)return this.fail('请进入洞府领取保留产出');
 const g=this.s.garden;
 if(g.legacyDue&&g.legacyDue.at<=this.s.minutes){for(const[k,n]of Object.entries(g.legacyDue.loot))g.legacyYield[k]=(g.legacyYield[k]||0)+n;g.legacyDue=null;}
 for(const[k,n]of Object.entries(this.camp.pendingHarvest||{}))g.legacyYield[k]=(g.legacyYield[k]||0)+n;this.camp.pendingHarvest={};
 let got=0;for(const[k,n]of Object.entries(g.legacyYield)){const m=this.gardenDeposit(k,n);got+=m;g.legacyYield[k]-=m;if(!g.legacyYield[k])delete g.legacyYield[k];}
 return got?this.note('旧灵田保留产出已领'+got+'份','ok'):this.fail(Object.keys(g.legacyYield).length?'空间不足，保留产出未丢失':'暂无到期的旧灵田产出');
};
Game.prototype.clearGarden=function(index){
 const why=this.gardenGate();if(why)return this.fail(why);if(!Number.isInteger(index)||index<0||index>=this.gardenCapacity())return this.fail('田地编号无效');
 const p=this.s.garden.plots[index];if(!p)return this.fail('本来就是空地');if(p.readyAt<=this.s.minutes)return this.fail('成熟作物请收获，不可误铲');
 this.s.garden.plots[index]=null;return this.note('已清理田地；种子不返还','ok');
};
const buildGarden978=Game.prototype.build;
Game.prototype.build=function(id){
 if(id!=='farm')return buildGarden978.call(this,id);
 const why=this.buildReason(id);if(why)return this.fail(why);const lv=this.roomLevel(id)+1,def=D.BUILDINGS.farm.levels[lv-1];
 if(!this.tick(def.minutes,3,3,3))return {ok:false};this.spend(def.cost);this.camp.buildings.farm=lv;this.camp.farmAt=this.s.minutes;this.s.stats.built++;
 while(this.s.garden.plots.length<D.gardenCapacity(lv))this.s.garden.plots.push(null);
 if(lv===1)seedGift978(this.s,this.s.garden);
 return this.note('灵田'+lv+'阶 · '+D.gardenCapacity(lv)+'块，原作物进度保留','ok');
};
Game.prototype.farmRemaining=function(){if(!this.gardenCapacity())return null;const xs=this.gardenInfo().plots.filter(p=>p.state!=='empty').map(p=>p.left);return xs.length?Math.min(...xs):0;};
Object.defineProperty(Game.prototype,'farmBatches',{get(){return this.gardenInfo().ready;},configurable:true});
Object.defineProperty(Game.prototype,'farmReady',{get(){const i=this.gardenInfo();return !!(i.ready||i.legacy);},configurable:true});
Game.prototype.harvestFarm=function(){return this.gardenInfo().ready?this.harvestGarden():this.claimGardenLegacy();};
const gatherGarden978=Game.prototype.gather;
Game.prototype.gather=function(i){
 const source=this.resource(Number(i)),crop=D.CROP_SOURCES[source],before=this.s.stats.gathers;
 const result=gatherGarden978.call(this,i);
 if(result?.ok&&this.s.stats.gathers===before+1&&crop&&!this.s.ended){
  const g=this.s.garden;g.seedRng=(Math.imul(g.seedRng,1664525)+1013904223)>>>0;
  const misses=(g.pity[source]||0)+1,pity=source==='twig'?30:12,rate=source==='twig'?.06:.18;
  if(misses>=pity||g.seedRng/4294967296<rate){g.pity[source]=0;g.seedsFound++;this.loot({[crop]:1},'采集附获种子',false);}else g.pity[source]=misses;
 }
 return result;
};
const actGarden978=Game.prototype.act;
Game.prototype.act=function(name,args={}){
 if(['garden-sow','garden-harvest','garden-clear','garden-legacy'].includes(name)){
  this.effects=[];if(name==='garden-sow')return this.sowGarden(args.crop,args.index??null,args.batch===true);
  if(name==='garden-harvest')return this.harvestGarden(args.index??null);
  if(name==='garden-clear')return this.clearGarden(args.index);
  return this.claimGardenLegacy();
 }
 return actGarden978.call(this,name,args);
};
// Gardening changes economy: keep historical ranks without reclassifying them.
const ascendGarden978=Game.prototype.ascend;
Game.prototype.ascend=function(...args){const done=this.s.ascended,r=ascendGarden978.apply(this,args);if(!done&&this.s.ascended)this.s.ascensionRecord.ruleset='garden-v978';return r;};
const normalizeGardenRank978=normalize;
normalize=function(raw,...args){const s=normalizeGardenRank978(raw,...args);if(s.ascensionRecord&&raw?.ascensionRecord?.ruleset==='garden-v978')s.ascensionRecord.ruleset='garden-v978';return s;};
