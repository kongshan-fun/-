/* V14: race × numbered save slot. Old keys are read-only, migrations explicit. */
(function(root){
'use strict';
const D=root.QData||(typeof require==='function'?require('./data.js'):null);
const Game=root.QGame||(typeof require==='function'?require('./engine.js'):null);
const B=D.BIRTH;
class RaceSlots{
 constructor(storage){this.storage=storage;}
 check(id){if(!Object.hasOwn(D.RACES,id))throw Error('未知种族');return id;}
 slot(n=1){n=Number(n);if(!Number.isInteger(n)||n<1||n>100)throw Error('存档位必须为1至100');return n;}
 key(id,n=1){return D.SLOT_PREFIX+this.check(id)+'-slot-'+String(this.slot(n)).padStart(3,'0');}
 backupKey(id,n=1){return this.key(id,n)+'-backup';}
 deathKey(id,n=1){return this.key(id,n)+'-death';}
 readKey(k){return this.storage.getItem(k);}
 dead(id,n=1){return !!this.readKey(this.deathKey(id,n));}
 read(id,n=1){this.check(id);this.slot(n);if(this.dead(id,n))throw Error('此档寿元已尽，请明确开启新轮回');
  let present=false;for(const [key,source] of [[this.key(id,n),'主存档'],[this.backupKey(id,n),'自动备份']]){
   const raw=this.readKey(key);if(!raw)continue;present=true;
   try{const obj=JSON.parse(raw);if(obj.version!==14||obj.race!==id||obj.character!==id)throw Error('种族身份不符');return {game:new Game(obj,261014,id),source};}catch{}
  }
  if(present)throw Error('此档数据损坏，已锁定防止覆盖');return null;
 }
 status(id,n=1){try{this.check(id);this.slot(n);if(this.dead(id,n))return {status:'dead',role:id,slot:n};const found=this.read(id,n);if(!found)return {status:'empty',role:id,slot:n};const g=found.game,s=g.s;
  return {status:'ready',role:id,slot:n,name:s.birth.name,grade:B.gradeName(s.birth),realm:g.realm,day:g.day,years:g.lifeYears.toFixed(1),ascended:s.ascended,source:found.source};
 }catch(e){return {status:'invalid',role:id,slot:n,error:e.message};}}
 list(){return Object.keys(D.RACES).map(id=>this.status(id));}
 listSlots(id,start=1,count=100){this.check(id);this.slot(start);if(!Number.isInteger(count)||count<1||count>100)throw Error('读取档数无效');return Array.from({length:Math.min(count,101-start)},(_,i)=>this.status(id,start+i));}
 save(id,game,n=1){this.check(id);this.slot(n);if(this.dead(id,n))throw Error('此档已寿尽，不能保存');
  if(game.s.ended||game.s.race!==id||game.s.character!==id||game.s.version!==14)throw Error('拒绝写入错误种族或终结存档');
  const valid=new Game(game.state(),261014,id),raw=JSON.stringify(valid.state()),key=this.key(id,n),prior=this.readKey(key);
  if(prior&&prior!==raw){try{const old=JSON.parse(prior);new Game(old,261014,id);this.storage.setItem(this.backupKey(id,n),prior);}catch(e){/* If quota blocks a backup, primary remains intact until its own atomic write. */}}
  this.storage.setItem(key,raw);return true;
 }
 newGame(id,seed=261014,n=1,birth=null){this.check(id);this.slot(n);
  if(!this.dead(id,n)&&(this.readKey(this.key(id,n))||this.readKey(this.backupKey(id,n))))throw Error('该档位已有进度，禁止覆盖');
  const g=new Game(null,seed,id,birth);this.storage.setItem(this.key(id,n),JSON.stringify(g.state()));
  // Tombstone is removed only AFTER the new state was durably written.
  this.storage.removeItem(this.backupKey(id,n));this.storage.removeItem(this.deathKey(id,n));return g;
 }
 expire(id,n=1){this.check(id);this.slot(n);this.storage.setItem(this.deathKey(id,n),JSON.stringify({race:id,slot:n,reason:'寿元归零',at:new Date().toISOString()}));this.storage.removeItem(this.key(id,n));this.storage.removeItem(this.backupKey(id,n));return true;}
 sourceKeys(){const out=[];for(const role of ['sword','herb'])for(let n=1;n<=100;n++)out.push({key:'qinglan-wendao-v11-'+role+(n===1?'':'-slot-'+String(n).padStart(3,'0')),label:(role==='sword'?'旧剑修':'旧丹修')+' · '+String(n).padStart(3,'0')});
  if(!this.readKey(D.MIGRATION_KEY)&&!this.readKey(D.DEATH_KEY))for(const key of [D.SAVE,...D.LEGACY])out.push({key,label:'旧单角色进度'});return out;
 }
 migrationKey(source){return 'qinglan-wendao-v14-imported:'+encodeURIComponent(source);}
 legacyCandidates(){const out=[];for(const entry of this.sourceKeys()){
  if(this.readKey(entry.key+'-death')||this.readKey(this.migrationKey(entry.key)))continue;
  for(const key of [entry.key,entry.key+'-backup']){const raw=this.readKey(key);if(!raw)continue;
   try{const state=JSON.parse(raw);if(state.version>=14)break;const g=new Game(state,261014,'human');out.push({...entry,state,realm:g.realm,day:g.day});break;}catch{}
  }
 }return out;}
 legacyCandidate(){return this.legacyCandidates()[0]||null;}
 migrate(id,n=1,sourceKey=null){this.check(id);this.slot(n);if(id!=='human')throw Error('旧角色仅继承为人族，妖族需新建');
  if(this.dead(id,n))throw Error('寿尽档位须先选择新轮回，不可用旧档复活');
  if(this.readKey(this.key(id,n))||this.readKey(this.backupKey(id,n)))throw Error('目标档位非空，禁止覆盖');
  const candidates=this.legacyCandidates(),source=sourceKey?candidates.find(x=>x.key===sourceKey):candidates[0];if(!source)throw Error('没有可继承的旧版存档');
  const g=new Game(source.state,261014,'human'),marker=this.migrationKey(source.key);
  // Reserve source before writing the destination: failed source claims cannot duplicate a migration.
  this.storage.setItem(marker,JSON.stringify({race:id,slot:n}));
  try{this.save(id,g,n);}catch(e){try{this.storage.removeItem(marker);}catch{}throw e;}
  return g;
 }
}
root.QCharacterSlots=RaceSlots;if(typeof module!=='undefined'&&module.exports)module.exports=RaceSlots;
})(globalThis);
