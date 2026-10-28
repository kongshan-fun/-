/* V90.75 UI: replace stale entry points without adding image assets or a new shell. */
const HOME_PANELS_975=new Set(['camp','warehouse','craft','craft-cat','craft-tier','craft-spirit','cultivate','cultivate-trial','cultivate-rest','cultivate-art','manuals','tribulation','hearttrial']);
function quickLabel975(slot){return D.ITEMS[game.s.quickSlots[slot]]?.name||D.QUICK_LABELS[slot];}
function renderQuick975(){
 const box=$('supply-slots');if(!box)return;
 box.innerHTML=game.s.quickSlots.map((id,i)=>`<button id="${['salve-button','mana-button','food-button','water-button'][i]}" data-a="quick-use" data-slot="${i}" title="${esc(D.ITEMS[id].effect)}" ${(game.s.inv[id]||0)<=0?'disabled':''}><span>${esc(D.ITEMS[id].name)}</span><small>×${game.s.inv[id]||0}</small></button>`).join('');
 $('home-button').textContent='洞府';$('rest-button').textContent=game.workshop?'休息':'调息';$('rest-button').disabled=!!game.s.secretRealm;
}
function quicksetupBody(){
 return `<section class="quick975"><p class="micro">四格分别配置回血、回灵、食物和饮水。只消耗随身物品，不自动改用其他药品。</p>${D.QUICK_KINDS.map((kind,i)=>{
  const choices=Object.keys(D.SUPPLIES).filter(id=>D.SUPPLIES[id].kind===kind&&(game.s.inv[id]>0||game.s.codex.items[id]||game.s.quickSlots.includes(id)||D.QUICK_DEFAULTS.includes(id))).sort((a,b)=>D.SUPPLIES[b].tier-D.SUPPLIES[a].tier||a.localeCompare(b));
  const id=game.s.quickSlots[i];return `<div class="quick975-row"><label for="quick-slot-${i}">${D.QUICK_LABELS[i]}<small>${i<2?'战斗使用占一回合':'非战斗使用'}</small></label><select id="quick-slot-${i}" data-quick-slot="${i}">${choices.map(k=>`<option value="${k}" ${k===id?'selected':''}>${esc(D.ITEMS[k].name)} · ${D.SUPPLIES[k].tier}阶 · 随身${game.s.inv[k]||0}</option>`).join('')}</select><p>${esc(D.ITEMS[id].effect)}</p></div>`;
 }).join('')}<p class="micro">配置随当前难度、种族、档位保存。缺货时按钮置灰；可回洞府仓库整理行装。</p></section>`;
}
buildingCard=function(id){
 const lv=game.roomLevel(id),next=D.BUILDINGS[id].levels[lv],why=game.buildReason(id),max=lv>=12;
 return `<article class="building-card home975-card" id="building-${id}"><div class="home975-card-head"><strong>${D.BUILDINGS[id].name}</strong><span>${lv}/12阶</span></div><div class="home975-cost">${max?'已达十二阶':cost(next.cost)}</div><div class="home975-card-foot"><small>${id==='warehouse'?'容量 '+game.stashCapacity().toLocaleString('zh-CN'):max?'圆满':why?'未就绪':'可营建'}</small><button class="btn ${!why?'primary':''}" data-a="build" data-id="${id}" ${max?'disabled':''} title="${esc(why||'建设下一阶')}">${max?'满阶':lv?'升级':'修建'}</button></div></article>`;
};
campBody=function(){
 const c=game.camp;
 if(!c)return `<div class="home975-empty"><div class="kicker">本世唯一 · 全地图共用</div><h2>开辟洞府</h2><p>只需建造一次。日后无论身处哪张地图，都能从固定入口返回。</p><div class="recipe-cost">${cost(D.SETTLE_COST)}</div><button id="settle-button" class="btn primary" data-a="home-build">建造草庐</button><p class="micro">洞府不覆盖地图地块；离开后仍在原位置。斗法与秘境中不可进入。</p></div>`;
 const pending=Object.values(c.pendingHarvest||{}).some(n=>n>0),left=game.farmRemaining();
 return `<section class="home975"><div class="home975-heading"><div><strong>${esc(game.campName())}</strong><small>全地图共用 · ${c.migratedFrom?'已合并'+c.migratedFrom+'座旧洞府':'当前档位独立'}</small></div><button class="btn" data-a="home-exit">返回探索</button></div><div class="camp-func-row"><button class="btn primary" data-a="panel" data-name="cultivate">修炼</button><button class="btn" data-a="panel" data-name="warehouse">仓库</button><button class="btn" data-a="room" data-room="forge">炼器</button><button class="btn" data-a="room" data-room="alchemy">炼丹</button><button class="btn" data-a="panel" data-name="manuals">功法</button></div><div class="farm-strip"><span>灵田 · ${pending?'保留产出待归仓':left===null?'尚未修建':game.farmBatches?'可收'+game.farmBatches+'轮':'余'+Math.ceil(left/60)+'小时'}</span><button class="btn" data-a="farm" ${left===null&&!pending?'disabled':''}>收获</button></div><h3 class="camp-build-title">洞府设施 <small>地图、设施、配方按一至十二阶对应</small></h3><div class="build-grid home975-grid">${D.HOME_ROOMS.map(buildingCard).join('')}</div>${!game.s.ritual[0]&&game.s.zone===0?'<div class="home975-ritual"><span>青岚护山阵 · 地图仪式</span><button class="btn" data-a="repair">修复护山阵</button></div>':''}<p class="home975-note">仓房 ${game.stashWeight().toLocaleString('zh-CN')} / ${game.stashCapacity().toLocaleString('zh-CN')} · 最高开放第 ${game.s.unlocked} 图</p></section>`;
};
craftRowsFor=function(key){return D.RECIPES.filter(r=>key==='all'||(key==='bag'?!!r.storageBag:key==='tool'?r.type==='工具':key==='gear'?!!(r.gear||r.flag):!!r.item&&D.ITEMS[r.item]?.type==='food'));};
craftListBody=function(){
 const all=craftRowsFor(filter),tiers=[...new Set(all.map(r=>r.mapTier||r.tier||1))].sort((a,b)=>a-b);
 if(craftTier===null&&tiers.length>1)return `<p class="micro">第N阶对应第N张地图。解锁地图、修为境界和对应设施共同决定能否炼制。</p><nav class="cult-nav">${tiers.map(t=>{const rows=all.filter(r=>(r.mapTier||r.tier||1)===t),count=craftCounts(rows);return `<button class="cult-nav-row" data-a="panel-step" data-name="craft-tier" data-tier="${t}"><span class="cult-nav-main"><b>${t} 阶 · ${D.ZONES[t-1].name}</b><small>${rows.length} 种配方${t>game.s.unlocked?' · 地图尚未开放':''}</small></span><span class="cult-nav-right">可炼 ${count.ok}<i>›</i></span></button>`;}).join('')}</nav>`;
 const rows=all.filter(r=>craftTier===null||(r.mapTier||r.tier||1)===craftTier),cnt=craftCounts(rows);
 return `<div class="craft-summary"><span>可炼 ${cnt.ok} / ${rows.length}</span>${craftTier?'<span>'+craftTier+'阶 · '+D.ZONES[craftTier-1].short+'</span>':''}</div>`+rows.map(r=>{const st=craftStat(r);return `<article class="recipe" id="recipe-${r.id}"><div class="recipe-top"><b>${esc(r.name)}</b><small>${r.mapTier||r.tier||1}阶</small></div><p class="micro">${r.item?esc(D.ITEMS[r.item].effect||''):r.gear?(r.gear==='weapon'?'攻击':'防御')+'基础 +'+r.bonus:r.storageBag?'永久增加随身负重':''}</p><div class="recipe-cost">${cost(r.cost)}</div><div class="recipe-bottom"><span>${esc(st.wrong||r.room&&D.BUILDINGS[r.room].name+' '+r.tier+'阶'||'随身配方')}</span><button class="btn ${st.ok?'primary':''}" data-a="craft" data-id="${r.id}" ${st.done?'disabled':''}>${st.done?'已拥有':st.ok?'炼制':st.wrong?'查看条件':'缺材料'}</button></div></article>`;}).join('');
};
const oldSpiritBody975=craftSpiritBody;
craftSpiritBody=function(){return `<div class="spirit975-balance"><strong>可用修为 ${game.s.xp.toLocaleString('zh-CN')}</strong><span>灵石 ${game.has('stone').toLocaleString('zh-CN')}</span><small>赋灵消费当前修为；熟练度仅在成功后增长。</small></div>`+oldSpiritBody975();};
function cultivation975(){
 const s=game.s;
 if(s.ascended)return {title:'飞升已成',detail:'可以继续探索、收集与营建，或结算本世领取轮回玉。',panel:'cultivate'};
 if(s.level>=36)return {title:s.xp>=game.required?'准备飞升天门':'修满渡劫后期',detail:'当前修为 '+s.xp+'/'+game.required+'；飞升还须平定十二图并携带天门材料。',panel:'cultivate-trial'};
 const full=game.stageIndex===3&&s.xp>=game.required;
 return {title:full?(game.needsTribulation?'准备渡劫':'准备晋升'):'积累修为 · '+game.realm,detail:'当前修为 '+s.xp+'/'+game.required+(full&&game.needsTribulation?' · 本次雷劫伤害 '+game.tribDamage+'，当前气血 '+s.hp:' · 采集、战斗、吐纳均可获得修为'),panel:'cultivate-trial'};
}
objective=function(){
 const s=game.s,z=D.ZONES[s.zone],out={title:'',short:'',detail:'',needs:[],point:null,action:null,note:''};
 const action=(label,type,args={})=>({label,type,...args});
 if(!game.camp){out.title='建造本世唯一洞府';out.detail='点击洞府建造一次，所有地图共用。';out.action=action('进入洞府','panel',{panel:'camp'});}
 else if(s.ascended){out.title='飞升已成 · 人间自由修行';out.detail='原有见闻可选回访，不会倒退修行主线。';out.action=action('查看修行','panel',{panel:'cultivate'});}
 else if(!s.ritual[s.zone]){out.title='完成'+z.verb;out.detail=s.zone===0?'进入洞府准备青岚护山阵，完成后挑战首领。':'携带仪式材料前往'+z.altar+'，完成后开放首领。';out.needs=Object.entries(z.need).map(([id,n])=>({id,n,name:D.ITEMS[id].name,have:game.has(id)}));out.point=s.zone===0?null:poi(s.zone,'shrine');out.action=s.zone===0?action('打开洞府','panel',{panel:'camp'}):out.point?action('前往祭坛','map',out.point):null;}
 else if(!s.cleared[s.zone]){out.title='挑战'+D.ENEMIES[z.boss].name;out.detail='仪式已经完成，携带补给并检查装备后前往首领。';out.point=poi(s.zone,'boss');out.action=out.point?action('前往首领','map',out.point):null;}
 else if(s.zone<11&&s.unlocked>s.zone+1){out.title='前往'+D.ZONES[s.zone+1].name;out.detail='本图已经平定。角色境界：'+game.realm+'；不要求回补旧剧情。';out.action=action('前往下一图','zone',{zone:s.zone+1});}
 else if(s.zone===11&&s.level>=36&&s.xp>=game.required&&s.cleared.every(Boolean)){out.title='准备飞升';out.detail='携带飞升材料，前往天门界碑。';out.needs=Object.entries(D.ASCENSION_RULE.cost).map(([id,n])=>({id,n,name:D.ITEMS[id].name,have:game.has(id)}));out.point=poi(11,'gate');out.action=out.point?action('前往飞升界碑','map',out.point):null;}
 else{const g=cultivation975();out.title=g.title;out.detail=g.detail;out.action=action('进入洞府修行','panel',{panel:'cultivate'});}
 out.short=out.title;return out;
};
questDisplay=function(){
 const q=objective(),c=cultivation975(),s=game.s,a=q.action;
 const button=a?`<button class="btn primary" data-a="${a.type}" ${a.type==='panel'?'data-name="'+a.panel+'"':a.type==='zone'?'data-zone="'+a.zone+'"':'data-x="'+a.x+'" data-y="'+a.y+'"'}>${esc(a.label)} →</button>`:'';
 return `<section class="q975"><div class="q3-title"><strong>${esc(game.realm)}</strong><span>已平定 ${s.cleared.filter(Boolean).length}/12 图</span></div><section class="q3-main"><small>下一步</small><h3>${esc(q.title)}</h3><p>${esc(q.detail)}</p>${q.needs.length?'<div class="recipe-cost">'+q.needs.map(r=>esc(r.name)+' '+r.have+'/'+r.n).join(' · ')+'</div>':''}${button}</section><section class="q975-cult"><strong>修行目标 · ${esc(c.title)}</strong><p>${esc(c.detail)}</p><button class="btn" data-a="panel" data-name="cultivate">洞府修行</button></section><nav class="cult-nav"><button class="cult-nav-row" data-a="quest-subpage" data-page="world"><span class="cult-nav-main"><b>十二图进度</b><small>地图进度与角色境界分别记录</small></span><i>›</i></button><button class="cult-nav-row" data-a="lore-open"><span class="cult-nav-main"><b>可选见闻</b><small>不作为晋升、渡劫或飞升前置</small></span><i>›</i></button></nav></section>`;
};
questBody=function(){return questDisplay();};
worldPage=function(){const s=game.s;return `<div class="q4-page"><h3>十二张地图 · 当前${esc(game.realm)}</h3><p class="micro">每图对应同阶装备与设施。只读真实仪式、首领和解锁状态。</p><ol class="q4-stages">${D.ZONES.map((z,i)=>`<li class="${i===s.zone?'current':''}"><span class="q4-no">${i+1}</span><span class="q4-name"><strong>${z.name}</strong><small>${i+1}阶装备 · ${s.ritual[i]?'仪式完成':'仪式未完成'}</small></span><em>${s.cleared[i]?'已平定':i<s.unlocked?'可探索':'未开放'}</em></li>`).join('')}</ol><button class="btn" data-a="quest-return">返回修行目标</button></div>`;};
guidePage=function(){const q=objective();return `<h3>${esc(q.title)}</h3><p>${esc(q.detail)}</p><p>洞府全地图共用；修为统一使用当前修为。见闻与旧试炼不再作为破境前置。</p><button class="btn" data-a="quest-return">返回修行目标</button>`;};
realmPlaybookHTML=function(){const q=objective();return `<section class="realm-playbook"><h3>当前行动</h3><p>${esc(q.detail)}</p><p>气血与灵力不足时可使用同阶补给；点击快捷栏配置更换道具。</p></section>`;};
manualPlaytestHints=function(){const q=objective();return `<section class="manual-hints"><h3>当前建议行动</h3><p>${esc(q.title)} · ${esc(q.detail)}</p></section>`;};
loreBody=function(){const f=game.s.flags,rows=[['失名古碑',f.steleChoice>0,f.steleChoice===1?'你选择守碑留名。':'你选择取符藏纹。'],['丹痕遗府',(f.relicCourt||0)>0,'外碑与残禁曾留下你的足迹。'],['凝丹余雷',!!f.coreTribulation?.complete,'旧日三重雷考已有完成记录。'],['元婴问心',!!f.heartTrial?.complete,'旧日问心已有完成记录。'],['折界裂隙',!!f.voidRift?.complete,'你曾走过折界隙眼。'],['映心镜台',!!f.mirrorTrial?.complete,'你曾查明镜台残卷。'],['旧印因果',!!f.karmaReckoning?.ending,game.karmaEndingStory()],['大道残碑',!!f.daoStele?.complete,game.daoEndingText()],['仙人遗府',!!f.immortalEstate?.complete,game.estateConclusion()],['九霄终劫',!!f.heavenTrial?.complete,game.heavenSummary()]];return `<section class="world-journal-page"><p>可选见闻只记录实际发生的选择。未完成不影响晋升、渡劫和飞升，也不会重复发放奖励。</p>${rows.map(([name,done,text])=>`<article class="recipe"><strong>${name}</strong><p>${done?esc(text):'尚未亲历 · 无需为主线回补'}</p></article>`).join('')}</section>`;};

