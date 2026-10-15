/* Pure, deterministic gameplay. No DOM, timers, network or browser storage here. */
(function(root){
'use strict';
const D=root.QData||(typeof require==='function'?require('./data.js'):null);
const copy=x=>JSON.parse(JSON.stringify(x));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const integer=(n,a=0,b=1000000)=>Number.isFinite(Number(n))?clamp(Math.floor(Number(n)),a,b):a;
const obj=x=>x&&typeof x==='object'&&!Array.isArray(x);
const pos=p=>obj(p)&&Number.isInteger(p.x)&&Number.isInteger(p.y)&&p.x>=0&&p.x<8&&p.y>=0&&p.y<8;
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
function fresh(seed=261014){return {
 version:10,seed:integer(seed,1,4294967295),zone:0,unlocked:1,ritual:Array(5).fill(false),cleared:Array(5).fill(false),
 pos:{x:1,y:5},last:{x:1,y:5},minutes:420,seen:{},visited:{},scouted:{},nodeHarvest:{},events:{},sites:{},campRests:{},bossDaily:{},
 hp:100,maxHp:100,hunger:84,water:81,spirit:92,maxSpirit:100,attack:7,level:1,xp:0,
 settlements:Array(5).fill(null),caches:{},pillDaily:{day:1,uses:0},life:{left:D.LIFE.initialYears*D.LIFE.yearMinutes,losses:0,elixirs:0},ended:false,
 inv:{wood:2,stone:1,fiber:2,berry:4,water:3,salve:2},stash:{},gears:[],pending:[],equipped:{weapon:null,armor:null},nextGear:1,
 codex:{items:{},enemies:{},gears:{},claims:{}},buffs:{fireward:0,detox:0},
 flags:{repaired:false,boss:false,talisman:false,complete:false},meditation:{day:1,uses:0},combat:null,
 stats:{steps:0,kills:0,defeats:0,gathers:0,scouts:0,wood:0,drinks:0,books:0,travels:0,training:0,forestMoves:0,crafted:0,events:0,bossWins:0,settled:0,built:0,stores:0,withdraws:0,farms:0,pillsMade:0,relocations:0},
 guide:{status:'new',step:0,base:{},rewarded:false},settings:{motion:true},logs:[]
};}
function normalize(raw){
 if(!obj(raw)||![1,2,5,7,8,9,10].includes(raw.version)||!obj(raw.inv)||!pos(raw.pos))throw Error('不是可识别的青岚问道存档');
 const o=copy(raw),n=fresh(o.seed);const legacy=o.version<7;
 if(o.version===10){
  if(o.ended||!obj(o.life)||!Number.isInteger(o.life.left)||o.life.left<=0||o.life.left>200*D.LIFE.yearMinutes)throw Error('寿元已尽或寿元数据无效，无法恢复');
  n.life={left:o.life.left,losses:integer(o.life.losses,0,999),elixirs:integer(o.life.elixirs,0,D.LIFE.elixirLimit)};
 }else{
  // V9 and earlier migration starts a *new* lifespan era: never retroactively erase years of valid saves.
  const boosts=Object.entries(D.LIFE.breakthroughYears).reduce((v,[level,yrs])=>v+(integer(o.level,1,18)>=Number(level)?yrs:0),0);
  const penalties=Math.min(2,integer(o.stats?.defeats,0,10000))*D.LIFE.defeatYears;
  n.life={left:Math.max(8,D.LIFE.initialYears+boosts-penalties)*D.LIFE.yearMinutes,losses:Math.min(2,integer(o.stats?.defeats,0,10000)),elixirs:0};
 }
 n.level=integer(o.level,1,18);n.maxHp=100+9*(n.level-1);n.maxSpirit=100+2*(n.level-1);n.attack=7+n.level-1;
 n.minutes=integer(o.minutes,0,52560000);n.hp=integer(o.hp,1,n.maxHp);n.spirit=integer(o.spirit,0,n.maxSpirit);
 n.hunger=integer(o.hunger,0,100);n.water=integer(o.water,0,100);n.xp=integer(o.xp,0,10+n.level*5-1);
 n.zone=integer(o.zone,0,4);n.pos=copy(o.pos);n.last=pos(o.last)?copy(o.last):copy(o.pos);
 n.ritual=Array.from({length:5},(_,i)=>!!o.ritual?.[i]);n.cleared=Array.from({length:5},(_,i)=>!!o.cleared?.[i]);
 if(o.version<=2){n.zone=0;n.ritual[0]=!!o.flags?.repaired;n.cleared[0]=!!o.flags?.boss;}
 let unlocked=1;for(let i=0;i<5;i++){if(!n.cleared[i])break;n.ritual[i]=true;unlocked=Math.min(5,i+2);}n.unlocked=unlocked;
 if(n.zone>=n.unlocked){n.zone=n.unlocked-1;n.pos=n.zone?{x:0,y:5}:{x:1,y:5};n.last=copy(n.pos);}
 n.flags={repaired:n.ritual[0],boss:n.cleared[0],talisman:!!o.flags?.talisman,complete:n.cleared.every(Boolean)};
 for(const bag of ['inv','stash']){n[bag]={};for(const k of Object.keys(D.ITEMS)){let v=integer(o[bag]?.[k]);if(v)n[bag][k]=v;}}
 for(const kind of ['seen','visited','scouted','events']){
  n[kind]={};for(let [k,v] of Object.entries(obj(o[kind])?o[kind]:{})){
   if(o.version<=2&&!k.includes(':'))k='0:'+k;
   if(/^[0-4]:[0-7],[0-7]$/.test(k)&&v)n[kind][k]=true;
  }
 }
 n.nodeHarvest={};for(let [k,v] of Object.entries(obj(o.nodeHarvest)?o.nodeHarvest:{})){
  if(o.version<=2&&!k.includes(':'))k='0:'+k;
  if(/^[0-4]:[0-7],[0-7]#[0-9]$/.test(k)&&obj(v))n.nodeHarvest[k]={day:integer(v.day,1,50000),used:integer(v.used,0,20)};
 }
 for(const key of ['sites','bossDaily','campRests']){
  for(const [k,v] of Object.entries(obj(o[key])?o[key]:{}).slice(0,300))if(/^[\w:,-]+$/.test(k))n[key][k]=integer(v,0,50000);
 }
 n.meditation={day:integer(o.meditation?.day,1,50000),uses:integer(o.meditation?.uses,0,3)};
 const addGear=(g,fromLegacy=false,pending=false)=>{
  const r=D.RECIPES.find(r=>r.id===g.recipe&&r.gear);if(!r)return null;
  let id=typeof g.id==='string'&&/^g\d{1,9}$/.test(g.id)?g.id:'g'+n.nextGear++;
  if([...n.gears,...n.pending].some(x=>x.id===id))id='g'+n.nextGear++;
  n.nextGear=Math.max(n.nextGear,Number(id.slice(1))+1);
  const q={id,recipe:r.id,quality:integer(g.quality,0,4),refine:integer(g.refine,0,3),affixes:[],source:String(g.source||'旧物').slice(0,24)};if(pending)q.where=/^[0-4]:[0-7],[0-7]$/.test(g.where)?g.where:'0:1,5';
  const seen=new Set();for(const a of (Array.isArray(g.affixes)?g.affixes:[]).slice(0,2))if(D.AFFIXES[a.id]?.slot===r.gear&&!seen.has(a.id)){q.affixes.push({id:a.id,value:integer(a.value,1,20)});seen.add(a.id);}
  q.affixes=q.affixes.slice(0,D.QUALITIES[q.quality].count);(pending?n.pending:n.gears).push(q);return id;
 };
 if(!legacy){
  for(const g of (Array.isArray(o.gears)?o.gears:[]).slice(0,36))if(obj(g))addGear(g);
  for(const g of (Array.isArray(o.pending)?o.pending:[]).slice(0,64))if(obj(g))addGear(g,false,true);
  for(const slot of ['weapon','armor'])if(n.gears.some(g=>g.id===o.equipped?.[slot]&&D.RECIPES.find(r=>r.id===g.recipe)?.gear===slot))n.equipped[slot]=o.equipped[slot];
 }else{
  for(const slot of ['weapon','armor'])if(o.gear?.[slot])n.equipped[slot]=addGear({recipe:o.gear[slot],source:'V'+o.version+'迁移'});
 }
 for(const k of Object.keys(n.stats))n.stats[k]=integer(o.stats?.[k]??o[k],0,10000000);
 n.buffs={fireward:integer(o.buffs?.fireward,0,52560000),detox:integer(o.buffs?.detox,0,52560000)};
 for(const kind of ['items','enemies','gears']){
  const valid=kind==='items'?D.ITEMS:kind==='enemies'?D.ENEMIES:Object.fromEntries(D.RECIPES.filter(r=>r.gear).map(r=>[r.id,r]));
  for(const [k,v] of Object.entries(obj(o.codex?.[kind])?o.codex[kind]:{}))if(own(valid,k)&&k!=='dummy')n.codex[kind][k]=integer(v,1,1000000);
 }
 for(const r of D.BOOK_REWARDS)if(o.codex?.claims?.[r.id])n.codex.claims[r.id]=true;
 for(const [id,count] of Object.entries({...n.inv,...n.stash}))if(count>0)n.codex.items[id]||=1;
 for(const g of [...n.gears,...n.pending])n.codex.gears[g.recipe]||=1;
 if(!legacy){
  const g=o.guide||{};n.guide={status:['new','active','paused','skipped','done'].includes(g.status)?g.status:'paused',step:integer(g.step,0,D.GUIDE.length),base:{},rewarded:!!g.rewarded};
  for(const k of Object.keys(n.stats))n.guide.base[k]=integer(g.base?.[k],0,10000000);
  if(n.guide.step===D.GUIDE.length)n.guide.status='done';
 }else n.guide.status='paused';
 n.settings={motion:o.settings?.motion!==false};
 n.logs=(Array.isArray(o.logs)?o.logs:[]).filter(obj).slice(0,80).map(l=>({time:String(l.time||'').slice(0,30),msg:String(l.msg||'').slice(0,300),tone:['good','bad',''].includes(l.tone)?l.tone:''}));
 if(obj(o.combat)){
  const t=o.combat.type==='boss'?'boss0':o.combat.type,e=D.ENEMIES[t];
  if(e){
   const training=t==='dummy',repeat=!!o.combat.repeat,maxHp=Math.round(e.hp*(repeat?1.25:1));
   n.combat={type:t,hp:integer(o.combat.hp,1,maxHp),maxHp,atk:Math.round(e.atk*(repeat?1.25:1)),armor:e.armor,turn:integer(o.combat.turn,1,1000),riposte:integer(o.combat.riposte,0,10),intent:['heavy','attack','recover'].includes(o.combat.intent)?o.combat.intent:'attack',training,repeat,virtualHeals:integer(o.combat.virtualHeals,0,3)};
   if(training){const before=obj(o.combat.before)?o.combat.before:n;n.combat.before={hp:integer(before.hp,1,n.maxHp),spirit:integer(before.spirit,0,n.maxSpirit),hunger:integer(before.hunger,0,100),water:integer(before.water,0,100)};}
   const pending=o.combat.siteReward;if(obj(pending)&&D.SITES[pending.key]?.choices?.[pending.choice])n.combat.siteReward={key:pending.key,choice:integer(pending.choice,0,1)};
  }
 }
 // V9 migration is isolated to the new save key. Source saves remain untouched.
 const cleanBag=raw=>{const b={};for(const k of Object.keys(D.ITEMS)){const v=integer(raw?.[k]);if(v)b[k]=v;}return b;};
 if(o.version>=9){
  if(!Array.isArray(o.settlements)||o.settlements.length!==5)throw Error('洞府数据不完整');
  n.settlements=o.settlements.map((c,z)=>{
   if(c===null)return null;
   if(!obj(c)||!pos(c.pos)||!D.CAMP_LANDS.includes(D.ZONES[z].map[c.pos.y][c.pos.x])||D.SITES[z+':'+c.pos.x+','+c.pos.y]||D.EVENTS[z+':'+c.pos.x+','+c.pos.y])throw Error('洞府选址无效');
   const v={pos:copy(c.pos),level:integer(c.level,1,3),buildings:{},stash:cleanBag(c.stash),foundedAt:integer(c.foundedAt,0,n.minutes),farmAt:integer(c.farmAt,0,n.minutes)};
   for(const [id,d] of Object.entries(D.BUILDINGS))if(id!=='residence'&&(d.zone===undefined||d.zone===z)){const level=integer(c.buildings?.[id],0,d.levels.length);if(level)v.buildings[id]=level;}
   if(Object.keys(v.stash).length&&!v.buildings.warehouse)throw Error('未建仓房却存在仓物，请检查存档');
   return v;
  });
  n.caches={};for(const [k,v] of Object.entries(obj(o.caches)?o.caches:{}))if(/^[0-4]:[0-7],[0-7]$/.test(k)&&obj(v))n.caches[k]=cleanBag(v);
  n.pillDaily={day:integer(o.pillDaily?.day,1,50000),uses:integer(o.pillDaily?.uses,0,2)};
  n.stash={};
 }else{
  const tier=n.unlocked>=4?3:n.unlocked>=2?2:1;
  n.settlements=Array.from({length:5},(_,z)=>z<n.unlocked?{
   pos:z?{x:0,y:5}:{x:1,y:5},level:tier,buildings:{warehouse:z?1:3,forge:tier,alchemy:tier,gate:z===0&&n.ritual[0]?1:0},
   stash:z?{}:copy(n.stash),foundedAt:n.minutes,farmAt:n.minutes
  }:null);
  n.stash={};n.guide={status:'paused',step:0,base:copy(n.stats),rewarded:!!o.guide?.rewarded};
 }
 return n;
}
class Game{
 constructor(raw=null,seed=261014){this.s=raw?normalize(raw):fresh(seed);this.effects=[];this.reveal();if(!raw){for(const [k,n] of Object.entries(this.s.inv))if(n)this.s.codex.items[k]=1;this.log('抵达废弃营坪。先备工具，择地筑庐。','good');}}
 get data(){return D;} state(){return copy(this.s);} get zone(){return D.ZONES[this.s.zone];}
 get day(){return Math.floor(this.s.minutes/1440)+1;} get hour(){return Math.floor(this.s.minutes%1440/60);}
 get clock(){const m=this.s.minutes%1440;return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');}
 get night(){return this.hour>=18||this.hour<6;} get realm(){const l=this.s.level;return l<=9?'炼气'+['','一','二','三','四','五','六','七','八','九'][l]+'层':l<=12?'筑基初期':l<=15?'筑基中期':'筑基后期';}
 get lifeYears(){return Math.max(0,this.s.life.left/D.LIFE.yearMinutes);} get required(){return 10+this.s.level*5;} key(x=this.s.pos.x,y=this.s.pos.y,z=this.s.zone){return `${z}:${x},${y}`;}
 land(x=this.s.pos.x,y=this.s.pos.y){return this.zone.map[y]?.[x];}
 get site(){return D.SITES[this.key()]||null;} get name(){return this.atCamp?this.campName():this.site?.name||D.NAMED[this.key()]?.[0]||D.LAND[this.land()]?.name;}
 get weight(){return Object.entries(this.s.inv).reduce((n,[k,q])=>n+(D.ITEMS[k]?.wt||0)*q,0);} get capacity(){return 46+3*(this.s.level-1);}
 has(id){return (this.s.inv[id]||0)+(this.localStash[id]||0);}
 random(){this.s.seed=(Math.imul(this.s.seed,1664525)+1013904223)>>>0;return this.s.seed/4294967296;}
 dice(a,b){return Math.floor(a+this.random()*(b-a+1));}
 log(msg,tone=''){this.s.logs.unshift({time:`${this.day}日 ${this.clock}`,msg,tone});this.s.logs=this.s.logs.slice(0,80);}
 note(msg,tone='info',kind='toast'){this.effects.push({msg,tone,kind});return {ok:true,msg,tone};}
 fail(msg){this.effects.push({msg,tone:'warn',kind:'toast'});return {ok:false,msg,tone:'warn'};}
 reveal(r=1){const p=this.s.pos;for(let y=p.y-r;y<=p.y+r;y++)for(let x=p.x-r;x<=p.x+r;x++)if(x>=0&&x<8&&y>=0&&y<8)this.s.seen[this.key(x,y)]=true;this.s.visited[this.key()]=true;}
 enough(cost){return Object.entries(cost).every(([k,n])=>this.has(k)>=n);}
 spend(cost){for(const [k,n] of Object.entries(cost)){const a=Math.min(n,this.s.inv[k]||0);this.s.inv[k]=(this.s.inv[k]||0)-a;if(n>a)this.camp.stash[k]=(this.camp.stash[k]||0)-(n-a);}}
 missing(cost){return Object.entries(cost).filter(([k,n])=>this.has(k)<n).map(([k,n])=>D.ITEMS[k].name+'缺'+(n-this.has(k))).join('、');}
 loot(data,source='获得',overflow=true){
  const parts=[],dropped=[];for(const [k,n] of Object.entries(data)){
   if(!own(D.ITEMS,k)||!Number.isInteger(n)||n<1)continue;const w=D.ITEMS[k].wt;
   const fits=w?Math.max(0,Math.floor((this.capacity-this.weight)/w)):n,amount=Math.min(n,fits);
   if(amount){this.s.inv[k]=(this.s.inv[k]||0)+amount;parts.push(`${D.ITEMS[k].name}+${amount}`);}
   if(n>amount&&overflow){const cache=this.s.caches[this.key()]||={};cache[k]=(cache[k]||0)+n-amount;dropped.push(`${D.ITEMS[k].name}+${n-amount}`);}
   if(amount||overflow)this.s.codex.items[k]=(this.s.codex.items[k]||0)+n;
  }
  const summary=parts.join(' · ')+(dropped.length?'；原地待拾 '+dropped.join(' · '):'');
  if(summary)this.log(source+'：'+summary,'good');return summary;
 }
 xp(amount){if(this.s.level>=18)return;this.s.xp+=amount;while(this.s.level<18&&this.s.xp>=this.required){this.s.xp-=this.required;this.s.level++;this.s.attack++;this.s.maxHp+=9;this.s.maxSpirit+=2;this.s.hp=Math.min(this.s.maxHp,this.s.hp+12);this.s.spirit=Math.min(this.s.maxSpirit,this.s.spirit+9);const years=D.LIFE.breakthroughYears[this.s.level]||0;if(years){this.s.life.left+=years*D.LIFE.yearMinutes;this.log('突破增寿 '+years+'年','good');}this.log('突破 · '+this.realm,'good');}if(this.s.level>=18)this.s.xp=0;}
 expire(reason){if(this.s.ended)return;this.s.ended=true;this.s.life.left=0;this.s.hp=0;this.s.combat=null;this.log('寿元耗尽 · '+reason,'bad');this.effects.push({msg:'寿元耗尽 · 本轮已终结',tone:'warn',kind:'permadeath'});}
 age(minutes){if(this.s.ended)return false;this.s.life.left=Math.max(0,this.s.life.left-minutes);if(!this.s.life.left){this.expire('修行岁月已尽');return false;}return true;}
 extra(minutes){return {water:this.s.zone===2&&this.s.buffs.fireward<=this.s.minutes?Math.ceil(minutes/30):0,spirit:(this.s.zone===4||(this.s.zone===3&&this.s.buffs.detox<=this.s.minutes))?Math.ceil(minutes/30):0};}
 tick(minutes,h=0,w=0,sp=0){const old=this.day,e=this.extra(minutes);this.s.minutes+=minutes;if(!this.age(minutes))return false;this.s.hunger=Math.max(0,this.s.hunger-h);this.s.water=Math.max(0,this.s.water-w-e.water);this.s.spirit=Math.max(0,this.s.spirit-sp-e.spirit);
  if(this.day>old)this.log('新的一天，资源与奇遇已刷新。','good');
  if(!this.s.hunger||!this.s.water){this.s.hp-=6;this.log('饥渴耗损气血6。','bad');}if(!this.s.spirit){this.s.hp-=2;this.log('灵力耗尽，气血-2。','bad');}
  if(this.s.hp<=0){this.collapse();return false;}return true;
 }
 collapse(){
  if(this.s.ended)return;
  this.s.stats.defeats++;this.s.life.losses++;this.s.minutes+=720;
  this.s.life.left=Math.max(0,this.s.life.left-D.LIFE.defeatYears*D.LIFE.yearMinutes-720);
  if(!this.s.life.left){this.expire('重伤折寿'+D.LIFE.defeatYears+'年');return;}
  for(const [k,q] of Object.entries(this.s.inv))if(D.ITEMS[k]?.type==='material'&&k!=='dust')this.s.inv[k]=q-Math.floor(q/2);this.s.pos=this.entry();this.s.last=copy(this.s.pos);this.s.combat=null;this.s.hp=Math.max(50,Math.round(this.s.maxHp*.6));this.s.spirit=Math.round(this.s.maxSpirit*.75);this.s.hunger=48;this.s.water=52;this.reveal();this.log((this.camp?'负伤返回洞府':'负伤返回旧营坪')+'，折寿'+D.LIFE.defeatYears+'年，遗失一半随身普通材料。','bad');this.note(this.camp?'负伤回府 · 设施与仓库保留':'返回旧营坪 · 装备与境界保留','warn');}
 entry(z=this.s.zone){return this.s.settlements[z]?copy(this.s.settlements[z].pos):z?{x:0,y:5}:{x:1,y:5};}
 resource(i){return Number.isInteger(i)&&i>=0&&i<10?D.RESOURCE_LAYOUT[this.land()]?.[i]:null;}
 left(i){const k=this.resource(i);if(!k)return 0;const h=this.s.nodeHarvest[this.key()+'#'+i];return h?.day===this.day?Math.max(0,D.RES[k].max-h.used):D.RES[k].max;}
 requirement(k){const r=D.RES[k];if(!r)return '没有可采集的资源';if(r.tool&&!this.s.inv[r.tool])return '缺少'+D.ITEMS[r.tool].name+'（须随身携带）';if(r.level&&this.s.level<r.level)return `需炼气${r.level}层`;const need=(r.spirit||3)+this.extra(r.minutes).spirit;if(this.s.spirit<need)return '灵力不足，需'+need;return '';}
 gather(i){if(this.s.combat)return this.fail('斗法中不能采集');const k=this.resource(i);if(!k)return this.fail('这里没有可采资源');if(!this.left(i))return this.fail('已采完，次日恢复');const r=D.RES[k],why=this.requirement(k);if(why)return this.fail(why);const w=Object.entries(r.loot).reduce((n,[k,v])=>n+D.ITEMS[k].wt*v,0);if(this.weight+w>this.capacity)return this.fail('负重不足，先归营存仓');
  const startDay=this.day,key=this.key()+'#'+i,used=this.s.nodeHarvest[key]?.day===startDay?this.s.nodeHarvest[key].used:0;
  if(!this.tick(r.minutes,2,2,r.spirit||3))return {ok:false,msg:'已负伤归营'};
  // Resource use is charged to the day the action started, even across midnight.
  this.s.nodeHarvest[key]={day:startDay,used:used+1};this.s.stats.gathers++;if(k==='wood')this.s.stats.wood++;
  const msg=this.loot(r.loot,r.name,false);this.xp(r.xp);return this.note(msg+' · 修为+'+r.xp,'ok');
 }
 move(x,y){if(this.s.combat)return this.fail('斗法中不能移动');if(!pos({x,y})||Math.max(Math.abs(x-this.s.pos.x),Math.abs(y-this.s.pos.y))!==1)return this.fail('只能逐格移动');const land=this.land(x,y);
  if(land==='boss'&&!this.s.ritual[this.s.zone])return this.fail('先完成'+this.zone.verb);if(land==='gate'&&!this.s.cleared[this.s.zone])return this.fail('击败本境首领后开放');
  this.s.last=copy(this.s.pos);this.s.pos={x,y};this.s.stats.steps++;if(land==='forest')this.s.stats.forestMoves++;this.reveal();if(!this.tick(30,2,3,3))return {ok:false};
  const oldEvent=D.EVENTS[this.key()];if(oldEvent&&!this.s.events[this.key()]){this.s.events[this.key()]=true;this.loot(oldEvent.loot,'遗迹拾取');}
  if(land==='boss'&&!this.s.cleared[this.s.zone]){this.startBattle(this.zone.boss);return {ok:true,stop:true};}
  if(land==='gate'){this.note('界碑已开放，点“下一境”出行');return {ok:true,stop:true};}
  if(this.site){this.note('发现'+this.site.name+' · 可探查');return {ok:true,stop:true};}
  const protect=this.s.zone===0&&!this.s.equipped.weapon&&this.s.stats.steps<12;
  const safe=this.atCamp||['campsite','bazaar','spring'].includes(land);
  const rate={plain:.055,forest:.08,ridge:.09,mine:.12,ruins:.13,flowerfield:.07,pond:.07,crag:.14,volcano:.15,marsh:.14,tomb:.16,astral:.15,spire:.18,shrine:.05}[land]||0;
  if(!protect&&!safe&&this.s.stats.steps>3&&this.random()<rate+(this.night?.02:0)){
   const enemy=this.s.zone===0?(land==='mine'||land==='ruins'?'guard':land==='plain'?'rabbit':this.random()<.55?'wolf':'sprite'):this.s.zone===1?(land==='pond'?'fishbeast':'river'):['','','firebeast','wraith','sentinel'][this.s.zone];this.startBattle(enemy);return {ok:true,stop:true};
  }return {ok:true};
 }
 path(x,y){if(!pos({x,y}))return [];const p=this.s.pos,start=p.x+','+p.y,end=x+','+y,queue=[copy(p)],seen=new Set([start]),prev={};
  for(let i=0;i<queue.length;i++){const v=queue[i];if(v.x===x&&v.y===y)break;for(const [dx,dy] of [[1,0],[-1,0],[0,-1],[0,1],[1,-1],[-1,-1],[1,1],[-1,1]]){const nx=v.x+dx,ny=v.y+dy,k=nx+','+ny;if(!pos({x:nx,y:ny})||seen.has(k))continue;const l=this.land(nx,ny);if(l==='boss'&&(!this.s.ritual[this.s.zone]||k!==end))continue;if(l==='gate'&&(!this.s.cleared[this.s.zone]||k!==end))continue;seen.add(k);prev[k]=v;queue.push({x:nx,y:ny});}}
  if(!seen.has(end))return [];const out=[];let n={x,y};while(n.x+','+n.y!==start){out.push(n);n=prev[n.x+','+n.y];if(!n)return [];}return out.reverse();
 }
 travel(z,home=false){if(this.s.combat)return this.fail('斗法中不能出行');if(!Number.isInteger(z)||z<0||z>4)return this.fail('无效目的地');if(z>=this.s.unlocked)return this.fail('先击败'+D.ENEMIES[D.ZONES[this.s.unlocked-1].boss].name);if(z===this.s.zone&&!home)return this.note('已在'+this.zone.name);
  if(home&&!this.s.settlements[z])return this.fail('本境尚未定居，请先筑庐');if(z===this.s.zone&&this.workshop)return this.note('已经在洞府');if(!this.tick(z===this.s.zone?30:60,z===this.s.zone?2:5,z===this.s.zone?3:6,z===this.s.zone?3:5))return {ok:false};
  this.s.zone=z;this.s.pos=this.entry(z);this.s.last=copy(this.s.pos);this.reveal();this.log('抵达'+(this.camp?this.campName():this.zone.name+'旧营坪'));return this.note(this.camp?'抵达自建洞府':'抵达旧营坪 · 尚未定居','ok');
 }
 scout(){if(this.s.combat)return this.fail('斗法中不能勘察');if(this.s.scouted[this.key()])return this.fail('此处已勘察');const before=Object.keys(this.s.seen).length;if(!this.tick(30,2,3,5))return {ok:false};this.reveal(this.s.flags.talisman?3:2);this.s.scouted[this.key()]=true;this.s.stats.scouts++;const delta=Object.keys(this.s.seen).length-before;if(delta>=3)this.xp(2);return this.note('发现'+delta+'个地点','ok');}
 rest(mode='field'){
  if(this.s.combat)return this.fail('斗法中请使用防守恢复灵力');
  if(mode==='field'){this.s.spirit=Math.min(this.s.maxSpirit,this.s.spirit+28);if(!this.tick(50,5,6,0))return {ok:false};return this.note('调息 · 灵力+28','ok');}
  if(!this.workshop)return this.fail(this.camp?'请先回到洞府':'先选址筑庐，野外可调息');
  if(mode==='supply'){if(!this.enough({stone:1}))return this.fail('补给需灵石1');if(!this.tick(45,1,1,0))return {ok:false};this.spend({stone:1});this.s.hunger=Math.min(100,this.s.hunger+35);this.s.water=Math.min(100,this.s.water+40);return this.note('补给45分钟 · 饱腹+35 · 饮水+40','ok');}
  if(mode==='night'||mode==='dawn'){
   if(!this.enough({stone:1}))return this.fail('长休含膳食，需灵石1');let target=Math.floor(this.s.minutes/1440)*1440+(mode==='night'?1080:420);if(target<=this.s.minutes)target+=1440;
   // Long rest must age the character as well; do not bypass tick through direct time assignment.
   if(!this.tick(target-this.s.minutes,0,0,0))return {ok:false};this.spend({stone:1});
   this.s.hp=this.s.maxHp;this.s.spirit=this.s.maxSpirit;this.s.hunger=85;this.s.water=85;this.log('休整至'+this.clock,'good');return this.note('休整至'+this.day+'日 '+this.clock,'ok');
  }
  const key=this.s.zone+':'+this.day,times=this.s.campRests[key]||0;if(!this.tick(180,1,1,0))return {ok:false};this.s.hp=Math.min(this.s.maxHp,this.s.hp+48+12*(this.camp.level-1));this.s.spirit=Math.min(this.s.maxSpirit,this.s.spirit+78+12*(this.camp.level-1));
  if(times<2){this.s.campRests[key]=times+1;this.s.hunger=Math.min(100,this.s.hunger+25);this.s.water=Math.min(100,this.s.water+30);}
  return this.note('休息恢复'+(times<2?' · 简餐'+(times+1)+'/2':''),'ok');
 }
 consume(id){if(this.s.combat)return this.fail('斗法请使用战斗指令');if(!own(D.ITEMS,id)||D.ITEMS[id].type!=='food'||!(this.s.inv[id]>0))return this.fail('没有该消耗品');
 if(id==='lifespanPill'){
   if(this.s.life.elixirs>=D.LIFE.elixirLimit)return this.fail('整局延寿丹服用次数已达上限');
   this.s.inv[id]--;this.s.life.elixirs++;this.s.life.left+=D.LIFE.elixirYears*D.LIFE.yearMinutes;
   this.log('服用延寿丹 · 寿元+'+D.LIFE.elixirYears+'年','good');return this.note('寿元+'+D.LIFE.elixirYears+'年 · '+this.s.life.elixirs+'/'+D.LIFE.elixirLimit,'ok');
  }
  if(['focus','elixir'].includes(id)){
   if(this.s.level>=18)return this.fail('已达境界上限，不消耗修为丹');
   if(this.s.pillDaily.day===this.day&&this.s.pillDaily.uses>=2)return this.fail('今日修为丹已服2次');
   if(this.s.pillDaily.day!==this.day)this.s.pillDaily={day:this.day,uses:0};
   this.s.inv[id]--;this.s.pillDaily.uses++;const xp=id==='focus'?18:36,sp=id==='focus'?20:30;
   this.xp(xp);this.s.spirit=Math.min(this.s.maxSpirit,this.s.spirit+sp);return this.note('修为+'+xp+' · 今日修为丹'+this.s.pillDaily.uses+'/2','ok');
  }
  const effects={berry:{hunger:22},water:{water:30},salve:{hp:32},pill:{hunger:42,water:8},fish:{hunger:28,water:6},meal:{hunger:45,water:12},mana:{spirit:40}};
  if(['fireward','detox'].includes(id)){if(this.s.buffs[id]>this.s.minutes)return this.fail('保护效果仍在生效');this.s.inv[id]--;this.s.buffs[id]=this.s.minutes+240;return this.note('护持生效 · 240分钟','ok');}
  const e=effects[id];if(!e)return this.fail('不能使用该物品');const cap=k=>k==='hp'?this.s.maxHp:k==='spirit'?this.s.maxSpirit:100;
  if(Object.keys(e).every(k=>this.s[k]>=cap(k)))return this.fail('状态已满，不消耗物品');this.s.inv[id]--;for(const [k,n] of Object.entries(e))this.s[k]=Math.min(cap(k),this.s[k]+n);if(id==='water')this.s.stats.drinks++;this.log('使用'+D.ITEMS[id].name,'good');return this.note(D.ITEMS[id].effect,'ok');
 }
 // Settlement state is keyed by region. No implicit camps or cross-region warehouse.
 get camp(){return this.s.settlements[this.s.zone]||null;}
 get atCamp(){const c=this.camp;return !!c&&c.pos.x===this.s.pos.x&&c.pos.y===this.s.pos.y;}
 get workshop(){return this.atCamp;}
 get storageReady(){return this.atCamp&&this.roomLevel('warehouse')>0;}
 get localStash(){return this.storageReady?this.camp.stash:{};}
 roomLevel(id,c=this.camp){return c?(id==='residence'?c.level:c.buildings[id]||0):0;}
 stashCapacity(c=this.camp){return [0,80,180,360][this.roomLevel('warehouse',c)]||0;}
 stashWeight(c=this.camp){return Object.entries(c?.stash||{}).reduce((n,[k,q])=>n+(D.ITEMS[k]?.wt||0)*q,0);}
 get ground(){return this.s.caches[this.key()]||{};}
 campName(c=this.camp,z=this.s.zone){return c?D.ZONES[z].short+' · '+D.BUILDINGS.residence.levels[c.level-1].name:'尚未定居';}
 isCampTile(x,y,z=this.s.zone){const c=this.s.settlements[z];return !!c&&c.pos.x===x&&c.pos.y===y;}
 canSettle(x=this.s.pos.x,y=this.s.pos.y,z=this.s.zone){
  if(z>=this.s.unlocked||!pos({x,y}))return '尚不能前往此地';
  if(!this.s.visited[this.key(x,y,z)])return '先走到此地，再确定选址';
  if(!D.CAMP_LANDS.includes(D.ZONES[z].map[y][x]))return '这里不宜定居，寻找营坪、草坡、林地或石岗';
  if(D.SITES[this.key(x,y,z)]||D.EVENTS[this.key(x,y,z)])return '此地留作奇遇，不能覆盖';
  return '';
 }
 settle(relocate=false){
  if(this.s.combat)return this.fail('斗法中不能营建');
  const why=this.canSettle();if(why)return this.fail(why);
  if(this.camp&&!relocate)return this.fail('本境已有洞府，可选择迁居');
  if(relocate&&!this.camp)return this.fail('还没有可以迁移的洞府');
  if(this.atCamp)return this.fail('这里已经是你的洞府');
  const cost=relocate?D.MOVE_CAMP_COST:D.SETTLE_COST;
  // At a new site only carried materials are available. Never spend distant storage.
  if(!this.enough(cost))return this.fail(this.missing(cost));
  const destination=copy(this.s.pos),started=this.s.minutes;
  if(!this.tick(relocate?180:120,5,5,4))return {ok:false};
  this.spend(cost);
  if(relocate){this.camp.pos=destination;this.s.stats.relocations++;}
  else{this.s.settlements[this.s.zone]={pos:destination,level:1,buildings:{},stash:{},foundedAt:started,farmAt:0};this.s.stats.settled++;}
  this.s.stats.built++;this.reveal();
  this.log((relocate?'迁居完成，建筑与仓库完整保留':'筑起草庐，终于有了落脚处')+' · '+(destination.x+1)+','+(destination.y+1),'good');
  return this.note(relocate?'迁居完成 · 物资与设施保留':'草庐落成 · 可修建仓房与炼器室','ok');
 }
 buildReason(id){
  const def=D.BUILDINGS[id];if(!def)return '未知建筑';
  if(!this.camp)return '先找地方筑庐';
  if(!this.atCamp)return '需要回到本境洞府营建';
  if(def.zone!==undefined&&def.zone!==this.s.zone)return '山门在青岚洞府修建';
  const old=this.roomLevel(id),next=def.levels[old];if(!next)return '已达本版上限';
  if(next.home&&this.camp.level<next.home)return '先将洞府升至'+next.home+'阶';
  if(!this.enough(next.cost))return this.missing(next.cost);
  return '';
 }
 build(id){
  if(this.s.combat)return this.fail('斗法中不能营建');const why=this.buildReason(id);if(why)return this.fail(why);
  const def=D.BUILDINGS[id],level=this.roomLevel(id)+1,next=def.levels[level-1];
  // Payment happens only after all checks and a successful work interval.
  if(!this.tick(next.minutes,3,3,3))return {ok:false};
  this.spend(next.cost);
  if(id==='residence')this.camp.level=level;else this.camp.buildings[id]=level;
  if(id==='farm')this.camp.farmAt=this.s.minutes;
  if(id==='gate'){
   this.s.ritual[0]=true;this.s.flags.repaired=true;this.xp(10);
   this.log('自建山门与护山阵落成，青岚妖窟已经开放。','good');
  }
  this.s.stats.built++;this.log(def.name+'升至'+level+'阶','good');
  return this.note(id==='gate'?'山门落成 · 妖窟封印解除':def.name+' · '+level+'阶落成','ok');
 }
 recipeRequirement(r){
  if(r.room){if(!this.atCamp)return '需在洞府的'+D.BUILDINGS[r.room].name+'炼制';
   if(this.roomLevel(r.room)<r.tier)return '需'+D.BUILDINGS[r.room].name+r.tier+'阶（当前'+this.roomLevel(r.room)+'阶）';}
  else if(r.home&&!this.atCamp)return '请回到洞府炼制';
  return '';
 }
 farmRemaining(){if(!this.camp||!this.roomLevel('farm'))return null;return Math.max(0,1440-(this.s.minutes-this.camp.farmAt));}
 get farmBatches(){if(!this.camp||!this.roomLevel('farm'))return 0;return Math.min(3,Math.floor(Math.max(0,this.s.minutes-this.camp.farmAt)/1440));}
 get farmReady(){return this.farmBatches>0;}
 harvestFarm(){
  if(this.s.combat)return this.fail('斗法中不能收获');if(!this.atCamp)return this.fail('请回洞府收获');
  if(!this.roomLevel('farm'))return this.fail('先修建灵田');if(this.farmRemaining()>0)return this.fail('灵田尚需'+Math.ceil(this.farmRemaining()/60)+'游戏小时');
const batches=this.farmBatches,loot=Object.fromEntries(Object.entries(D.FARM_LOOT[this.roomLevel('farm')]).map(([k,v])=>[k,v*batches]));
   // Backlog caps at 3 batches, discarding older unsupervised cycles but preserving elapsed partial day.
   this.camp.farmAt=this.s.minutes-((this.s.minutes-this.camp.farmAt)%1440);this.s.stats.farms+=batches;
   const parts=[];for(const [k,n] of Object.entries(loot)){
    let remaining=n;
    if(this.storageReady){const w=D.ITEMS[k].wt||1;const stored=Math.min(remaining,Math.max(0,Math.floor((this.stashCapacity()-this.stashWeight())/w)));
     if(stored){this.camp.stash[k]=(this.camp.stash[k]||0)+stored;remaining-=stored;parts.push(D.ITEMS[k].name+'入仓'+stored);this.s.codex.items[k]=(this.s.codex.items[k]||0)+stored;}
    }
    if(remaining){const msg=this.loot({[k]:remaining},'灵田收获');if(msg)parts.push(msg);}
   }
   this.log('灵田结算 '+batches+'轮','good');return this.note('灵田'+batches+'轮 · '+parts.join(' · '),'ok');
 }
 pickup(id=null,qty=999){
  if(this.s.combat)return this.fail('斗法中不能拾取');let count=0;
  const ids=id?[id]:Object.keys(this.ground);
  for(const k of ids){if(!own(D.ITEMS,k))continue;const q=this.ground[k]||0,wt=D.ITEMS[k].wt;
   const amount=Math.min(q,integer(qty,1,999999),wt?Math.max(0,Math.floor((this.capacity-this.weight)/wt)):q);
   if(amount){this.ground[k]-=amount;this.s.inv[k]=(this.s.inv[k]||0)+amount;count+=amount;}
  }
  if(!count)return this.fail(Object.values(this.ground).some(v=>v>0)?'负重不足，先腾出行囊':'此处没有待拾物资');
  return this.note('拾取 '+count+'件 · 已入行囊','ok');
 }
 store(id=null,qty=999999){
  if(this.s.combat)return this.fail('斗法中不能存取');if(!this.storageReady)return this.fail(this.atCamp?'先修建仓房':'回本境洞府的仓房存取');
  const ids=id?[id]:Object.keys(this.s.inv).filter(k=>D.ITEMS[k]?.type==='material');let moved=0,left=0;
  for(const k of ids){if(!own(D.ITEMS,k))continue;const q=this.s.inv[k]||0,wt=D.ITEMS[k].wt;
   const fit=Math.min(q,integer(qty,1,999999),wt?Math.max(0,Math.floor((this.stashCapacity()-this.stashWeight())/wt)):q);
   if(fit){this.camp.stash[k]=(this.camp.stash[k]||0)+fit;this.s.inv[k]-=fit;moved+=fit;}left+=q-fit;
  }
  if(!moved)return this.fail(left?'仓房已满，升级或取走物资':'没有可存的物资');
  this.s.stats.stores++;return this.note('存入 '+moved+'件'+(left?' · 余下仍在行囊':''),'ok');
 }
 provision(){
  if(this.s.combat||!this.storageReady)return this.fail('请回到已建仓房的洞府整理行装');
  const targets={berry:4,water:4,salve:2,mana:2},parts=[];
  for(const [id,target] of Object.entries(targets)){
   const reserve=this.camp.stash[id]||0,need=Math.max(0,target-(this.s.inv[id]||0)),wt=D.ITEMS[id].wt||1;
   const qty=Math.min(need,reserve,Math.max(0,Math.floor((this.capacity-this.weight)/wt)));
   if(qty){this.camp.stash[id]-=qty;this.s.inv[id]=(this.s.inv[id]||0)+qty;parts.push(D.ITEMS[id].name+'×'+qty);}
  }
  if(!parts.length)return this.fail('仓内无可补给物资，或随身已经带够');
  this.s.stats.withdraws++;return this.note('出行整理 · '+parts.join(' · '),'ok');
 }
 withdraw(id,qty=1){
  if(this.s.combat)return this.fail('斗法中不能存取');if(!this.storageReady)return this.fail('请回本境洞府的仓房');
  if(!own(D.ITEMS,id)||!(this.camp.stash[id]>0))return this.fail('本仓没有该物品');
  qty=Math.min(integer(qty,1,999999),this.camp.stash[id]);const wt=D.ITEMS[id].wt;
  if(wt)qty=Math.min(qty,Math.max(0,Math.floor((this.capacity-this.weight)/wt)));if(!qty)return this.fail('行囊负重不足');
  this.camp.stash[id]-=qty;this.s.inv[id]=(this.s.inv[id]||0)+qty;this.s.stats.withdraws++;
  return this.note('取出'+D.ITEMS[id].name+'×'+qty,'ok');
 }
 discard(id){if(this.s.combat)return this.fail('斗法中不能丢弃');if(D.ITEMS[id]?.type!=='material'||!(this.s.inv[id]>0))return this.fail('不可丢弃');this.s.inv[id]--;return this.note('丢弃'+D.ITEMS[id].name+'×1');}
 recipe(id){return D.RECIPES.find(r=>r.id===id);}
 gear(id){return this.s.gears.find(g=>g.id===id);}
 gearBonus(g){if(!g)return 0;const r=this.recipe(g.recipe);return Math.round(r.bonus*D.QUALITIES[g.quality].mult*(1+g.refine*.08));}
 gearScore(g){return this.gearBonus(g)+(g?.affixes||[]).reduce((n,a)=>n+a.value*.15,0);}
 get weapon(){return this.gearBonus(this.gear(this.s.equipped.weapon));}get armor(){return this.gearBonus(this.gear(this.s.equipped.armor));}
 affix(id){return ['weapon','armor'].reduce((n,slot)=>n+(this.gear(this.s.equipped[slot])?.affixes.find(a=>a.id===id)?.value||0),0);}
 rollQuality(z=this.s.zone){const v=this.random()*100,w=D.QUALITY_WEIGHTS[z];let t=0;for(let i=0;i<w.length;i++){t+=w[i];if(v<t)return i;}return 0;}
 createGear(recipe,minQuality=0,source='炼制'){
  const r=this.recipe(recipe),quality=Math.max(minQuality,this.rollQuality());const g={id:'g'+this.s.nextGear++,recipe,quality,refine:0,affixes:[],source};
  let pool=Object.keys(D.AFFIXES).filter(k=>D.AFFIXES[k].slot===r.gear&&(k!=='fire'||(r.zone||0)>=2));
  for(let i=0;i<D.QUALITIES[quality].count&&pool.length;i++){const k=pool.splice(this.dice(0,pool.length-1),1)[0];const value=['crit','leech','spell'].includes(k)?this.dice(2+quality,5+quality*2):this.dice(1,Math.min(6,quality+2));g.affixes.push({id:k,value});}
  return g;
 }
 acceptGear(g,record=true){if(record)this.s.codex.gears[g.recipe]=(this.s.codex.gears[g.recipe]||0)+1;const r=this.recipe(g.recipe);if(this.s.gears.length>=36){if(this.s.pending.length>=64){this.loot({dust:2+g.quality*2},'器囊与待领取均满，遗器转为灵尘');}else {g.where=this.key();this.s.pending.push(g);}return false;}
  this.s.gears.push(g);const old=this.gear(this.s.equipped[r.gear]);if(!old||this.gearScore(g)>this.gearScore(old))this.s.equipped[r.gear]=g.id;return true;
 }
 dropGear(min=0,source='战利品'){
  const pool=D.RECIPES.filter(r=>r.gear&&(this.s.zone===0?['woodSword','ironSword','robe','hideRobe'].includes(r.id):r.zone===this.s.zone));
  const r=pool[this.dice(0,pool.length-1)],g=this.createGear(r.id,min,source),accepted=this.acceptGear(g);this.log(`${source}：${D.QUALITIES[g.quality].name}·${r.name}${accepted?'':'（待领取）'}`,'good');this.note(`${D.QUALITIES[g.quality].name}·${r.name}${accepted?'':' · 待领取'}`,'ok');return g;
 }
 craft(id){if(this.s.combat)return this.fail('斗法中不能炼制');const r=this.recipe(id);if(!r)return this.fail('未知配方');if((r.zone||0)>=this.s.unlocked)return this.fail('尚未解锁该配方');const roomWhy=this.recipeRequirement(r);if(roomWhy)return this.fail(roomWhy);if(r.unique&&this.has(r.item))return this.fail('已有此工具，可从仓库取出');if(r.flag&&this.s.flags[r.flag])return this.fail('已炼成此符');if(r.gear&&this.s.gears.length>=36)return this.fail('器囊已满，先分解闲置装备');if(!this.enough(r.cost))return this.fail(this.missing(r.cost));
  const freed=Object.entries(r.cost).reduce((n,[k,v])=>n+Math.min(this.s.inv[k]||0,v)*D.ITEMS[k].wt,0);if(r.item&&this.weight-freed+D.ITEMS[r.item].wt>this.capacity)return this.fail('背包空间不足');
  if(!this.tick(30,2,3,2))return {ok:false};this.spend(r.cost);
  let name=r.name;if(r.gear){const g=this.createGear(id,0,'炼制');this.acceptGear(g);name=D.QUALITIES[g.quality].name+'·'+r.name;}if(r.flag)this.s.flags[r.flag]=true;if(r.item){this.s.inv[r.item]=(this.s.inv[r.item]||0)+1;this.s.codex.items[r.item]=(this.s.codex.items[r.item]||0)+1;}
  this.s.stats.crafted++;if(r.item&&['pill','mana','focus','elixir','fireward','detox'].includes(r.item))this.s.stats.pillsMade++;this.log('炼成'+name,'good');return this.note('炼成 '+name,'ok');
 }
 equip(id){if(this.s.combat)return this.fail('斗法中不能换装');const g=this.gear(id);if(!g)return this.fail('装备不存在');this.s.equipped[this.recipe(g.recipe).gear]=id;return this.note('已装备'+this.recipe(g.recipe).name,'ok');}
 salvage(id){if(this.s.combat)return this.fail('斗法中不能分解');const g=this.gear(id);if(!g)return this.fail('装备不存在');if(Object.values(this.s.equipped).includes(id))return this.fail('请先换下这件装备');const dust=2+g.quality*2+g.refine*2;this.s.gears=this.s.gears.filter(x=>x.id!==id);this.loot({dust},'分解');return this.note('灵尘+'+dust,'ok');}
 refine(id){if(this.s.combat||!this.workshop)return this.fail('精炼需回到炼器室');const g=this.gear(id);if(!g)return this.fail('装备不存在');if(g.refine>=3)return this.fail('已精炼至上限');if(this.roomLevel('forge')<g.refine+1)return this.fail('精炼+'+(g.refine+1)+'需炼器室'+(g.refine+1)+'阶');const cost={dust:(g.refine+1)*4};if(!this.enough(cost))return this.fail(this.missing(cost));this.spend(cost);g.refine++;return this.note('精炼+'+g.refine+' · 属性已更新','ok');}
 claimGear(id){if(this.s.combat)return this.fail('斗法中不能拾取');if(this.s.gears.length>=36)return this.fail('器囊仍然已满');const i=this.s.pending.findIndex(x=>x.id===id);if(i<0)return this.fail('没有这件待领取装备');if(this.s.pending[i].where!==this.key())return this.fail('请回到发现地点拾取');const g=this.s.pending.splice(i,1)[0];this.acceptGear(g,false);return this.note('已领取遗器','ok');}
 meditate(){
  if(!this.workshop||this.s.combat)return this.fail('吐纳需回洞府');if(this.s.level>=18)return this.fail('已达本版境界上限');
  if(this.s.meditation.day===this.day&&this.s.meditation.uses>=3)return this.fail('今日吐纳已满3次');if(!this.enough({stone:1}))return this.fail('吐纳需灵石1');
  const startDay=this.day,uses=this.s.meditation.day===startDay?this.s.meditation.uses:0;
  if(!this.tick(60,3,4,0))return {ok:false};this.spend({stone:1});this.s.meditation={day:startDay,uses:uses+1};
  const q=this.roomLevel('quiet'),xp=[8,12,16,22][q],sp=[12,24,28,36][q];
  this.s.spirit=Math.min(this.s.maxSpirit,this.s.spirit+sp);this.xp(xp);return this.note('修为+'+xp+' · 灵力+'+sp,'ok');
 }
 repair(){if(this.s.combat)return this.fail('斗法中不能进行仪式');if(this.s.ritual[this.s.zone])return this.fail('本境封印已完成');if(this.s.zone===0)return this.build('gate');if(this.land()!=='shrine')return this.fail('需前往'+this.zone.altar);if(!this.enough(this.zone.need))return this.fail(this.missing(this.zone.need));if(!this.tick(70,4,5,6))return {ok:false};this.spend(this.zone.need);this.s.ritual[this.s.zone]=true;this.s.flags.repaired=this.s.ritual[0];this.xp(10+this.s.zone*4);return this.note(this.zone.verb+'完成 · 前往'+this.zone.bossMark,'ok');}
 barter(){if(this.s.combat||this.land()!=='bazaar')return this.fail('请前往山间坊市');if(!this.enough({ore:1}))return this.fail('交易需玄铁矿1');this.spend({ore:1});this.loot({water:2,berry:2},'坊市交易');return this.note('获得清水2与灵果2','ok');}
 siteReady(){const e=this.site;if(!e)return '这里没有奇遇';if(this.s.sites[this.key()]===this.day)return '今日已探索，次日再访';if(e.night&&!this.night)return '夜间18:00—06:00开放';return '';}
 event(choice){if(this.s.combat)return this.fail('先结束斗法');const why=this.siteReady();if(why)return this.fail(why);const e=this.site,c=e.choices[choice];if(!c)return this.fail('请选择有效行动');if(c.tool&&!this.s.inv[c.tool])return this.fail('需随身'+D.ITEMS[c.tool].name);if(c.cost&&!this.enough(c.cost))return this.fail(this.missing(c.cost));const key=this.key(),start=this.day;if(!this.tick(30,2,2,3))return {ok:false};if(c.cost)this.spend(c.cost);this.s.sites[key]=start;this.s.stats.events++;this.log(e.name+' · '+c.label);
  if(c.enemy){this.startBattle(c.enemy);this.s.combat.siteReward={key,choice};return {ok:true,combat:true};}
  this.eventReward(key,choice);return this.note('奇遇完成 · '+e.name,'ok');
 }
 eventReward(key,choice){const c=D.SITES[key]?.choices[choice];if(!c)return;if(c.loot)this.loot(c.loot,'奇遇');if(c.restore){this.s.hp=this.s.maxHp;this.s.spirit=this.s.maxSpirit;this.log('灵泉恢复全部气血与灵力','good');}if(c.damage&&this.s.buffs.fireward<=this.s.minutes){this.s.hp=Math.max(1,this.s.hp-c.damage);this.log('热浪灼伤 · 气血-'+c.damage,'bad');}if(c.gear)this.dropGear(c.minQuality||0,'遗迹寻宝');this.xp(3+this.s.zone);}
 startBattle(type,repeat=false){if(this.s.combat)return this.fail('已经在斗法');const e=D.ENEMIES[type];if(!e)return this.fail('未知对手');const training=!!e.training,maxHp=Math.round(e.hp*(repeat?1.25:1));this.s.combat={type,hp:maxHp,maxHp,atk:Math.round(e.atk*(repeat?1.25:1)),armor:e.armor,turn:1,intent:training?'heavy':'attack',riposte:0,training,repeat,virtualHeals:3};
  if(training)this.s.combat.before={hp:this.s.hp,spirit:this.s.spirit,hunger:this.s.hunger,water:this.s.water};else this.s.codex.enemies[type]||=1;
  this.log(e.name+'拦住去路。');return this.note(training?'安全试剑 · 重击先防守':'遭遇'+e.name,'warn','battle');
 }
 train(){if(!this.workshop||this.s.combat)return this.fail('请归营后试剑');return this.startBattle('dummy');}
 hunt(){if(this.s.combat||this.land()!=='boss')return this.fail('需前往首领所在地点');if(!this.s.ritual[this.s.zone])return this.fail('先完成本境封印');if(this.s.cleared[this.s.zone]&&this.s.bossDaily[this.s.zone]===this.day)return this.fail('今日已挑战，次日再战');return this.startBattle(this.zone.boss,this.s.cleared[this.s.zone]);}
 finishTraining(won){const b=this.s.combat;if(!b?.training)return;Object.assign(this.s,b.before);this.s.combat=null;if(won)this.s.stats.training++;this.log(won?'试剑完成，未消耗真实物资。':'已结束练习。','good');this.note(won?'试剑完成 · 无损耗':'已结束练习','ok');}
 fight(mode){const b=this.s.combat;if(!b)return this.fail('当前没有战斗');if(!['attack','spell','guard','heal','escape','mana'].includes(mode))return this.fail('无效战斗指令');let guard=false;
  if(mode==='escape'){
   if(b.training){this.finishTraining(false);return {ok:true};}if(b.type.startsWith('boss'))return this.fail('首领战不能撤离');if(this.random()<.8){this.s.combat=null;this.s.pos=copy(this.s.last);this.reveal();this.tick(15,1,1,4);return this.note('成功撤离');}this.log('撤离失败。','bad');
  }else if(mode==='attack'||mode==='spell'){
   if(mode==='spell'&&this.s.spirit<9)return this.fail('剑诀需9灵力');if(mode==='spell')this.s.spirit-=9;
   const base=this.s.attack+this.weapon+b.riposte,crit=this.random()*100<this.affix('crit'),boost=mode==='spell'?1.7*(1+this.affix('spell')/100):1;
   const dmg=Math.max(1,Math.round(base*boost*(.88+this.random()*.24)*(crit?1.5:1))-Math.max(0,b.armor-this.affix('pierce')))+this.affix('fire');
   const dealt=Math.min(b.hp,dmg);b.hp=Math.max(0,b.hp-dmg);b.riposte=0;const heal=Math.floor(dealt*this.affix('leech')/100);if(heal)this.s.hp=Math.min(this.s.maxHp,this.s.hp+heal);
   this.log(`${mode==='spell'?'剑诀':'剑击'}${crit?'会心':''} · 伤害${dmg}${heal?' · 吸血+'+heal:''}`,'good');
   if(!b.hp){if(b.training){this.finishTraining(true);return {ok:true};}if(this.tick(15,1,1,2))this.win();return {ok:true};}
  }else if(mode==='guard'){guard=true;b.riposte=4;this.s.spirit=Math.min(this.s.maxSpirit,this.s.spirit+10+this.affix('flow'));this.s.hp=Math.min(this.s.maxHp,this.s.hp+this.affix('renew'));this.log('御气防守，蓄势+4。');
  }else if(mode==='heal'){
   if(this.s.hp>=this.s.maxHp)return this.fail('气血已满');if(b.training){if(!b.virtualHeals)return this.fail('练习药已用完');b.virtualHeals--;}else{if(!(this.s.inv.salve>0))return this.fail('回春散不足');this.s.inv.salve--;}
   this.s.hp=Math.min(this.s.maxHp,this.s.hp+32);this.log('回春散 · 气血+32','good');
  }else if(mode==='mana'){
   if(this.s.spirit>=this.s.maxSpirit)return this.fail('灵力已满');if(b.training){this.s.spirit=Math.min(this.s.maxSpirit,this.s.spirit+40);}else{if(!(this.s.inv.mana>0))return this.fail('回灵丹不足');this.s.inv.mana--;this.s.spirit=Math.min(this.s.maxSpirit,this.s.spirit+40);}
  }
  if(!b.training&&!this.tick(15,1,1,2))return {ok:false};
  if(b.intent==='recover'){b.hp=Math.min(b.maxHp,b.hp+7);this.log(D.ENEMIES[b.type].name+'调息恢复7。');}
  else{let damage=Math.max(1,Math.round(b.atk*(b.intent==='heavy'?1.65:1)*(.88+this.random()*.24))-this.armor-this.affix('ward'));if(guard)damage=Math.max(1,Math.floor(damage*.25));this.s.hp=Math.max(b.training?1:0,this.s.hp-damage);this.log(`受到${damage}伤害${guard?'（已防守）':''}`,'bad');if(!this.s.hp){this.collapse();return {ok:false};}}
  b.turn++;b.intent=b.turn%3===0?'heavy':b.turn%5===0?'recover':'attack';return {ok:true};
 }
 win(){const b=this.s.combat;if(!b)return;const e=D.ENEMIES[b.type],boss=b.type.startsWith('boss');this.s.combat=null;this.s.stats.kills++;this.s.codex.enemies[b.type]=(this.s.codex.enemies[b.type]||1)+1;this.xp(e.xp);this.loot(e.loot,'战利品');
  this.log('战胜'+e.name+' · 修为+'+e.xp,'good');if(boss||this.random()<.22)this.dropGear(boss?1:0,'击败'+e.name);if(b.siteReward)this.eventReward(b.siteReward.key,b.siteReward.choice);
  if(boss){const i=Number(b.type.slice(4)),first=!this.s.cleared[i];this.s.cleared[i]=true;this.s.bossDaily[i]=this.day;this.s.stats.bossWins++;this.s.flags.boss=this.s.cleared[0];this.s.unlocked=Math.max(this.s.unlocked,Math.min(5,i+2));
   if(first&&i<4)this.note('已解锁 '+D.ZONES[i+1].name,'ok','unlock');if(first&&i===4){this.s.flags.complete=true;this.note('五境已平定，仍可继续历练。','ok','victory');}
  }else this.note('战胜'+e.name+' · 修为+'+e.xp,'ok');
 }
 get bookCount(){return ['items','enemies','gears'].reduce((n,k)=>n+Object.keys(this.s.codex[k]).filter(id=>id!=='dummy').length,0)+Object.keys(D.BUILDINGS).filter(id=>this.s.settlements.some(c=>this.roomLevel(id,c)>0)).length;}
 claimBook(id){if(this.s.combat)return this.fail('请先结束斗法');const r=D.BOOK_REWARDS.find(r=>r.id===id);if(!r)return this.fail('未知奖励');if(this.s.codex.claims[id])return this.fail('此奖励已经领取');if(this.bookCount<r.need)return this.fail('图鉴发现数量不足');this.s.codex.claims[id]=true;const msg=this.loot(r.loot,'图鉴奖励');return this.note('已领取 · '+msg,'ok');}
 guide(action){const g=this.s.guide;if(action==='start'||action==='replay'){g.status='active';g.step=0;g.base=copy(this.s.stats);}else if(action==='resume'){if(g.status==='new')g.base=copy(this.s.stats);g.status=g.step>=D.GUIDE.length?'done':'active';}else if(action==='pause')g.status='paused';else if(action==='skip')g.status='skipped';this.updateGuide();return {ok:true};}
 updateGuide(){const g=this.s.guide;if(g.status!=='active')return;const b=g.base,st=this.s.stats;
  const tests=[
   ()=>st.gathers>(b.gathers||0),
   ()=>!!(this.s.inv.axe||this.s.settlements.some(c=>c?.stash.axe)),
   ()=>!!this.camp,
   ()=>this.roomLevel('warehouse')>=1,
   ()=>st.stores>(b.stores||0)&&st.withdraws>(b.withdraws||0),
   ()=>this.roomLevel('forge')>=1,
   ()=>!!this.s.equipped.weapon,
   ()=>this.roomLevel('alchemy')>=1&&st.pillsMade>(b.pillsMade||0),
   ()=>st.books>(b.books||0),
   ()=>st.training>(b.training||0),
   ()=>st.travels>(b.travels||0)
  ];
  while(g.step<tests.length&&tests[g.step]())g.step++;if(g.step>=tests.length){g.status='done';if(!g.rewarded){g.rewarded=true;this.loot({salve:2,pill:1},'入门礼');this.note('入门完成 · 回春散2、辟谷丸1','ok','guide-complete');}}
 }
 act(name,args={}){this.effects=[];if(this.s.ended)return {ok:false,permadeath:true,msg:'寿元已尽，本轮已终结'};let result;
  switch(name){
   case 'settle':result=this.settle(!!args.relocate);break;case 'build':result=this.build(args.id);break;
   case 'farm':result=this.harvestFarm();break;case 'provision':result=this.provision();break;case 'pickup':result=this.pickup(args.id,Number(args.qty)||999);break;
   case 'gather':result=this.gather(Number(args.index));break;case 'move':result=this.move(Number(args.x),Number(args.y));break;
   case 'travel':result=this.travel(Number(args.zone),!!args.home);break;case 'scout':result=this.scout();break;
   case 'rest':result=this.rest(args.mode);break;case 'consume':result=this.consume(args.id);break;
   case 'craft':result=this.craft(args.id);break;case 'store':result=this.store(args.id,Number(args.qty)||999999);break;case 'withdraw':result=this.withdraw(args.id,Number(args.qty)||1);break;
   case 'discard':result=this.discard(args.id);break;case 'equip':result=this.equip(args.id);break;case 'salvage':result=this.salvage(args.id);break;
   case 'refine':result=this.refine(args.id);break;case 'claim-gear':result=this.claimGear(args.id);break;
   case 'meditate':result=this.meditate();break;case 'repair':result=this.repair();break;case 'barter':result=this.barter();break;
   case 'event':result=this.event(Number(args.choice));break;case 'train':result=this.train();break;case 'hunt':result=this.hunt();break;case 'fight':result=this.fight(args.mode);break;
   case 'claim-book':result=this.claimBook(args.id);break;case 'guide':result=this.guide(args.mode);break;
   case 'book-open':this.s.stats.books++;result={ok:true};break;case 'travel-open':this.s.stats.travels++;result={ok:true};break;
   default:result=this.fail('无效操作');
  }
  this.updateGuide();return result||{ok:true};
 }
}
Game.normalize=normalize;Game.fresh=fresh;Game.copy=copy;root.QGame=Game;
if(typeof module!=='undefined'&&module.exports)module.exports=Game;
})(globalThis);
