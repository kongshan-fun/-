/* One facility, one task. Real game pages, not a demo shell. */
const facilityPanels978=new Set(['facility-forge','facility-alchemy','facility-workbench','facility-spirit','home-manage','garden','handcraft']);
for(const id of facilityPanels978)if(id!=='handcraft')HOME_PANELS_975.add(id);
let facilityTier978=1,facilityTab978='main',gardenPage978=0,gardenSelected978=null,manualReturn978=null,facilityReturn978=null;
const stationName978=p=>({'facility-forge':'炼器室','facility-alchemy':'丹房','facility-workbench':'工作台','facility-spirit':'赋灵','home-manage':'洞府营建',garden:'灵田',handcraft:'随身手作'})[p];
function routeFacility978(p,back='camp'){
 if(p!=='handcraft'){const r=game.enterHome();if(!r.ok){notify(r.msg,'warn');return;}if(!game.camp){openPanel('camp');return;}}
 if(p==='handcraft'&&(game.s.combat||game.s.secretRealm)){notify('请结束斗法或离开秘境再制作','warn');return;}
 stop();mapOpen=false;travelOpen=false;facilityReturn978=back;panel=p;facilityTier978=Math.min(12,Math.max(1,game.realmIndex));facilityTab978='main';gardenPage978=0;gardenSelected978=null;persist();render();
}
function facilityCards978(){
 const entries=[['warehouse','仓房','物资与装备分存','warehouse'],['forge','炼器室','武器、防具与装备精炼','facility-forge'],['alchemy','丹房','丹药、灵膳与灵饮','facility-alchemy'],['workbench','工作台','工具、器具与十二阶储物袋','facility-workbench'],['quiet','静室','吐纳、辟谷与休整','cultivate'],['farm','灵田',D.CROPS?game.gardenCapacity()+'块田 · '+game.gardenInfo().ready+'块成熟':'灵植经营','garden']];
 return entries.map(([id,name,hint,target])=>{const lv=game.roomLevel(id),auto=id==='workbench';return `<article class="facility978-card" id="building-${id}"><button class="facility978-enter" data-a="facility-open" data-name="${target}"><span><strong>${name}</strong><small>${auto?'已启用':lv+'/12阶'}</small></span><p>${esc(lv||auto?hint:'尚未修建 · 可查看功能')}</p><em>进入 ›</em></button><div class="facility978-foot"><small>${auto?'随洞府启用':id==='warehouse'?'容量 '+game.stashCapacity().toLocaleString('zh-CN'):lv>=12?'已达十二阶':'第'+(lv+1)+'阶可升级'}</small>${auto?'<span>无需升级</span>':`<button data-a="facility-upgrade" data-id="${id}">${lv>=12?'查看':lv?'升级':'修建'}</button>`}</div></article>`;}).join('');
}
const campBody978=campBody;
campBody=function(){if(!game.camp)return campBody978();return `<section class="home978"><div class="home978-top"><div><strong>${esc(game.campName())}</strong><small>本世唯一 · 设施各司其职</small></div><button class="btn" data-a="home-exit">探索 ›</button></div><nav class="home978-nav"><button data-a="panel" data-name="cultivate">修炼</button><button data-a="panel" data-name="warehouse">仓房</button><button data-a="facility-open" data-name="facility-forge">炼器</button><button data-a="facility-open" data-name="facility-alchemy">丹房</button><button data-a="facility-open" data-name="facility-spirit">赋灵</button></nav><div class="home978-grid">${facilityCards978()}</div><div class="home978-bottom"><span>洞府 ${game.camp.level}/12阶 · 可开放第${game.maxHomeTier}阶</span><button class="btn" data-a="facility-open" data-name="home-manage">洞府营建</button></div>${!game.s.ritual[0]&&game.s.zone===0?'<button class="btn home978-ritual" data-a="repair">准备青岚护山阵 · 地图仪式</button>':''}</section>`;};
function buildCard978(id){const lv=game.roomLevel(id),next=D.BUILDINGS[id].levels[lv],why=game.buildReason(id);return `<article class="recipe" id="manage-${id}"><div class="recipe-top"><b>${D.BUILDINGS[id].name}</b><small>${lv}/12阶</small></div><p>${esc(next?.effect||D.BUILDINGS[id].levels.at(-1).effect)}</p>${next?'<div class="recipe-cost">'+cost(next.cost)+'</div>':''}<div class="recipe-bottom"><span>${esc(why||next?.minutes+'游戏分钟')}</span><button class="btn" data-a="build" data-id="${id}" ${!next?'disabled':''}>${!next?'满阶':lv?'确认升级':'确认修建'}</button></div></article>`;}
function facilityRows978(){
 const kind=panel==='facility-forge'?'forge':panel==='facility-alchemy'?'alchemy':'workbench';
 const portable=panel==='handcraft';
 const rows=D.RECIPES.filter(r=>r.station===kind&&(!portable||r.portable)&&
  (kind==='alchemy'?(facilityTab978==='food'?D.SUPPLIES[r.item]&&['food','water'].includes(D.SUPPLIES[r.item].kind):!D.SUPPLIES[r.item]||!['food','water'].includes(D.SUPPLIES[r.item].kind)):
   kind==='workbench'?(facilityTab978==='bag'?!!r.storageBag:!r.storageBag):true));
 return rows.filter(r=>portable||kind==='workbench'&&facilityTab978!=='bag'||(r.mapTier||1)===facilityTier978);
}
function recipeCard978(r){const status=craftStat(r);return `<article class="recipe" id="recipe-${r.id}" data-station="${r.station}"><div class="recipe-top"><b>${esc(r.name)}</b><small>${r.mapTier||1}阶</small></div><p class="micro">${r.item?esc(D.ITEMS[r.item].effect||''):r.storageBag?'永久扩容，只取最大容量生效':r.gear?(r.gear==='weapon'?'攻击':'防御')+'基础 +'+r.bonus:'探索器具'}</p><div class="recipe-cost">${cost(r.cost)}</div><div class="recipe-bottom"><span>${esc(status.wrong||(r.portable?'可随身制作':r.station==='workbench'?'工作台无需升级':D.STATIONS[r.station]+' '+r.tier+'阶'))}</span><button class="btn ${status.ok?'primary':''}" data-a="craft" data-id="${r.id}" ${status.done?'disabled':''}>${status.done?'已拥有':status.ok?'炼制':'查看条件'}</button></div></article>`;}
function stationBody978(){
 if(panel==='home-manage')return `<p class="micro">只升级所需设施；工作台不建设、不升级。</p>${D.HOME_ROOMS.map(buildCard978).join('')}`;
 if(panel==='facility-spirit')return `<p class="micro">洞府 → 赋灵。只需一阶炼器室，保持原有词条、锁定及熟练度。</p>${game.roomLevel('forge')?craftSpiritBody():'<p>请先修建一阶炼器室。</p><button class="btn" data-a="facility-upgrade" data-id="forge">前往修建</button>'}`;
 const kind=panel==='facility-forge'?'forge':panel==='facility-alchemy'?'alchemy':'workbench';
 const tabs=kind==='forge'?[['main','装备配方'],['refine','装备精炼']]:kind==='alchemy'?[['main','丹药'],['food','灵膳与灵饮']]:[['main','工具与器具'],['bag','储物袋']];
 const portable=panel==='handcraft',tier=!portable&&(kind!=='workbench'||facilityTab978==='bag');
 const nav=`<div class="facility978-tabs">${tabs.filter(t=>!portable||t[0]==='main').map(([id,name])=>`<button data-a="facility-tab" data-tab="${id}" aria-pressed="${facilityTab978===id}">${name}</button>`).join('')}</div>`;
 const select=tier&&facilityTab978!=='refine'?`<label class="facility978-tier">配方阶数<select id="facility-tier"><option disabled>按地图分阶</option>${D.ZONES.map((z,i)=>`<option value="${i+1}" ${i+1===facilityTier978?'selected':''}>${i+1}阶 · ${z.name}${i>=game.s.unlocked?'（未开放）':''}</option>`).join('')}</select></label>`:'';
 const info=kind==='workbench'?(portable?'未建洞府也可制作最基础的采集工具。':'工作台随洞府启用，无等级。储物袋仍需对应地图、境界与材料。'):D.STATIONS[kind]+' '+game.roomLevel(kind)+'/12阶 · 不混入其他设施配方';
 if(facilityTab978==='refine')return nav+`<p class="micro">${info}</p>`+game.s.gears.map(g=>`<article class="recipe"><b>${esc(game.recipe(g.recipe).name)} +${g.refine}</b><p>精炼消耗灵尘 ${game.refineCost(g)} · 原词条保留</p><button class="btn" data-a="refine" data-id="${g.id}" ${g.refine>=5?'disabled':''}>${g.refine>=5?'精炼已满':'精炼'}</button></article>`).join('');
 return nav+`<p class="micro">${info}</p>`+select+facilityRows978().map(recipeCard978).join('');
}
function gardenBody978(){
 if(!D.CROPS)return '<p>灵田独立页面将在下一阶段接入；现有产出保持。</p>';
 const info=game.gardenInfo(),cap=info.capacity;
 if(!cap)return '<div class="garden978-empty"><h3>开垦第一片灵田</h3><p>一阶4块，每升一阶增加2块，十二阶26块。种子从真实草木采集中获得。</p><button class="btn primary" data-a="facility-upgrade" data-id="farm">修建一阶灵田</button></div>';
 const pages=Math.ceil(cap/12);gardenPage978=Math.min(gardenPage978,pages-1);
 const plots=info.plots.slice(gardenPage978*12,gardenPage978*12+12);
 return `<section class="garden978"><div class="garden978-summary"><strong>灵田 ${game.roomLevel('farm')}阶 <small>${cap}块</small></strong><span>空 ${info.empty} · 成熟 ${info.ready}</span></div><div class="garden978-grid">${plots.map(p=>`<button class="garden978-plot ${p.state}" data-a="garden-plot" data-index="${p.index}" aria-label="田地${p.index+1} ${esc(p.name||'空地')} ${p.state==='ready'?'成熟':p.state==='growing'?'生长中':'可播种'}"><small>${String(p.index+1).padStart(2,'0')}</small><b>${esc(p.name||'空地')}</b><span>${p.state==='ready'?'成熟 · 可收获':p.state==='empty'?'＋ 播种':p.left>=60?Math.ceil(p.left/60)+'时后成熟':p.left+'分钟后成熟'}</span><i aria-hidden="true">${p.state==='empty'?'· · ·':p.state==='ready'?'丰':'苗'}</i></button>`).join('')}</div><div class="garden978-pager"><button data-a="garden-page" data-delta="-1" ${gardenPage978===0?'disabled':''}>上一片</button><span>${gardenPage978+1} / ${pages}</span><button data-a="garden-page" data-delta="1" ${gardenPage978===pages-1?'disabled':''}>下一片</button></div><div class="garden978-actions"><button class="btn" data-a="garden-batch" ${!info.empty?'disabled':''}>空田批种</button><button class="btn primary" data-a="garden-collect" ${!info.ready?'disabled':''}>收获成熟 ${info.ready}</button><button class="btn" data-a="garden-rules">种植说明</button></div>${info.legacy?'<button class="btn garden978-legacy" data-a="garden-claim">领取旧灵田保留产出</button>':info.legacyAt!==null?'<p class="micro">旧田最后一轮 '+Math.max(0,Math.ceil((info.legacyAt-game.s.minutes)/60))+'游戏小时后可领，不再续产。</p>':''}<p class="garden978-note">按游戏时间成长；成熟不枯萎。满仓收成留田。</p></section>`;
}
const panelRender978=renderPanel;
renderPanel=function(){
 if(!facilityPanels978.has(panel)){panelRender978();if(panel==='manuals'){const b=document.querySelector('.panel-back');if(b)b.textContent=manualReturn978?'← 返回'+(manualReturn978==='camp'?'洞府':'修炼'):'← 返回探索';}return;}
 const root=$('panel-root'),old=$('panel-body')?.scrollTop||0;$('phone').classList.add('in-page');$('phone').classList.remove('in-character');
 root.innerHTML=`<div class="panel-overlay"><div class="panel"><header class="panel-head"><div class="panel-heading-group"><button class="panel-back" data-a="facility-back">← ${facilityReturn978==='book'?'返回图鉴':panel==='handcraft'?'返回背包':'返回洞府'}</button><strong>${stationName978(panel)}</strong></div><button class="panel-close" data-a="facility-back" aria-label="返回上一级">×</button></header>${panelMiniBar()}<div id="panel-body" class="panel-body facility978-body ${panel==='garden'?'garden978-body':''}">${panel==='garden'?gardenBody978():stationBody978()}</div></div></div>`;
 $('panel-body').scrollTop=old;
};
const openPanel978=openPanel;
openPanel=function(name){
 if(name==='manuals'){
  if(game.s.combat){notify('斗法结束后查看配置','warn');return;}
  manualReturn978=HOME_PANELS_975.has(panel)?(panel==='camp'?'camp':'cultivate'):null;
  openPanel975(name);return; // Core panel opener, deliberately no implicit enterHome.
 }
 if(name==='craft'){routeFacility978(game.camp?'facility-workbench':'handcraft',game.camp?'camp':'pack');return;}
 if(facilityPanels978.has(name)){routeFacility978(name);return;}
 return openPanel978(name);
};
const packBody978=packBody;packBody=function(){return `<div class="inline-buttons"><button class="btn" data-a="handcraft">随身手作 · 基础工具</button></div>`+packBody978();};
const loreBody978=loreBody;loreBody=function(){let out=loreBody978();for(const[n,k]of [['凝丹余雷','coreTribulation'],['元婴问心','heartTrial']])if(!game.s.flags[k]?.complete)out=out.replace(new RegExp('<article class="recipe"><strong>'+n+'<\\/strong>[\\s\\S]*?<\\/article>'),'');return out;};
const recipeGuide978=recipeGuide;recipeGuide=function(id){const r=game.recipe(id);if(!r)return recipeGuide978(id);const need=costGuide(r.cost,!!r.home);if(need)return need;if(r.station==='workbench'&&r.portable&&!game.camp)return {selector:panel==='handcraft'?`[data-a="craft"][data-id="${id}"]`:panel==='pack'?'[data-a="handcraft"]':'#pack-button',tip:'在背包随身手作制作基础工具。'};return {selector:panel==='facility-'+r.station?`[data-a="craft"][data-id="${id}"]`:'#home-button',tip:'进入洞府'+D.STATIONS[r.station]+'查看对应配方。'};};
function gardenModal978(){
 const m=modal;
 if(m.kind==='garden-rules')return `<h2>灵田种植</h2><p>一阶4块，每级+2，十二阶26块。种植消耗种子1、清水1、5游戏分钟。</p><p>采集草木18%掉种，连续12次保底；枯枝6%，30次保底。矿石、劫材不在种植表中。</p><p>普通草药12至24游戏小时，灵木72小时，高阶灵植48至96小时。离线不成长；成熟不枯萎、不重复自动产出。</p><button class="btn primary" data-a="modal-close">明白了</button>`;
 if(m.kind==='garden-clear')return `<h2>清理这块田？</h2><p>尚未成熟的作物将消失，种子不返还。成熟作物只能收获。</p><button class="btn" data-a="modal-close">取消</button><button class="btn warn" data-a="garden-clear-confirm" data-index="${m.index}">确认清理</button>`;
 const p=m.index===null?null:game.s.garden.plots[m.index];
 if(p){const c=D.CROPS[p.crop],left=Math.max(0,p.readyAt-game.s.minutes);return `<h2>${esc(c.name)} · ${m.index+1}号田</h2><p>${left?'还需 '+Math.ceil(left/60)+'游戏小时':'已成熟'} · 收获${esc(D.ITEMS[c.item].name)}×${p.remaining??c.yield}</p><p>成长期间可继续探索，升级灵田不会重置此作物。</p><div class="inline-buttons">${!left?'<button class="btn primary" data-a="garden-harvest-one" data-index="'+m.index+'">收获</button>':'<button class="btn" data-a="garden-clear-prompt" data-index="'+m.index+'">清理作物</button>'}<button class="btn" data-a="modal-close">返回田地</button></div>`;}
 const crops=Object.values(D.CROPS).filter(c=>game.has(c.id)>0),selected=crops.find(c=>c.id===m.crop)||crops[0];if(!selected)return '<h2>还没有可用种子</h2><p>成功采集灵草、止血草、灵果或灵木有机会获得种子。请先返回探索。</p><button class="btn" data-a="modal-close">返回田地</button>';
 m.crop=selected.id;const n=m.batch?Math.min(game.gardenInfo().empty,game.has(selected.id),game.has('water')):1,lock=selected.tier>Math.min(game.roomLevel('farm'),game.realmIndex,game.s.unlocked);
 return `<h2>${m.batch?'空田批量播种':(m.index+1)+'号田 · 播种'}</h2><label class="garden978-seedlabel" for="garden-seed">选择种子<select id="garden-seed">${crops.map(c=>`<option value="${c.id}" ${c.id===selected.id?'selected':''}>${c.name} · ${c.tier}阶 · ${game.has(c.id)}粒</option>`).join('')}</select></label><div class="garden978-preview"><p>可种 ${n}块 · 每块清水1</p><p>清水 ${game.has('water')} · 耗时 ${n*D.GARDEN.sowMinutes}游戏分钟</p><p>${selected.minutes/60}游戏小时后成熟，每块产${D.ITEMS[selected.item].name}×${selected.yield}</p>${lock?'<p class="danger-text">需要对应地图、境界与灵田阶数</p>':''}</div><div class="inline-buttons"><button class="btn" data-a="modal-close">取消</button><button class="btn primary" data-a="garden-confirm" ${lock||n<1||game.has('water')<n?'disabled':''}>确认播种</button></div>`;
}
const renderModal978=renderModal;renderModal=function(){
 if(!modal||!['garden-sow','garden-rules','garden-clear'].includes(modal.kind))return renderModal978();syncLayers();$('modal-root').innerHTML='<div class="modal-backdrop"><div class="modal garden978-modal" role="dialog" aria-modal="true">'+gardenModal978()+'</div></div>';
};
function commitGarden978(name,args={}){
 const before=game.state(),r=game.act(name,args);if(game.s.ended||!r.ok)return flush(r);
 if(!persist()){game=new QGame(before,1,before.character,null,before.difficulty);notify('未能保存，已恢复操作前状态；请导出或释放存储空间','warn');render();return;}
 return flush(r);
}
const handle978=handle;handle=function(a,b){
 if(frontPage||!activeRole)return handle978(a,b);
 if(modal&&['garden-sow','garden-rules','garden-clear'].includes(modal.kind)){
  if(a==='garden-confirm'){const m={...modal};closeModal();commitGarden978('garden-sow',{crop:m.crop,index:m.index,batch:!!m.batch});return;}
  if(a==='garden-harvest-one'){closeModal();commitGarden978('garden-harvest',{index:Number(b.dataset.index)});return;}
  if(a==='garden-clear-prompt'){showModal({kind:'garden-clear',index:Number(b.dataset.index)});return;}
  if(a==='garden-clear-confirm'){closeModal();commitGarden978('garden-clear',{index:Number(b.dataset.index)});return;}
  if(a==='modal-close'){closeModal();return;}return;
 }
 if(modal)return handle978(a,b);
 if(a==='facility-open'){const n=b.dataset.name;if(['warehouse','cultivate'].includes(n))openPanel(n);else routeFacility978(n);return;}
 if(a==='room'){routeFacility978('facility-'+b.dataset.room);return;}
 if(a==='handcraft'){routeFacility978('handcraft','pack');return;}
 if(a==='facility-upgrade'){routeFacility978('home-manage');$('manage-'+b.dataset.id)?.scrollIntoView({block:'start'});return;}
 if(a==='facility-back'||(['panel-back','close-panel'].includes(a)&&facilityPanels978.has(panel))){
  const back=facilityReturn978||'camp';if(panel==='facility-spirit'){spiritLocks=new Set();QGame.resetSpiritRetry();}panel=back;if(!HOME_PANELS_975.has(back))game.leaveHome();persist();render();return;
 }
 if(['panel-back','close-panel'].includes(a)&&panel==='manuals'){panel=manualReturn978;if(!panel)game.leaveHome();persist();render();return;}
 if(a==='facility-tab'){facilityTab978=b.dataset.tab;renderPanel();$('panel-body').scrollTop=0;return;}
 if(a==='codex-recipe'){const r=game.recipe(b.dataset.id);if(r){routeFacility978('facility-'+r.station,'book');facilityTier978=r.mapTier||1;facilityTab978=r.storageBag?'bag':r.station==='alchemy'&&['food','water'].includes(D.SUPPLIES[r.item]?.kind)?'food':'main';renderPanel();}return;}
 if(a==='garden-page'){gardenPage978=Math.max(0,Math.min(Math.ceil(game.gardenCapacity()/12)-1,gardenPage978+Number(b.dataset.delta)));renderPanel();return;}
 if(a==='garden-plot'){showModal({kind:'garden-sow',index:Number(b.dataset.index),batch:false});return;}
 if(a==='garden-batch'){showModal({kind:'garden-sow',index:null,batch:true});return;}
 if(a==='garden-collect'){commitGarden978('garden-harvest');return;}
 if(a==='garden-claim'){commitGarden978('garden-legacy');return;}
 if(a==='garden-rules'){showModal({kind:'garden-rules'});return;}
 if(a==='farm'){routeFacility978('garden');return;}
 return handle978(a,b);
};
document.addEventListener('change',e=>{if(e.target.id==='facility-tier'){facilityTier978=Number(e.target.value);renderPanel();$('panel-body').scrollTop=0;}if(e.target.id==='garden-seed'&&modal?.kind==='garden-sow'){modal.crop=e.target.value;renderModal();}});
const settingsGarden978=settingsChildBody;
settingsChildBody=function(){let out=settingsGarden978();if(panel==='set-save'&&activeRole){const store=new QCharacterSlots(saveStorage,game.s.difficulty);try{if(store.readKey(store.gardenArchiveKey(activeRole,activeSlot)))out+='<section class="v909-mod"><h3>灵田升级前原档</h3><p>原始自动灵田存档单独保留，不被日常备份覆盖。</p><button class="btn" data-a="garden-export-archive">导出种植升级前原档</button></section>';}catch{}}return out;};
const handleArchive978=handle;
handle=function(a,b){
 if(a==='garden-export-archive'&&activeRole&&!modal){try{const store=new QCharacterSlots(saveStorage,game.s.difficulty),raw=store.readKey(store.gardenArchiveKey(activeRole,activeSlot));if(!raw)throw Error('未找到归档');const state=JSON.parse(raw),out={format:'QinglanWendao',version:14,character:state.race,difficulty:state.difficulty,state};const url=URL.createObjectURL(new Blob([JSON.stringify(out,null,2)],{type:'application/json'})),el=document.createElement('a');el.href=url;el.download='山野修仙记_灵田升级前_'+activeRole+'_'+activeSlot+'.json';el.click();setTimeout(()=>URL.revokeObjectURL(url),3000);notify('原始存档已导出','ok');}catch(e){notify('导出失败：'+e.message,'warn');}return;}
 return handleArchive978(a,b);
};

