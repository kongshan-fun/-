/* ===== V90.12 面板父子级扩展：炼制 =====
   炼制 8.48 屏 → 父页（品类入口）+ 子页（配方列表）。
   洞府不做子页：设施属于洞府本体，改在页内压缩密度。 */

let craftTier=null;

const CRAFT_CATS_HELP=[
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

function craftCounts(rows){const c={ok:0,mat:0,other:0};for(const r of rows){const s=craftStat(r);if(s.ok)c.ok++;else if(!s.wrong)c.mat++;else c.other++;}return c;}

function craftBody(){
 const all=craftRowsFor('all'),total=craftCounts(all);
 const rows=CRAFT_CATS_HELP.map(c=>{
  const list=craftRowsFor(c.key),st=craftCounts(list);
  return `<button type="button" class="cult-nav-row" data-a="panel-step" data-name="craft-cat" data-cat="${c.key}">`+
   `<span class="cult-nav-main"><b>${c.name}</b><small>${c.sub}</small></span>`+
   `<span class="cult-nav-right">${list.length?'可炼 '+st.ok+' / '+list.length:'暂无解锁'}<i>›</i></span></button>`;
 }).join('');
 return `<div class="craft-summary"><span class="craft-ok">可炼制 ${total.ok}</span><span>缺材料 ${total.mat}</span><span>未就绪 ${total.other}</span><span class="craft-total">共 ${all.length}</span></div>`+
  `<p class="muted">按类型进入；每个类型内按「可炼制 → 缺材料 → 未就绪」排序，采集指路保留。</p>`+
  `<nav class="cult-nav" aria-label="炼制品类">${rows}</nav>`;
}

function craftListBody(){
 const all=craftRowsFor(filter);
 const tiers=[...new Set(all.map(r=>Number(r.tier)||1))].sort((a,b)=>a-b);
 if(craftTier===null&&all.length>6&&tiers.length>1){
  const cat=CRAFT_CATS_HELP.find(c=>c.key===filter)||CRAFT_CATS_HELP[0];
  const rowsHtml=tiers.map(t=>{
   const list=all.filter(r=>(Number(r.tier)||1)===t),st=craftCounts(list);
   return `<button type="button" class="cult-nav-row" data-a="panel-step" data-name="craft-tier" data-tier="${t}">`+
    `<span class="cult-nav-main"><b>${t} 阶</b><small>${cat.name}</small></span>`+
    `<span class="cult-nav-right">可炼 ${st.ok} / ${list.length}<i>›</i></span></button>`;
  }).join('');
  return `<div class="craft-summary"><span class="craft-ok">可炼制 ${craftCounts(all).ok}</span><span>共 ${all.length}</span></div>`+
   `<p class="muted">按品阶进入；同一阶内按「可炼制 → 缺材料 → 未就绪」排序。</p>`+
   `<nav class="cult-nav" aria-label="品阶段">${rowsHtml}</nav>`;
 }
 const rows=craftTier===null?all:all.filter(r=>(Number(r.tier)||1)===craftTier),counts=craftCounts(rows);
 const bar=`<div class="craft-summary"><span class="craft-ok">可炼制 ${counts.ok}</span><span>缺材料 ${counts.mat}</span><span>未就绪 ${counts.other}</span><span class="craft-total">共 ${rows.length}</span></div>`;
 const sorted=[...rows].sort((a,b)=>{const ra=craftStat(a),rb=craftStat(b);const ka=ra.ok?0:ra.wrong?2:1,kb=rb.ok?0:rb.wrong?2:1;return ka-kb;});
 if(!sorted.length)return bar+'<p class="muted">该类当前没有解锁的配方，提升境界或解锁新境域后会出现在这里。</p>';
 return bar+sorted.map(r=>{const s=craftStat(r),done=s.done,wrong=s.wrong;
   const miss=Object.keys(r.cost).filter(k=>game.has(k)<(r.cost[k]||0));
   const src=miss.length?progMatSource(miss[0]):null;
   const hint=src?`${(D.ITEMS[miss[0]]&&D.ITEMS[miss[0]].name)||miss[0]} 见于 ${src.zoneName} · ${src.res.name}`:'';
   return `<div class="recipe${s.ok?' recipe-ready':''}" id="recipe-${r.id}"><div class="recipe-top"><b>${r.name}</b><small>${r.storageBag?'负重 +'+D.STORAGE_BAGS.find(b=>b.id===r.storageBag).bonus:r.gear?'基础'+(r.gear==='weapon'?'攻击':'防御')+'+'+r.bonus:r.type}</small></div><div class="recipe-cost">${cost(r.cost)}</div><div class="recipe-bottom"><span>${r.room?D.BUILDINGS[r.room].name+' '+r.tier+'阶':r.home?'洞府炼制':'随身可制'}${wrong?' · '+wrong:r.storageBag?' · 本档永久生效，不叠加':r.gear?' · 品质随机':''}</span><button class="btn ${s.ok?'primary':''}" data-a="craft" data-id="${r.id}" ${done?'disabled':''}>${done?'已拥有':wrong?'缺设施':game.enough(r.cost)?'炼制':'缺材料'}</button></div>${hint?`<div class="recipe-hint">采集：${esc(hint)}</div>`:''}</div>`;}).join('');
}

/* ---------- 洞府：设施就地展示，不做子页 ---------- */
function campBody(){
 const c=game.camp,at=game.atCamp,why=game.canSettle(),possible=!why&&!at;
 const banner=c?`<div class="camp-summary"><div><strong>${esc(game.campName())}</strong><small>${c.pos.x+1}列 ${c.pos.y+1}行 · ${at?'身在洞府':'外出中'}</small></div>${!at?'<button class="btn primary" data-a="home">回府</button>':'<span class="camp-seal">府</span>'}</div>`:`<div class="camp-summary"><div><strong>尚未定居</strong><small>每境一座，选址后再营建</small></div><span class="camp-seal unbuilt">坪</span></div>`;
 let out=banner;
 if(!c||!at){out+=`<section class="site-planner"><div class="planner-heading"><b>${esc(game.name)}</b><span>${game.s.pos.x+1}, ${game.s.pos.y+1}</span></div><p>${esc(at?'已定居':why||'可定居 · 采集点和相邻资源保留')}</p><div class="recipe-cost">${cost(c?D.MOVE_CAMP_COST:D.SETTLE_COST)}</div><button id="settle-button" class="btn ${possible?'primary':''}" data-a="plan-settle" data-relocate="${c?1:0}">${c?'迁居至此':'在此筑庐'}</button>${c?'<small>搬移整座洞府；设施、仓物与灵田进度保留。</small>':'<small>筑庐后才有休整、仓房和生产设施。</small>'}</section>`;}
 if(!c){
  out+='<h3>已探明的候选地</h3>'+campCandidates().map(t=>`<div class="candidate-row"><div><b>${esc(t.name)}</b><small>${t.x+1}, ${t.y+1}${t.tip?' · '+t.tip:''}</small></div><button class="btn" data-a="map" data-x="${t.x}" data-y="${t.y}">前往</button></div>`).join('');
  return out+'<p class="muted">营坪、草坡、林地、石岗和花田可筑庐；水面、妖窟、奇遇和祭坛不可覆盖。</p>';
 }
 /* 功能入口：一行五格，不再占两行 */
 out+=`<div class="camp-func-row">`+
  `<button class="btn primary" data-a="panel" data-name="cultivate">修炼</button>`+
  `<button class="btn" data-a="panel" data-name="warehouse">仓库</button>`+
  `<button class="btn" data-a="room" data-room="forge">炼器</button>`+
  `<button class="btn" data-a="room" data-room="alchemy">炼丹</button>`+
  `<button class="btn" data-a="panel" data-name="manuals">功法</button></div>`;
 const left=game.farmRemaining();
 out+=`<div class="farm-strip"><span>灵田 · ${left===null?'未建':game.farmBatches?'可收'+game.farmBatches+'轮':left>0?'余'+Math.ceil(left/60)+'小时':'待收获'}</span><button class="btn" data-a="farm" ${left===null?'disabled':''}>收获</button></div>`;
 /* 设施：洞府本体内容，就地展示 */
 const built=Object.keys(D.BUILDINGS).filter(id=>D.BUILDINGS[id].zone===undefined||D.BUILDINGS[id].zone===game.s.zone);
 const up=built.filter(id=>c.buildings?.[id]).length;
 out+=`<h3 class="camp-build-title">洞府设施 <small>已建 ${up} / ${built.length}</small></h3>`;
 out+=`<div class="build-grid">${built.map(buildingCard).join('')}</div>`;
 return out;
}
