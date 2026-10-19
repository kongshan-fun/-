/* ===== V90.12 面板父子级扩展：炼制 / 洞府 =====
   沿用 V90.11 的父子页模式：父页留摘要与分类入口，子页承接列表。
   不新增滚动容器，不改任何动作、数值、配方与建筑规则。 */

function isListChild(p){return p==='craft-cat'||p==='camp-build';}

/* ---------- 炼制 ---------- */
const CRAFT_CATS=[
 {key:'all',name:'全部配方',sub:'按可炼制程度排序'},
 {key:'food',name:'丹药 · 食物',sub:'回血、灵机与补给'},
 {key:'tool',name:'工具',sub:'斧、镐等采集工具'},
 {key:'gear',name:'装备',sub:'武器与防具，品质随机'},
 {key:'bag',name:'储物袋',sub:'每档永久增加负重'}
];

function craftStat(r){
 const done=(r.storageBag&&game.hasStorageBag(r.storageBag))||(r.unique&&game.has(r.item))||(r.flag&&game.s.flags[r.flag]);
 const wrong=game.recipeRequirement(r);
 return {done,wrong,ok:!done&&!wrong&&game.enough(r.cost)};
}

function craftRowsFor(key){
 return D.RECIPES.filter(r=>(r.zone||0)<game.s.unlocked)
  .filter(r=>key==='all'||(key==='bag'?!!r.storageBag:key==='tool'?r.type==='工具':key==='gear'?!!(r.gear||r.flag):r.type==='丹药'||r.type==='食物'));
}

function craftBody(){
 const all=craftRowsFor('all');
 const total={ok:0,mat:0,other:0};
 for(const r of all){const s=craftStat(r);if(s.ok)total.ok++;else if(!s.wrong)total.mat++;else total.other++;}
 const rows=CRAFT_CATS.map(c=>{
  const list=craftRowsFor(c.key);
  const st={ok:0,mat:0,other:0};
  for(const r of list){const s=craftStat(r);if(s.ok)st.ok++;else if(!s.wrong)st.mat++;else st.other++;}
  const state=list.length?`可炼 ${st.ok} / ${list.length}`:'暂无解锁';
  return `<button type="button" class="cult-nav-row" data-a="panel-step" data-name="craft-cat" data-cat="${c.key}">`+
   `<span class="cult-nav-main"><b>${c.name}</b><small>${c.sub}</small></span>`+
   `<span class="cult-nav-right">${state}<i>›</i></span></button>`;
 }).join('');
 return `<div class="craft-summary"><span class="craft-ok">可炼制 ${total.ok}</span><span>缺材料 ${total.mat}</span><span>未就绪 ${total.other}</span><span class="craft-total">共 ${all.length}</span></div>`+
  `<p class="muted">按类型进入；每个类型内按「可炼制 → 缺材料 → 未就绪」排序，采集指路保留。</p>`+
  `<nav class="cult-nav" aria-label="炼制品类">${rows}</nav>`;
}

function craftListBody(){
 const rows=craftRowsFor(filter);
 const counts={ok:0,mat:0,other:0};
 for(const r of rows){const s=craftStat(r);if(s.ok)counts.ok++;else if(!s.wrong)counts.mat++;else counts.other++;}
 const cat=CRAFT_CATS.find(c=>c.key===filter)||CRAFT_CATS[0];
 const bar=`<div class="craft-summary"><span class="craft-ok">可炼制 ${counts.ok}</span><span>缺材料 ${counts.mat}</span><span>未就绪 ${counts.other}</span><span class="craft-total">共 ${rows.length}</span></div>`;
 const sorted=[...rows].sort((a,b)=>{const ra=craftStat(a),rb=craftStat(b);const ka=ra.ok?0:ra.wrong?2:1,kb=rb.ok?0:rb.wrong?2:1;return ka-kb;});
 if(!sorted.length)return bar+`<p class="muted">「${cat.name}」当前没有解锁的配方，提升境界或解锁新境域后会出现在这里。</p>`;
 return bar+sorted.map(r=>{const s=craftStat(r),done=s.done,wrong=s.wrong;
   const miss=Object.keys(r.cost).filter(k=>game.has(k)<(r.cost[k]||0));
   const src=miss.length?progMatSource(miss[0]):null;
   const hint=src?`${(D.ITEMS[miss[0]]&&D.ITEMS[miss[0]].name)||miss[0]} 见于 ${src.zoneName} · ${src.res.name}`:'';
   return `<div class="recipe${s.ok?' recipe-ready':''}" id="recipe-${r.id}"><div class="recipe-top"><b>${r.name}</b><small>${r.storageBag?'负重 +'+D.STORAGE_BAGS.find(b=>b.id===r.storageBag).bonus:r.gear?'基础'+(r.gear==='weapon'?'攻击':'防御')+'+'+r.bonus:r.type}</small></div><div class="recipe-cost">${cost(r.cost)}</div><div class="recipe-bottom"><span>${r.room?D.BUILDINGS[r.room].name+' '+r.tier+'阶':r.home?'洞府炼制':'随身可制'}${wrong?' · '+wrong:r.storageBag?' · 本档永久生效，不叠加':r.gear?' · 品质随机':''}</span><button class="btn ${s.ok?'primary':''}" data-a="craft" data-id="${r.id}" ${done?'disabled':''}>${done?'已拥有':wrong?'缺设施':game.enough(r.cost)?'炼制':'缺材料'}</button></div>${hint?`<div class="recipe-hint">采集：${esc(hint)}</div>`:''}</div>`;}).join('');
}

