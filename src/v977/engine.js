/* V90.77: realm-dependent nutrition and voluntary spirit substitution.
 * Integer milli-points retain fractional nutrition. Prepaid energy credit is
 * persisted, so reloads/toggles cannot erase debt or mint free substitutions.
 * This module is injected into the existing engine closure (ten script blocks).
 */
D.BIGU=Object.freeze({schema:1,units:1000,pointsPerSpirit:2,reserve:0.4,
 tiers:Object.freeze([{from:1,percent:100,label:'五谷养身'},{from:5,percent:75,label:'初步辟谷'},
 {from:7,percent:50,label:'灵息辟谷'},{from:9,percent:30,label:'辟谷精进'},
 {from:11,percent:15,label:'辟谷大成'}].map(Object.freeze))});
function biguTier977(realm){return D.BIGU.tiers.filter(t=>realm>=t.from).at(-1)||D.BIGU.tiers[0];}
function biguState977(raw,realm){
 const d={schema:1,enabled:false,noticeTier:0,hungerRemainder:0,waterRemainder:0,credit:0,spentSpirit:0,coveredUnits:0};
 if(raw===undefined||raw===null)return d;
 if(!obj(raw)||raw.schema!==1)throw Error('不支持的辟谷存档格式，请使用新版并保留原档');
 for(const [key,max] of [['hungerRemainder',999],['waterRemainder',999],['credit',1999],['spentSpirit',1e12],['coveredUnits',1e12]]){
  const v=raw[key]??0;if(!Number.isSafeInteger(v)||v<0||v>max)throw Error('辟谷结算记录异常：'+key);d[key]=v;
 }
 d.enabled=raw.enabled===true&&realm>=7;
 const tier=biguTier977(realm).from;
 d.noticeTier=[0,5,7,9,11].includes(raw.noticeTier)?Math.min(raw.noticeTier,tier===1?0:tier):0;
 return d;
}
function fresh(seed=261014,character='human',birth=null,difficulty='challenge'){
 const s=_fresh977(seed,character,birth,difficulty);s.bigu=biguState977(null,1);return s;
}
function normalize(raw,character='human',difficulty='challenge'){
 const s=_normalize977(raw,character,difficulty);
 s.bigu=biguState977(raw.bigu,D.realmIndexOf(s));return s;
}
const character977=Object.getOwnPropertyDescriptor(Game.prototype,'character').get;
Object.defineProperty(Game.prototype,'character',{get(){
 const v=character977.call(this);return this.s.character==='human'&&this.realmIndex>=7?{...v,energy:'真元'}:v;
},configurable:true});
Game.prototype.biguRecord=function(){return biguState977(this.s.bigu,this.realmIndex);};
Game.prototype.biguInfo=function(){
 const realm=this.realmIndex,tier=biguTier977(realm),b=biguState977(this.s.bigu,realm),reserve=Math.ceil(this.s.maxSpirit*D.BIGU.reserve);
 let reason=realm<7?'locked':!b.enabled?'off':this.s.ended?'ended':this.s.combat?'combat':this._biguRecovering977?'recovery':this.s.spirit<=reserve?'reserve':'active';
 return {realm,tier:tier.from,label:tier.label,percent:tier.percent,reduction:100-tier.percent,unlocked:realm>=7,
 enabled:b.enabled,noticeTier:b.noticeTier,energy:this.character.energy,reserve,reason,credit:b.credit};
};
Game.prototype.setBigu=function(enabled){
 if(typeof enabled!=='boolean')return this.fail('辟谷设置无效');
 if(this.s.ended)return this.fail('请先处理本世寿尽救援');
 if(this.realmIndex<7)return this.fail('第七境领悟后可开启灵息辟谷');
 if(this.s.combat)return this.fail('斗法结束后可调整辟谷设置');
 this.s.bigu={...biguState977(this.s.bigu,this.realmIndex),enabled};
 return this.note(enabled?'灵息辟谷已开启 · 保留四成'+this.character.energy:'灵息辟谷已关闭 · 境界自然减耗仍有效','ok');
};
Game.prototype.biguForecast=function(minutes,h=0,w=0,sp=0){
 const s=this.s,info=this.biguInfo(),b=biguState977(s.bigu,this.realmIndex),U=D.BIGU.units;
 const nonneg=v=>Number.isFinite(Number(v))?Math.max(0,Number(v)):0;
 const elapsed=Math.floor(nonneg(minutes)),rawH=nonneg(h),rawW=nonneg(w),rawS=nonneg(sp),env=this.extra(elapsed);
 const hUnits=Math.round(rawH*U*info.percent/100),wUnits=Math.round(rawW*U*info.percent/100);
 const ordinary=hUnits+wUnits,baseSpirit=rawS+nonneg(env.spirit);
 // Action and environmental energy are reserved FIRST. Only surplus above 40%
 // may be spent on optional nutrition. Environment water is never substituted.
 const budget=Math.max(0,Math.floor(s.spirit-baseSpirit-info.reserve));
 const usable=info.reason==='active'&&elapsed>0&&s.spirit-baseSpirit>info.reserve;
 const cover=usable?Math.min(ordinary,b.credit+budget*U*D.BIGU.pointsPerSpirit):0;
 const charge=cover?Math.max(0,Math.ceil((cover-b.credit)/(U*D.BIGU.pointsPerSpirit))):0;
 const hCover=ordinary?Math.floor(cover*hUnits/ordinary):0,wCover=cover-hCover;
 const hNet=hUnits-hCover,wNet=wUnits-wCover;
 const hTotal=hNet+b.hungerRemainder,wTotal=wNet+b.waterRemainder;
 const hungerCost=Math.floor(hTotal/U),waterCost=Math.floor(wTotal/U)+nonneg(env.water);
 const next={...b,hungerRemainder:hTotal%U,waterRemainder:wTotal%U,
  credit:b.credit+charge*U*D.BIGU.pointsPerSpirit-cover,
  spentSpirit:Math.min(1e12,b.spentSpirit+charge),coveredUnits:Math.min(1e12,b.coveredUnits+cover)};
 return {elapsed,rawHunger:rawH,rawWater:rawW,rawSpirit:rawS,hungerCost,waterCost,spiritCost:baseSpirit+charge,
  hEffective:hNet/U,wEffective:wNet/U+nonneg(env.water),hCovered:hCover/U,wCovered:wCover/U,
  energyCost:charge,environmentWater:nonneg(env.water),reserve:info.reserve,nextBigu:next,
  hunger:Math.max(0,s.hunger-hungerCost),water:Math.max(0,s.water-waterCost),spirit:Math.max(0,s.spirit-baseSpirit-charge)};
};
Game.prototype.survivalForecast=function(minutes,h=0,w=0,sp=0){
 const s=this.s,p=this.biguForecast(minutes,h,w,sp),b=biguState977(s.bigu,this.realmIndex);
 // Assess shortage using fractional balances, not rounded UI meters. Fully paid
 // nutrition prevents that action's starvation, but does not refill an empty bar.
 const missing=(available,cost,covered)=>available<=0?(cost===0&&covered>0?0:p.elapsed):cost>available?p.elapsed*(cost-available)/cost:0;
 const hm=missing(Math.max(0,s.hunger-b.hungerRemainder/1000),p.hEffective,p.hCovered);
 const wm=missing(Math.max(0,s.water-b.waterRemainder/1000),p.wEffective,p.wCovered);
 const sm=p.spiritCost>0?missing(s.spirit,p.spiritCost,0):0;
 const debt=Number.isFinite(s.survival?.debt)?Math.max(0,Math.min(.999999,s.survival.debt)):0;
 const raw=debt+(hm*Math.max(4,Math.ceil(s.maxHp*.002))+wm*Math.max(8,Math.ceil(s.maxHp*.004))+sm*Math.max(2,Math.ceil(s.maxHp*.001)))/60;
 const damage=Math.floor(raw+1e-8);
 return {...p,damage,debt:Math.max(0,raw-damage),hungerMinutes:hm,waterMinutes:wm,spiritMinutes:sm};
};
Game.prototype.tick=function(minutes,h=0,w=0,sp=0){
 const old=this.day,p=this.survivalForecast(minutes,h,w,sp);
 this.s.minutes+=p.elapsed;if(!this.age(p.elapsed))return false;
 this.s.hunger=p.hunger;this.s.water=p.water;this.s.spirit=p.spirit;
 this.s.bigu=p.nextBigu;this.s.survival={debt:p.debt};
 if(this.day>old)this.log('新的一天，资源与奇遇已刷新。','good');
 if(p.damage){this.s.hp-=p.damage;this.log('饥渴与耗灵随时间造成气血-'+p.damage+'（历时'+p.elapsed+'分钟）','bad');}
 if(this.s.hp<=0){this.collapse();return false;}return true;
};
// Energy recovery may not feed its own optional conversion. Passive reduction
// still applies during rest/meditation. Use finally so errors cannot leave a lock.
for(const name of ['restForecast','rest','meditate']){
 const before=Game.prototype[name];
 Game.prototype[name]=function(...args){this._biguRecovering977=(this._biguRecovering977||0)+1;try{return before.apply(this,args);}finally{this._biguRecovering977--;}};
}
const act977=Game.prototype.act;
Game.prototype.act=function(name,args={}){if(name==='bigu-toggle'){this.effects=[];return this.setBigu(args.enabled);}return act977.call(this,name,args);};
D.HELP.push({id:'bigu-v977',title:'灵息辟谷 · 境界减耗与真元／妖元',paragraphs:[
 '饱腹与饮水上限仍为100。第一至四境消耗100%，第五至六境75%，第七至八境50%，第九至十境30%，第十一至十二境15%；自然减耗无需开启。',
 '第七境领悟灵息辟谷。在洞府→修炼选择开启后，使用现有真元／妖元抵扣剩余的普通饱腹、饮水消耗。每1点能量抵扣合计2点，未用完的额度保留在本档。',
 '行动和环境所需能量优先结算；辟谷本身不会把能量扣到上限40%以下。能量恢复后自动继续，不必反复开关。战斗、调息、休整和吐纳暂停额外抵扣，自然减耗仍然有效。',
 '炎热等环境额外饮水不享受减耗或抵扣。辟谷不会补满饱腹、饮水，不直接回血；补给不足时休息恢复效率仍会下降。',
 '境界5、9、11的精进只短提示；第7境或首次进入的高境旧档只弹一次领悟界面，默认不开启。选择与不足1点的消耗余量均随当前难度、种族、档位保存。'
]});

// A pre-V90.77 completion is preserved, never silently imported into the new
// ruleset board just because the player loaded the old character once.
const ascendRules977=Game.prototype.ascend;
Game.prototype.ascend=function(...args){
 const finished=this.s.ascended,result=ascendRules977.apply(this,args);
 if(!finished&&this.s.ascended&&this.s.ascensionRecord)this.s.ascensionRecord.ruleset='bigu-v977';
 return result;
};
const normalizeRules977=normalize;
normalize=function(raw,...args){
 const s=normalizeRules977(raw,...args);
 if(s.ascensionRecord&&raw?.ascensionRecord?.ruleset==='bigu-v977')s.ascensionRecord.ruleset='bigu-v977';
 return s;
};