function preHomeArchive975(){
 if(!activeRole)return null;
 const store=new QCharacterSlots(saveStorage,game.s.difficulty);
 return store.readKey(store.key(activeRole,activeSlot)+'-pre-global-home-v975');
}
function exportPreHome975(){
 try{
  const raw=preHomeArchive975();if(!raw)throw Error('本档没有升级前归档');
  const state=JSON.parse(raw),envelope={format:'QinglanWendao',version:14,difficulty:state.difficulty||'challenge',character:state.race,exportedAt:new Date().toISOString(),state};
  const url=URL.createObjectURL(new Blob([JSON.stringify(envelope,null,2)],{type:'application/json'})),a=document.createElement('a');
  a.href=url;a.download='山野修仙记_V90.75升级前_'+activeRole+'_'+String(activeSlot).padStart(3,'0')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
  notify('升级前原档已导出，可配合旧版文件回退','ok');
 }catch(e){notify('归档导出失败：'+e.message,'warn');}
}
const settingsChild975=settingsChildBody;
settingsChildBody=function(){
 const out=settingsChild975();let archive=false;try{archive=panel==='set-save'&&!!preHomeArchive975();}catch{}
 return out+(archive?'<section class="v909-mod"><h3>升级前安全归档</h3><p>保留合并洞府前的原始进度，不被日常自动备份覆盖。</p><button class="btn" data-a="export-prehome-archive">导出 V90.75 升级前存档</button></section>':'');
};
settleGuide=function(){
 const missing=Object.entries(D.SETTLE_COST).find(([id,n])=>game.has(id)<n);
 if(missing)return resourceGuide(missing[0]);
 return panel==='camp'?{selector:'[data-a="home-build"]',tip:'材料齐备，在这里建造本世唯一洞府。'}:{selector:'#home-button',tip:'点击固定洞府入口，无需寻找地图建造地块。'};
};
const guideTarget975=guideTarget;
guideTarget=function(){
 const s=game.s;
 if(!s.combat&&s.hunger<30&&s.inv[s.quickSlots[2]]>0)return {selector:'#food-button',tip:'使用已配置的食物补充饱腹。'};
 if(!s.combat&&s.water<25&&s.inv[s.quickSlots[3]]>0)return {selector:'#water-button',tip:'使用已配置的饮水补充水分。'};
 return guideTarget975();
};


