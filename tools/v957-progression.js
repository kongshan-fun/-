/* V90.57 · 修行阶段只读引导。十二境/36段来自引擎 getter，不再读取已经退役的 daoXp。 */
function progStage(){
 const s=game.s,index=game.realmIndex,stage=game.stageIndex,goal=D.ZONES[index-1]?.name||'本境';
 return {index,stage,goal,current:game.realm,need:game.required,final:index===12};
}
function progRows(kind){
 const s=game.s,p=progStage(),rows=[];
 const add=(label,pass,value)=>rows.push({label,pass:!!pass,text:String(value)});
 const max=p.final&&s.level===36;
 add('修为阶段',p.stage===3,p.stage===3?'后期'+(s.xp>=p.need?'圆满':'修炼中'):['','初期','中期','后期'][p.stage]+' · 自动升阶');
 add('本段修为',s.xp>=p.need,s.xp+'/'+p.need);
 if(s.ascended){add('飞升状态',true,'凡界飞升已成');return rows;}
 if(max){
  add('飞升地点',s.zone===11&&game.land()==='gate',s.zone===11&&game.land()==='gate'?'已到天门界碑':'渡劫天门 · 界碑');
  add('十二境首领',s.cleared.every(Boolean),s.cleared.filter(Boolean).length+'/12');
  for(const [id,num] of Object.entries(D.ASCENSION_RULE.cost))add(D.ITEMS[id]?.name||id,game.has(id)>=num,game.has(id)+'/'+num);
 }else{
  add('当前洞府',game.atCamp,game.atCamp?'已在本境洞府':game.camp?'需返回本境洞府':'本境未建洞府');
 }
 if(p.stage===3&&s.xp>=p.need){
  const prediction=game.tribPreview(max);
  add('气血承受',prediction.safe,`${s.hp} / 需至少 ${prediction.damage+prediction.survivalDamage+1}`);
  if(prediction.survivalDamage>0)add('额外生存损耗',false,'预计 −'+prediction.survivalDamage+' · 请先补给');
  add('护劫丹',true,game.tribPills+' 颗生效，减伤 '+Math.round(game.tribReduce*100)+'%');
 }
 return rows;
}
function progNext(kind){
 const s=game.s,p=progStage(),atFinal=s.level===36;
 if(s.ascended)return {label:'已飞升',hint:'此世飞升完成，可继续自由探索',act:null};
 if(p.stage<3||s.xp<p.need){
  return {label:'继续修炼',hint:`${game.realm} · 修为 ${s.xp}/${p.need}；修满初/中期自动进阶，后期圆满后须主动渡劫`,act:null};
 }
 if(atFinal){
  if(s.zone!==11)return {label:'前往渡劫天门',hint:'当前应前往第十二境',act:'panel',args:'quest'};
  if(game.land()!=='gate')return {label:'前往飞升界碑',hint:'到本境地图「界」字处',act:'map',x:7,y:5};
  if(!s.cleared.every(Boolean))return {label:'平定十二境首领',hint:`已平定 ${s.cleared.filter(Boolean).length}/12；当前飞升规则要求十二境全部通关`,act:'panel',args:'quest'};
  const missed=Object.entries(D.ASCENSION_RULE.cost).find(([id,n])=>game.has(id)<n);
  if(missed)return {label:'准备飞升灵材',hint:`${D.ITEMS[missed[0]]?.name||missed[0]} ${game.has(missed[0])}/${missed[1]}`,act:'panel',args:'pack'};
 }else{
  if(!game.camp)return {label:'先在本境建立洞府',hint:'须在当前所在地图筑庐后渡劫，其他境洞府不能代替',act:'panel',args:'camp'};
  if(!game.atCamp)return {label:'返回本境洞府',hint:'前往自己在本境的洞府',act:'map',x:game.camp.pos.x,y:game.camp.pos.y};
 }
 const check=game.tribPreview(atFinal);
 if(!check.safe)return {label:'补充气血和生存物资',hint:`伤害 ${check.damage}，额外生存损耗预计 ${check.survivalDamage}；当前气血 ${s.hp}，需至少 ${check.damage+check.survivalDamage+1}。可使用护劫丹减伤。`,act:null};
 return {label:atFinal?'渡过飞升终劫':'渡劫突破下一境',hint:`预计实际扣血 ${check.damage+check.survivalDamage}；成功后剩余 ${check.hpAfter}/${check.maxAfter}（${check.percent}%）`,act:atFinal?'ascend':'breakthrough'};
}
function progGuide(kind,opts){
 const p=progStage(),rows=progRows(kind),next=progNext(kind),done=rows.filter(r=>r.pass).length;
 const button=next?.act&&!opts?.noAct?`<button class="btn primary prog-act" data-a="${next.act}"${next.args?` data-name="${esc(next.args)}"`:''}${next.act==='map'?` data-x="${next.x}" data-y="${next.y}"`:''}>${esc(next.label)} →</button>`:'';
 return `<section class="prog-card" aria-label="十二境修为指引"><div class="prog-head"><span class="prog-realm">${esc(p.current)} · 第${p.index}/12境</span><span class="prog-prog">${done}/${rows.length}</span></div><p class="prog-where">等级 ${game.s.level}/36 · ${esc(p.stage===3?'后期':'初中期')} · ${esc(p.final?'最终飞升阶段':'逐段修炼')}</p><div class="prog-rows">${rows.map(r=>`<div class="prog-row ${r.pass?'ok':'no'}"><span class="prog-mark">${r.pass?'✓':'·'}</span><span class="prog-label">${esc(r.label)}</span><span class="prog-val">${esc(r.text)}</span></div>`).join('')}</div><div class="prog-next"><strong>下一步 · ${esc(next.label)}</strong><span>${esc(next.hint)}</span></div>${button}</section>`;
}
