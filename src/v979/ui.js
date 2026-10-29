/* V90.79 — presentation only. No replacement game engine, demo-only UI or save edits.
   Existing handlers, IDs, permissions and persisted game values remain authoritative. */
const polishPanels979=new Set(['camp','facility-forge','facility-alchemy','facility-workbench','facility-spirit','garden','home-manage','handcraft','cultivate','warehouse']);
const n979=n=>Number(n||0).toLocaleString('zh-CN');
const ratio979=(n,d)=>Math.max(0,Math.min(100,d?100*n/d:0));
const pbar979=panelMiniBar;
panelMiniBar=function(){
 if(!polishPanels979.has(panel))return pbar979();
 const s=game.s;
 const cell=(label,value,max,kind)=>`<span class="ui979-vital ${kind}"><small>${label}</small><b>${value}${max?'<em>/'+max+'</em>':''}</b>${max?'<i style="--fill:'+ratio979(value,max)+'%"></i>':''}</span>`;
 return `<div class="panel-mini-bar ui979-vitals" aria-label="当前角色状态">${cell('气血',s.hp,s.maxHp,'hp')}${cell(game.character.energy,s.spirit,s.maxSpirit,'spirit')}${cell('饱腹',s.hunger,0,'food')}${cell('饮水',s.water,0,'water')}${cell('寿元',game.lifeYears.toFixed(1)+'年',0,'life')}</div>`;
};
facilityCards978=function(){
 const i=game.gardenInfo(),grown=i.growing,ready=i.ready;
 const rows=[['warehouse','仓房','仓','物资与装备分存','warehouse'],['forge','炼器室','器','武器、防具与精炼','facility-forge'],['alchemy','丹房','丹','丹药、灵膳与灵饮','facility-alchemy'],['workbench','工作台','工','工具、器具与储物袋','facility-workbench'],['quiet','静室','静','吐纳、辟谷与休整','cultivate'],['farm','灵田','田',i.capacity?i.capacity+'块田 · '+(ready?ready+'块成熟':grown?grown+'块生长':'待播新种'):'种植草木，积蓄灵材','garden']];
 return rows.map(([id,name,glyph,hint,target])=>{
  const lv=game.roomLevel(id),auto=id==='workbench',status=auto?'常设':lv?lv+'/12阶':'未修建';
  const foot=auto?'随洞府启用':id==='warehouse'?'容量 '+n979(game.stashCapacity()):id==='farm'&&ready?'有成熟灵植':lv>=12?'设施已满阶':lv?'下一阶 '+(lv+1)+'阶':'建成后启用';
  return `<article class="facility978-card ui979-facility ${id==='farm'&&ready?'has-yield':''}" id="building-${id}"><button class="facility978-enter" data-a="facility-open" data-name="${target}" aria-label="进入${name}"><span class="ui979-facility-heading"><i class="ui979-seal" aria-hidden="true">${glyph}</i><strong>${name}</strong><small class="ui979-tier">${status}</small></span><p>${esc(lv||auto?hint:'尚未修建 · 可查看功能')}</p><em>进入${name}<span aria-hidden="true">↗</span></em></button><div class="facility978-foot"><small>${foot}</small>${auto?'<span class="ui979-auto">无需升级</span>':`<button data-a="facility-upgrade" data-id="${id}" aria-label="${lv>=12?'查看':lv?'升级':'修建'}${name}">${lv>=12?'查看':lv?'升级':'修建'}</button>`}</div></article>`;
 }).join('');
};
const homeBefore979=campBody;
campBody=function(){
 if(!game.camp)return homeBefore979();
 const c=game.camp,i=game.gardenInfo(),used=game.stashWeight(),cap=game.stashCapacity();
 return `<section class="home978 ui979-home"><div class="home978-top"><div><span class="ui979-eyebrow">本世洞府 · 全域共用</span><strong>${esc(D.HOME_NAMES[c.level-1])}<span class="ui979-tier">${c.level}/12阶</span></strong><small>归山修行，百业自成。</small></div><button class="btn ui979-explore" data-a="home-exit">返回探索 <span aria-hidden="true">↗</span></button></div><nav class="home978-nav" aria-label="洞府常用功能"><button data-a="panel" data-name="cultivate">修炼</button><button data-a="panel" data-name="warehouse">仓房</button><button data-a="facility-open" data-name="facility-forge">炼器</button><button data-a="facility-open" data-name="facility-alchemy">丹房</button><button data-a="facility-open" data-name="facility-spirit">赋灵</button></nav><div class="ui979-section-label"><span>府中百业</span><small>点击建筑进入 · 营建独立确认</small></div><div class="home978-grid">${facilityCards978()}</div><div class="ui979-home-summary"><div><span>仓房占用</span><b>${n979(used)} <small>/ ${n979(cap)}</small></b><i style="--fill:${ratio979(used,cap)}%"></i></div><div><span>灵田近况</span><b>${i.ready?i.ready+'块待收':i.growing?i.growing+'块生长':i.capacity?i.empty+'块空闲':'尚未开垦'}</b><small>${i.capacity?'成熟不枯萎 · 满仓留田':'一阶可开四块田'}</small></div></div><div class="home978-bottom"><span>当前可开放至 <b>${game.maxHomeTier}</b> 阶</span><button class="btn" data-a="facility-open" data-name="home-manage">洞府营建 <span aria-hidden="true">›</span></button></div>${!game.s.ritual[0]&&game.s.zone===0?'<button class="btn home978-ritual" data-a="repair">准备青岚护山阵 · 地图仪式</button>':''}</section>`;
};
function materials979(costs){
 return `<div class="ui979-materials" aria-label="配方材料">${Object.entries(costs).map(([id,need])=>{const have=game.has(id),ok=have>=need;return `<div class="ui979-material ${ok?'is-enough':'is-missing'}"><span>${esc(D.ITEMS[id].name)}</span><b>${n979(have)} <small>/ ${n979(need)}</small></b><i style="--fill:${ratio979(have,need)}%"></i><em>${ok?'已备齐':'缺 '+n979(need-have)}</em></div>`;}).join('')}</div>`;
}
recipeCard978=function(r){
 const st=craftStat(r),bag=r.storageBag?D.STORAGE_BAGS.find(b=>b.id===r.storageBag):null;
 const glyph=bag?'袋':r.gear?(r.gear==='weapon'?'攻':'御'):r.station==='alchemy'?'丹':'工';
 const effect=r.item?D.ITEMS[r.item].effect||'':bag?'永久扩容 · 多袋只取最大容量':r.gear?(r.gear==='weapon'?'攻击':'防御')+'基础 +'+r.bonus:'探索器具';
 const constraint=st.wrong||(r.portable?'基础工具 · 可随身制作':r.station==='workbench'?'工作台无需升级':D.STATIONS[r.station]+' '+r.tier+'阶');
 return `<article class="recipe ui979-recipe ${st.ok?'recipe-ready':''}" id="recipe-${r.id}" data-station="${r.station}"><div class="recipe-top"><span class="ui979-recipe-title"><i class="ui979-seal" aria-hidden="true">${glyph}</i><b>${esc(r.name)}</b></span><small class="ui979-tier">${r.mapTier||1}阶</small></div><p class="micro ui979-effect">${esc(effect)}</p>${bag?`<div class="ui979-bag-value"><div><small>本袋扩容</small><strong>+${bag.bonus}</strong><span>随身负重</span></div><div><small>当前随身上限</small><b>${game.capacity}</b><span>不增加器囊格数</span></div></div>`:''}<div class="ui979-section-label"><span>所需材料</span><small>随身与仓房按原规则取用</small></div><div class="recipe-cost">${materials979(r.cost)}</div><div class="recipe-bottom"><span>${esc(constraint)}</span><button class="btn ${st.ok?'primary':''}" data-a="craft" data-id="${r.id}" ${st.done?'disabled':''}>${st.done?'已拥有':st.ok?r.station==='workbench'?'制作':'炼制':st.wrong?'查看条件':'缺少材料'}</button></div></article>`;
};
const stationBefore979=stationBody978;
stationBody978=function(){
 const content=stationBefore979();
 if(['home-manage','facility-spirit'].includes(panel))return content;
 const station=panel==='facility-forge'?'forge':panel==='facility-alchemy'?'alchemy':'workbench',rows=facilityRows978(),ready=rows.filter(r=>craftStat(r).ok).length;
 const badge=panel==='handcraft'?'行囊手作':station==='workbench'?'随府启用 · 无等级':D.STATIONS[station]+' '+game.roomLevel(station)+'阶';
 const label=station==='forge'?'淬炼锋芒，器成随身。':station==='alchemy'?'采百草灵机，养一身气息。':'一方工作台，备山野行装。';
 return `<section class="ui979-station"><div class="ui979-station-intro"><p>${label}</p><span>${badge}</span></div>${content}<footer class="ui979-station-foot"><span>当前分类 ${rows.length} 项配方</span><b>可制作 ${ready} 项</b></footer></section>`;
};
// Large viewports show all 26 plots. Compact screens retain 12-slot paging.
// Pagination is UI state only; every crop keeps its original global plot index.
function gardenPageSize979(){const h=Math.min(window.innerHeight,window.innerWidth>520?880:window.innerHeight);return h>=780?28:12;}
const gardenBefore979=gardenBody978;
gardenBody978=function(){
 const info=game.gardenInfo(),cap=info.capacity;if(!cap)return gardenBefore979();
 const size=gardenPageSize979(),pages=Math.ceil(cap/size);gardenPage978=Math.min(gardenPage978,pages-1);
 const plots=info.plots.slice(gardenPage978*size,gardenPage978*size+size);
 const seeds=Object.values(D.CROPS).filter(c=>game.has(c.id)>0);
 const grid=plots.map(p=>{const pct=p.state==='empty'?0:ratio979(game.s.minutes-p.plantedAt,p.readyAt-p.plantedAt);return `<button class="garden978-plot ${p.state}" data-a="garden-plot" data-index="${p.index}" aria-label="田地${p.index+1} ${esc(p.name||'空地')} ${p.state==='ready'?'成熟':p.state==='growing'?'生长中':'可播种'}"><small>${String(p.index+1).padStart(2,'0')}</small><b>${esc(p.name||'空田')}</b><span>${p.state==='ready'?'成熟 · 可收':p.state==='empty'?'＋ 播种':p.left>=60?Math.ceil(p.left/60)+'时后成熟':p.left+'分钟后成熟'}</span><i class="ui979-crop-progress" aria-hidden="true" style="--fill:${pct}%"></i></button>`;}).join('');
 return `<section class="garden978 ui979-garden ${size>12?'show-all':''}" data-page-size="${size}"><div class="garden978-summary"><div><span class="ui979-eyebrow">洞府灵植 · 第${game.day}日</span><strong>${cap} 块灵田 <small class="ui979-tier">${game.roomLevel('farm')}阶</small></strong></div><button class="ui979-text-btn" data-a="garden-rules">种植说明 ›</button></div><div class="ui979-garden-counts"><span><i class="empty"></i>空闲 <b>${info.empty}</b></span><span><i class="growing"></i>生长 <b>${info.growing}</b></span><span><i class="ready"></i>成熟 <b>${info.ready}</b></span></div><div class="garden978-grid">${grid}</div>${pages>1?`<div class="garden978-pager"><button data-a="garden-page" data-delta="-1" ${gardenPage978===0?'disabled':''}>上一片</button><span>${gardenPage978+1} / ${pages} · 共${cap}块</span><button data-a="garden-page" data-delta="1" ${gardenPage978===pages-1?'disabled':''}>下一片</button></div>`:`<div class="ui979-garden-caption"><span>全部 ${cap} 块田已展示</span><span>可用种子 ${seeds.length} 种</span></div>`}<div class="garden978-actions"><button class="btn" data-a="garden-batch" ${!info.empty?'disabled':''}>空田批种</button><button class="btn primary" data-a="garden-collect" ${!info.ready?'disabled':''}>收获成熟 ${info.ready}</button><button class="btn" data-a="garden-rules">种植说明</button></div>${info.legacy?'<button class="btn garden978-legacy" data-a="garden-claim">领取旧灵田保留产出</button>':info.legacyAt!==null?'<p class="micro">旧田最后一轮 '+Math.max(0,Math.ceil((info.legacyAt-game.s.minutes)/60))+'游戏小时后可领，不再续产。</p>':''}<p class="garden978-note">按游戏时间成长 · 成熟不枯萎 · 满仓收成留田</p></section>`;
};
const handlerBefore979=handle;
handle=function(a,b){
 if(a==='garden-page'&&panel==='garden'&&!frontPage&&!modal&&activeRole){gardenPage978=Math.max(0,Math.min(Math.ceil(game.gardenCapacity()/gardenPageSize979())-1,gardenPage978+Number(b.dataset.delta)));renderPanel();return;}
 return handlerBefore979(a,b);
};
const panelBefore979=renderPanel;
renderPanel=function(){
 panelBefore979();
 const enabled=polishPanels979.has(panel),root=$('panel-root');root.dataset.ui979=String(enabled);$('phone').classList.toggle('ui979-active',enabled);
 const overlay=root.querySelector('.panel-overlay');if(overlay)overlay.dataset.page=panel||'';
};
let lastGardenPageSize979=0;
window.addEventListener('resize',()=>{if(panel==='garden'){const size=gardenPageSize979();if(size!==lastGardenPageSize979){lastGardenPageSize979=size;renderPanel();}}},{passive:true});