// Keep the knowledge book and onboarding on the same facility rules as play.
const sources978=itemSources,details978=itemDetails;
itemSources=function(id){const c=D.CROPS?.[id];return c?'成功采集 '+c.sources.map(k=>D.RES[k].name).join('、')+' 时附获种子':sources978(id);};
itemDetails=function(id){const c=D.CROPS?.[id];return c?`<div>来源：${esc(itemSources(id))}</div><div>设施：${c.tier}阶灵田，地图与境界也须达到对应阶</div><div>播种：种子1、清水1、5游戏分钟</div><div>成熟：${c.minutes/60}游戏小时，收获${esc(D.ITEMS[c.item].name)}×${c.yield}</div><div>零重量；成熟不枯萎、满仓留田；离线不成长</div>`:details978(id);};
const bookFacility978=bookRows;
bookRows=function(){return bookFacility978().map(r=>{
 if(r.key==='home-workbench')return {...r,known:!!game.camp,hint:'随洞府启用 · 无需升级',detail:'<div>洞府建成即启用；无等级、无建设成本。</div><div>负责工具、器具和十二阶储物袋。储物袋仍检查地图、境界与材料，不检查炼器室阶数。</div>'};
 if(r.cat==='bag'&&D.STORAGE_BAGS.find(b=>'bag-'+b.id===r.key)?.tier)return {...r,hint:r.hint.replace(/炼器室\d+阶/,'工作台 · 无需升级'),detail:r.detail.replace(/炼器室\d+阶/g,'工作台 · 无需升级')};
 return r;
});};
const buildingGuide978=buildingGuide;
buildingGuide=function(id){
 if(id==='workbench')return !game.camp?settleGuide():{selector:panel==='camp'?'#building-workbench .facility978-enter':'#home-button',tip:'工作台随洞府启用，无需建设。'};
 if(!game.camp)return settleGuide();const next=D.BUILDINGS[id]?.levels[game.roomLevel(id)];if(!next)return {selector:'#home-button',tip:'设施已经满阶。'};
 if(next.home&&game.camp.level<next.home)return buildingGuide('residence');const need=costGuide(next.cost,true);if(need)return need;
 return {selector:panel==='home-manage'?`#manage-${id} [data-a="build"]`:panel==='camp'?(id==='residence'?'[data-a="facility-open"][data-name="home-manage"]':`#building-${id} [data-a="facility-upgrade"]`):'#home-button',tip:'进入洞府营建，确认修建'+D.BUILDINGS[id].name+'；条件齐备才扣材料。'};
};
const resourceGuide978=resourceGuide;
resourceGuide=function(id){const out=resourceGuide978(id);return out?.selector==='#craft-button'?{...out,selector:'#pack-button',tip:'从背包随身手作准备基础采集工具，再采集'+D.ITEMS[id].name+'。'}:out;};
const recipeRoute978=recipeGuide;
recipeGuide=function(id){const r=game.recipe(id);if(r?.room&&r.room!=='workbench'&&game.roomLevel(r.room)<r.tier)return buildingGuide(r.room);return recipeRoute978(id);};