const bookRows975=bookRows;
bookRows=function(){
 const rows=bookRows975().filter(r=>r.cat!=='realm'&&r.key!=='home-gate');
 for(let i=0;i<12;i++)rows.push({key:'realm-'+i,name:(D.REALM12[game.s.character]||D.REALM12.human)[i]+' · '+(i+1)+'境',cat:'realm',known:game.realmIndex>=i+1,mark:'修',hint:'初期、中期、后期 · 修为统一结算',detail:'<div>修为：本境后期修满后，在洞府晋升或渡劫。</div><div>规则：不要求三重雷考、问心或旧道行池。</div><div>雷劫：从筑基进入金丹起检查实际气血与护劫丹；以修炼页当前数值为准。</div><div>飞升：渡劫后期修满、平定十二图、携带材料前往天门界碑。</div>'});
 for(const r of rows)if(r.cat==='zone')r.detail=r.detail.replace('首次完成本境首领试炼后开启下一境。','首领与境界共同决定下一图开放，按出行列表真实条件显示。');
 return rows;
};
const cultivateTrial975=cultivateTrialBody;
cultivateTrialBody=function(){
 let out=cultivateTrial975();
 if(game.s.level>=36&&!game.s.ascended&&game.s.zone!==11){
  out=out.replace('<button class="btn primary" data-a="map" data-x="7" data-y="5">前往天门</button>',game.s.unlocked>=12?'<button class="btn primary" data-a="zone" data-zone="11">前往渡劫天门</button>':'<p class="micro">尚未开放第十二图，先完成地图仪式与首领。</p>');
 }
 return out;
};

