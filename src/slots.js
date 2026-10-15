/* Character-isolated localStorage adapter: one save branch per starting character. */
(function(root){
'use strict';
const D=root.QData||(typeof require==='function'?require('./data.js'):null);
const Game=root.QGame||(typeof require==='function'?require('./engine.js'):null);
const valid=id=>Object.prototype.hasOwnProperty.call(D.CHARACTERS,id);
class CharacterSlots{
 constructor(storage){this.storage=storage;}
 slot(n=1){n=Number(n);if(!Number.isInteger(n)||n<1||n>100)throw Error('存档位必须为1至100');return n;}
 suffix(n=1){return this.slot(n)===1?'':'-slot-'+String(n).padStart(3,'0');}
 check(id){if(!valid(id))throw Error('未知角色分支');return id;}
 key(id,n=1){return D.SLOT_PREFIX+this.check(id)+this.suffix(n);}
 backupKey(id,n=1){return this.key(id,n)+'-backup';}
 deathKey(id,n=1){return this.key(id,n)+'-death';}
 readKey(k){return this.storage.getItem(k);}
 dead(id,n=1){return !!this.readKey(this.deathKey(id,n));}
 read(id,n=1){this.check(id);this.slot(n);if(this.dead(id,n))throw Error('此角色寿元已尽，请先重新轮回');
  const raw=this.readKey(this.key(id,n)),backup=this.readKey(this.backupKey(id,n));
  for(const [content,source] of [[raw,'主存档'],[backup,'自动备份']])if(content){try{
   const parsed=JSON.parse(content);
   if(![11,12,13].includes(parsed.version)||parsed.character!==id)throw Error('存档角色不匹配');
   const game=new Game(parsed,261014,id);return {game,source};
  }catch(e){if(source==='自动备份')throw Error(id+'存档损坏，备份也无法读取');}}
  if(raw||backup)throw Error(id+'存档无法解析，不会自动覆盖');
  return null;
 }
 status(id,n=1){try{this.slot(n);if(this.dead(id,n))return {status:'dead',role:id,slot:n};const result=this.read(id,n);if(!result)return {status:'empty',role:id,slot:n};const s=result.game.s;return {status:'ready',role:id,slot:n,source:result.source,zone:s.zone,level:s.level,realm:result.game.realm,ascended:s.ascended,day:result.game.day,years:+result.game.lifeYears.toFixed(1)};}catch(e){return {status:'invalid',role:id,slot:n,message:String(e.message)};}}
 list(){return Object.keys(D.CHARACTERS).map(id=>this.status(id));}
 listSlots(id,start=1,count=100){this.check(id);const end=Math.min(100,this.slot(start)+Math.max(1,Math.floor(count))-1);const a=[];for(let n=start;n<=end;n++)a.push(this.status(id,n));return a;}
 save(id,game,n=1){this.check(id);this.slot(n);if(this.dead(id,n))throw Error('此角色已寿尽，不能保存');
  if(game.s.ended||game.s.character!==id)throw Error('拒绝写入错误角色或终结存档');
  const raw=JSON.stringify(game.state()),prior=this.readKey(this.key(id,n));
  if(prior&&prior!==raw){try{const parsed=JSON.parse(prior);if([11,12,13].includes(parsed.version)&&parsed.character===id)new Game(parsed,261014,id),this.storage.setItem(this.backupKey(id,n),prior);}catch{}}
  this.storage.setItem(this.key(id,n),raw);return true;
 }
 newGame(id,seed=261014,n=1){this.check(id);this.slot(n);if(this.readKey(this.key(id,n))&&!this.dead(id,n))throw Error('该档位已有进度，禁止覆盖');const game=new Game(null,seed,id);
  // Reincarnation is explicit. Clearing the tombstone first prevents hidden resurrection.
  // Persist the new character BEFORE clearing old backups/tombstones.
  // A failed write must never silently erase the old data.
  this.storage.setItem(this.key(id,n),JSON.stringify(game.state()));
  this.storage.removeItem(this.backupKey(id,n));this.storage.removeItem(this.deathKey(id,n));return game;
 }
 expire(id,n=1){this.check(id);this.slot(n);
  // Write death marker BEFORE deleting any other key. Even partial removal cannot revive it.
  this.storage.setItem(this.deathKey(id,n),JSON.stringify({role:id,reason:'寿元归零',at:new Date().toISOString()}));
  this.storage.removeItem(this.key(id,n));this.storage.removeItem(this.backupKey(id,n));return true;
 }
 legacyCandidate(){if(this.readKey(D.MIGRATION_KEY)||this.readKey(D.DEATH_KEY))return null;
  for(const key of [D.SAVE,D.SAVE+'-backup',...D.LEGACY]){
   const raw=this.readKey(key);if(!raw)continue;
   try{const data=JSON.parse(raw);if(data.version>=11)continue;new Game(data,261014,'sword');return {key,data};}catch{}
  }return null;
 }
 migrate(id,n=1){this.check(id);this.slot(n);if(this.dead(id,n))throw Error('寿尽角色须重新轮回，不能继承旧存档');
  if(this.read(id,n))throw Error('这个角色已有存档');const old=this.legacyCandidate();if(!old)throw Error('没有可继承的旧版存档');
  const game=new Game(old.data,261014,id);
  // Claim the one-time migration BEFORE writing the slot. Failed marker writes
  // cannot leave an unmarked copy that could be imported into another role.
  this.storage.setItem(D.MIGRATION_KEY,JSON.stringify({role:id,source:old.key}));
  try{this.save(id,game,n);}catch(e){
   try{this.storage.removeItem(D.MIGRATION_KEY);}catch{}throw e;
  }
  return game;
 }
}
root.QCharacterSlots=CharacterSlots;
if(typeof module!=='undefined'&&module.exports)module.exports=CharacterSlots;
})(globalThis);