/* ---------- 洞府 ---------- */
function campBody(){
 const c=game.camp,at=game.atCamp,why=game.canSettle(),possible=!why&&!at;
 const banner=c?`<div class="camp-summary"><div><strong>${esc(game.campName())}</strong><small>${c.pos.x+1}列 ${c.pos.y+1}行 · ${at?'身在洞府':'外出中'}</small></div>${!at?'<button class="btn primary" data-a="home">回府</button>':'<span class="camp-seal">府</span>'}</div>`:`<div class="camp-summary"><div><strong>尚未定居</strong><small>每境一座，选址后再营建</small></div><span class="camp-seal unbuilt">坪</span></div>`;
 let out=banner;
 if(!c||!at){out+=`<section class="site-planner"><div class="planner-heading"><b>${esc(game.name)}</b><span>${game.s.pos.x+1}, ${game.s.pos.y+1}</span></div><p>${esc(at?'已定居':why||'可定居 · 采集点和相邻资源保留')}</p><div class="recipe-cost">${cost(c?D.MOVE_CAMP_COST:D.SETTLE_COST)}</div><button id="settle-button" class="btn ${possible?'primary':''}" data-a="plan-settle" data-relocate="${c?1:0}">${c?'迁居至此':'在此筑庐'}</button>${c?'<small>搬移整座洞府；设施、仓物与灵田进度保留。</small>':'<small>筑庐后才有休整、仓房和生产设施。</small>'}</section>`;}
 if(!c){
  out+='<h3>已探明的候选地</h3>'+campCandidates().map(t=>`<div class="candidate-row"><div><b>${esc(t.name)}</b><small>${t.x+1}, ${t.y+1}${t.tip?' · '+t.tip:''}</small></div><button class="btn" data-a="map" data-x="${t.x}" data-y="${t.y}">前往</button></div>`).join('');
  return out+'<p class="muted">营坪、草坡、林地、石岗和花田可筑庐；水面、妖窟、奇遇和祭坛不可覆盖。</p>';
 }
 if(at){
  const forecast=game.restForecast('camp'),weak=forecast.factor===0;
  out+='<section class="trial-note"><strong>'+(weak?'饥渴虚弱 · 请先补给':'休息结算 · 根据时间恢复')+'</strong><p>洞府休息180分钟：预计气血'+(forecast.netHp>=0?'+':'')+forecast.netHp+'，灵力'+(forecast.netSpirit>=0?'+':'')+forecast.netSpirit+'；饱腹−'+forecast.hungerCost+'，饮水−'+forecast.waterCost+'。</p>'
   +'<p class="'+(weak?'danger-text':'muted')+'">'+(forecast.willCollapse?'该次休息预计会重伤折寿，建议先用餐补水。':weak?'无法从睡眠获得气血或灵力；零饱腹、零饮水会随时间持续扣血。请先在洞府用餐补水。':'饱腹与饮水低于35时恢复逐步减弱，低于或等于10时停止恢复。长时间睡眠也按真实时长计算。')+'</p></section>';
 }
 out+=`<div class="camp-training-entry"><div><strong>洞府静修</strong><small>吐纳、试剑、境界突破、功法与血脉修炼</small></div><button class="btn primary" data-a="panel" data-name="cultivate">进入修炼</button></div><div class="camp-shortcuts"><button class="btn" data-a="panel" data-name="warehouse">仓库</button><button class="btn" data-a="room" data-room="forge">炼器</button><button class="btn" data-a="room" data-room="alchemy">炼丹</button><button class="btn" data-a="panel" data-name="manuals">功法</button></div>`;
 const left=game.farmRemaining();
 out+=`<div class="farm-strip"><span>灵田 · ${left===null?'未建':game.farmBatches?'可收'+game.farmBatches+'轮':left>0?'余'+Math.ceil(left/60)+'小时':'待收获'}</span><button class="btn" data-a="farm" ${left===null?'disabled':''}>收获</button></div>`;
 const built=Object.keys(D.BUILDINGS).filter(id=>D.BUILDINGS[id].zone===undefined||D.BUILDINGS[id].zone===game.s.zone);
 const up=built.filter(id=>c.buildings?.[id]).length;
 out+=`<button type="button" class="cult-nav-row" data-a="panel-step" data-name="camp-build">`+
  `<span class="cult-nav-main"><b>洞府设施</b><small>炼器 · 炼丹 · 仓房 · 静室 · 灵田</small></span>`+
  `<span class="cult-nav-right">已建 ${up} / ${built.length}<i>›</i></span></button>`;
 return out;
}

function campBuildBody(){
 const c=game.camp;
 if(!c)return '<p class="muted">尚未定居，无法营建设施。</p>';
 const built=Object.keys(D.BUILDINGS).filter(id=>D.BUILDINGS[id].zone===undefined||D.BUILDINGS[id].zone===game.s.zone);
 const up=built.filter(id=>c.buildings?.[id]).length;
 return `<h3>洞府设施</h3><p class="muted">已建 ${up} / ${built.length}。设施决定可炼制的品阶与仓房容量。</p>`+
  `<div class="build-grid">${built.map(buildingCard).join('')}</div>`;
}