const openPanel975=openPanel;
openPanel=function(name){
 if(HOME_PANELS_975.has(name)){const r=game.enterHome();if(!r.ok){notify(r.msg,'warn');return;}}
 else game.leaveHome();
 openPanel975(name);if(!HOME_PANELS_975.has(panel)){game.leaveHome();persist();}
};
const render975=render;
render=function(){if(game&&game.s.atHome&&!HOME_PANELS_975.has(panel))game.leaveHome();render975();renderQuick975();};
const handle975=handle;
handle=function(a,b){
 if(frontPage||!activeRole)return handle975(a,b);
 if(a==='export-prehome-archive'){exportPreHome975();return;}
 if(a==='home'){if(panel==='camp')return;openPanel('camp');return;}
 if(a==='home-exit'){game.leaveHome();panel=null;modal=null;renderModal();persist();render();return;}
 if(a==='home-build'){const r=game.enterHome();if(r.ok)run('settle');else notify(r.msg,'warn');return;}
 if(a==='quick-config'){openPanel('quicksetup');return;}
 if(a==='quick-use'){const i=Number(b.dataset.slot);if(i<0||i>3)return;const id=game.s.quickSlots[i];run(game.s.combat?'fight':'consume',game.s.combat?{mode:i===0?'heal':i===1?'mana':'invalid',id}:{id});return;}
 if((a==='panel-step'||a==='cult-step')&&HOME_PANELS_975.has(b.dataset.name)){const r=game.enterHome();if(!r.ok){notify(r.msg,'warn');return;}}
 if(a==='room'){const r=game.enterHome();if(!r.ok){notify(r.msg,'warn');return;}}
 if((a==='panel-back'||a==='close-panel')&&HOME_PANELS_975.has(panel)){
  if(panel==='craft-spirit'){spiritLocks=new Set();QGame.resetSpiritRetry();}
  const parent={'craft-tier':'craft-cat','craft-cat':'craft','craft-spirit':'craft','cultivate-trial':'cultivate','cultivate-art':'cultivate','cultivate-rest':'cultivate','tribulation':'cultivate','hearttrial':'cultivate'}[panel];
  if(panel==='camp'){panel=null;game.leaveHome();}else panel=parent||'camp';
  persist();render();return;
 }
 if(['map','mini-step','travel-toggle','zone','expand-map'].includes(a))game.leaveHome();
 return handle975(a,b);
};
document.addEventListener('change',e=>{const slot=e.target.dataset?.quickSlot;if(slot!==undefined){const r=game.setQuickSlot(Number(slot),e.target.value);if(r.ok)persist();renderPanel();renderQuick975();notify(r.msg,r.ok?'ok':'warn');}});
