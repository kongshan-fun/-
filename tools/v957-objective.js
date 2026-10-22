/* V90.57 主线：地图事件与角色修为分别展示；首领记录不再冒充渡劫硬门槛。 */
function objective(){
 const s=game.s,i=s.zone,z=D.ZONES[i],camp=s.settlements[i],here=game.atCamp;
 const at=p=>!!p&&p.x===s.pos.x&&p.y===s.pos.y;
 const action=(label,type,args={})=>({label,type,...args});
 const needs=cost=>Object.entries(cost).map(([id,n])=>({id,name:D.ITEMS[id]?.name||id,n,have:game.has(id)}));
 const out={title:'',detail:'',short:'',point:null,needs:[],note:'',action:null};
 const p=progStage(),ready=p.stage===3&&s.xp>=game.required;
 if(s.ascended)return {...out,title:'凡界修行已成',detail:'飞升完成。仙界暂未开放；已探索地图可继续回访。',short:'飞升已成'};
 if(s.level===36&&i===11&&s.cleared.every(Boolean)){
  const gate=poi(i,'gate');out.title='第十二重终劫 · 飞升天门';out.point=gate;
  out.detail=`渡劫后期 ${s.xp}/${game.required}；需劫雷晶×3、天门符×2，并在界碑承受 ${game.tribDamage} 点固定终劫伤害（护劫丹最多减伤30%）。不再需要道行或旧版三重问答。`;
  out.needs=needs(D.ASCENSION_RULE.cost);out.note='当前气血 '+s.hp+'/'+s.maxHp+' · '+(ready?'后期圆满':'继续修满后期');
  out.action=gate?(at(gate)?action('查看飞升条件','panel',{panel:'cultivate-trial'}):action('导航到飞升天门','map',{x:gate.x,y:gate.y})):null;
  out.short='渡劫圆满 · 天门最终固定伤害';return out;
 }
 if(ready&&s.level<36&&game.realmIndex===i+1){
  out.title=game.realm+' · 后期圆满';
  out.detail='本段修为已修满。返回当前所在境域自己的洞府，在「洞府 → 修炼 → 渡劫」承受固定伤害；不再要求道行或三重试炼。';
  out.point=camp?{...camp.pos,mark:'府',name:'本境自建洞府'}:null;
  out.note='本次伤害 '+game.tribDamage+' · 气血 '+s.hp+'/'+s.maxHp;
  out.action=!camp?action('在本境筑庐','panel',{panel:'camp'}):here?action('进入渡劫条件页','panel',{panel:'cultivate-trial'}):action('返回本境洞府','map',{x:camp.pos.x,y:camp.pos.y});
  out.short=game.realm+' · 可准备渡劫';return out;
 }
 if(!s.ritual[i]){
  if(i===0){
   out.title=camp?'修建青岚山门与护山阵':'先择地筑庐，建立洞府';
   out.detail=camp?'在自建洞府修筑山门和护山阵；完成后解锁首领挑战。':'采集木石与青藤，在合适地形筑庐，之后营建山门。';
   out.point=camp?{...camp.pos,mark:'府',name:'自建洞府'}:null;out.needs=camp?needs(z.need):[];
   out.action=!camp?action('打开洞府选址','panel',{panel:'camp'}):here?action('查看山门营建','panel',{panel:'camp'}):action('返回洞府','map',{x:camp.pos.x,y:camp.pos.y});
  }else{
   const altar=poi(i,'shrine');out.title=z.verb+' · '+z.altar;out.point=altar;
   out.detail='本境探索目标：携带仪式材料前往祭坛，完成后解锁首领据点。这是地图任务，不是已满修为的渡劫条件。';
   out.needs=needs(z.need);out.action=altar?(at(altar)?action('在此完成'+z.verb,'repair'):action('导航到'+z.altar,'map',{x:altar.x,y:altar.y})):null;
  }
 }else if(!s.cleared[i]){
  const boss=poi(i,'boss'),enemy=D.ENEMIES[z.boss]?.name||'本境首领';out.title='挑战首领 · '+enemy;out.point=boss;
  out.detail='仪式已经完成，前往首领据点挑战；建议先检查气血、食水和装备。首领通关记录用于地图进度与飞升条件。';
  out.action=boss?(at(boss)?action('在此挑战首领','hunt'):action('导航到首领据点','map',{x:boss.x,y:boss.y})):null;
 }else if(i===11&&s.level<36){
  out.title='渡劫天门 · 修满最终境界';out.detail=`当前 ${game.realm}，修为 ${s.xp}/${game.required}。把人物修至渡劫后期圆满（等级36），随后到界碑完成飞升终劫。`;
  out.action=action('查看修炼与渡劫','panel',{panel:'cultivate-trial'});
 }else if(i<11){
  out.title='本境已平定 · 继续修炼与探索';
  out.detail=`当前 ${game.realm}，修为 ${s.xp}/${game.required}。初/中期修满自动升段，后期圆满回本境洞府渡劫；可探索旧境采集。`;
  out.action=action('查看修炼进度','panel',{panel:'cultivate'});
 }else{
  out.title='前往飞升界碑';out.detail='渡劫天门的最终目标是修满36段、平定十二境并准备灵材，在界碑承受第十二重固定伤害。';
  out.action=action('查看修炼','panel',{panel:'cultivate-trial'});
 }
 out.short=out.title;return out;
}
