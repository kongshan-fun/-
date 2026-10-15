/* Responsive phone UI, overlay-only feedback and state-driven onboarding. */
(function(){
'use strict';
const D=QData,$=id=>document.getElementById(id),esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let game,saveStatus='未保存',bootMessage='',saveAvailable=true,deathBoot=false,panel=null,travelOpen=false,mapOpen=false,modal=null,route=[],timer=null,toastTimer=null,guideRAF=null,focusBeforeModal=null,guideSignature='',importCandidate=null;
let mapFocus=null;
let filter='all',search='',panelScroll={},openEntries=new Set(),helpOpen=new Set(['start']);
const oldRaw=()=>{for(const k of D.LEGACY){const raw=localStorage.getItem(k);if(raw)try{return {key:k,state:JSON.parse(raw)};}catch{} }return null;};
function clearAllSaves(){
 try{for(const key of [D.SAVE,D.SAVE+'-backup',...D.LEGACY])localStorage.removeItem(key);
  localStorage.setItem(D.DEATH_KEY,JSON.stringify({endedAt:new Date().toISOString(),reason:'寿元归零'}));
  saveStatus='寿元已尽 · 角色进度已清除';return true;
 }catch{saveStatus='存储受限 · 无法保证删档';return false;}
}
function load(){
 try{
  if(localStorage.getItem(D.DEATH_KEY)){deathBoot=true;game=new QGame();saveStatus='寿元已尽 · 等待重新轮回';return;}
  const raw=localStorage.getItem(D.SAVE);
  if(raw){try{game=new QGame(JSON.parse(raw));saveStatus='已载入';return;}catch{bootMessage='当前存档损坏，正在尝试备份。';}}
  const backup=localStorage.getItem(D.SAVE+'-backup');
  if(raw&&backup){try{game=new QGame(JSON.parse(backup));saveStatus='已恢复备份';bootMessage='已从上次备份恢复。';return;}catch{}}
  const prior=oldRaw();if(prior){try{game=new QGame(prior.state);bootMessage='已复制继承旧版进度，原存档仍保留。';saveStatus='旧版已迁移';return;}catch{bootMessage='旧存档无法识别，原文件未改动。';}}
 }catch{saveAvailable=false;saveStatus='本地存储被阻止';bootMessage='浏览器不允许本地保存，请用设置导出进度。';}
 game=new QGame();
}
function persist(){
 if(game.s.ended){clearAllSaves();return;}
 if(deathBoot)return;
 try{
  const value=JSON.stringify(game.s),prior=localStorage.getItem(D.SAVE);
  if(prior&&prior!==value){try{QGame.normalize(JSON.parse(prior));localStorage.setItem(D.SAVE+'-backup',prior);}catch{}}
  localStorage.setItem(D.SAVE,value);saveAvailable=true;saveStatus='自动保存成功';
 }catch{const first=saveAvailable;saveAvailable=false;saveStatus='未能落盘 · 请导出';if(first)notify('本地存储失败，请到设置导出进度','warn');}
}
function notify(message,tone='info'){
 clearTimeout(toastTimer);const tool=message.includes('缺少')&&(/木斧|石镐|钓竿/.test(message));const room=/需.*(炼器室|丹房|洞府)|先.*(筑庐|仓房|洞府)/.test(message);
 $('toast').className='toast show'+(tone==='warn'?' warn':'');
 $('toast').innerHTML=`<span>${esc(message)}</span>${tool?'<button class="toast-link" data-a="panel" data-name="craft">炼制</button>':room?'<button class="toast-link" data-a="panel" data-name="camp">洞府</button>':''}`;
 toastTimer=setTimeout(()=>$('toast').classList.remove('show'),tone==='warn'?3500:2200);
}
function stop(){if(timer!==null)clearTimeout(timer);timer=null;route=[];}
function flush(result){
 const effects=game.effects.slice();game.effects=[];
 if(game.s.ended){stop();panel=null;travelOpen=false;mapOpen=false;persist();render();showModal({kind:'permadeath'});return result;}
 if(effects.some(e=>e.kind==='victory'))showModal({kind:'victory'});
 const show=effects.find(e=>['unlock','guide-complete'].includes(e.kind))||effects.at(-1);
 if(show)notify(show.msg,show.tone);
 persist();render();return result;
}
function run(name,args={}){const result=game.act(name,args);return flush(result);}
function bar(k,label,value,max){const pct=Math.max(0,Math.min(100,value/max*100));return `<div class="bar"><div class="bar-label"><span>${label}</span><b>${value}/${max}</b></div><div class="track"><div class="fill ${k} ${pct<=20?'low':''}" style="width:${pct}%"></div></div></div>`;}
function renderStatus(){const s=game.s;$('status').innerHTML=`<div class="status-line"><b>${game.realm}<span class="xp">修 ${s.xp}/${game.required}</span></b><span class="life-label" title="寿元归零将清除存档">寿 ${game.lifeYears.toFixed(1)}年 · ${game.day}日 ${game.clock}</span></div><div class="bars">${bar('hp','气血',s.hp,s.maxHp)}${bar('spirit','灵力',s.spirit,s.maxSpirit)}${bar('hunger','饱腹',s.hunger,100)}${bar('water','饮水',s.water,100)}</div>`;
 $('zone-label').textContent=game.zone.name;
 const short={wood:'木',stone:'石',rune:'纹',dew:'露',blossom:'花',herb:'药',copper:'铜',cinder:'火',ore:'矿',moss:'苔',soul:'魂',star:'星',thunder:'雷'};
 const text=s.cleared[s.zone]?(s.zone===4?'五境通关 · 可继续历练':'已开 '+D.ZONES[s.zone+1].name):s.ritual[s.zone]?'前往「'+game.zone.bossMark+'」挑战首领':Object.entries(game.zone.need).map(([id,n])=>(short[id]||D.ITEMS[id].name)+' '+game.has(id)+'/'+n).join('　');
 $('quest').dataset.name=game.camp?'quest':'camp';
 if(!game.camp){$('quest').innerHTML='<b>定居</b><span>寻找营地 · 择地筑庐</span><em>›</em>';}else $('quest').innerHTML=`<b>${s.cleared[s.zone]?'已平定':game.zone.verb}</b><span>${esc(text)}</span><em>${s.zone+1}/5 ›</em>`;
 $('berry-count').textContent=s.inv.berry||0;$('water-count').textContent=s.inv.water||0;$('salve-count').textContent=s.inv.salve||0;$('rest-button').textContent=game.workshop?'休息':'调息';$('home-button').textContent=game.camp?'回府':'定居';
 document.querySelectorAll('.quick-nav [data-name]').forEach(b=>b.classList.toggle('active',b.dataset.name===panel));
}
function resourceStyle(k){return ['copper','cinder'].includes(k)?'fire':['dew','blossom','spring','fish','waterherb'].includes(k)?'aqua':['soul','moss','venom'].includes(k)?'yin':['star','thunder','ancient'].includes(k)?'star':['stone','ore','spiritStone','rune'].includes(k)?'mineral':'';}
function locationActions(){const l=game.land(),s=game.s,hasGround=Object.values(game.ground).some(n=>n>0);
 const pickup=hasGround?'<button data-a="pickup">拾遗</button>':'';
 if(game.atCamp)return `<button data-a="panel" data-name="camp" class="important">洞府</button>${hasGround?pickup:'<button data-a="rest" data-mode="camp">休息</button>'}`;
 if(l==='shrine')return `<button data-a="rest" data-mode="field">调息</button><button class="important" data-a="repair">${s.ritual[s.zone]?'已完成':game.zone.verb}</button>`;
 if(l==='boss')return `<button data-a="rest" data-mode="field">调息</button><button class="important" data-a="hunt">${s.cleared[s.zone]?'再战':'挑战'}</button>`;
 if(l==='gate')return `<button data-a="rest" data-mode="field">调息</button><button data-a="zone" data-zone="${s.zone===4?0:s.zone+1}" class="important">${s.zone===4?'归途':'下一境'}</button>`;
 if(game.site)return '<button data-a="site" class="important">探查</button>'+(pickup||'<button data-a="rest" data-mode="field">调息</button>');
 if(l==='bazaar')return '<button data-a="barter">交易</button>'+(pickup||'<button data-a="rest" data-mode="field">调息</button>');
 if(!game.canSettle())return '<button data-a="panel" data-name="camp">'+(game.camp?'选址':'筑庐')+'</button>'+(pickup||'<button data-a="scout">勘察</button>');
 return '<button data-a="scout">勘察</button>'+(pickup||'<button data-a="rest" data-mode="field">调息</button>');
}
function renderScene(){
 const old=$('scene-content').scrollTop;
 if(game.s.combat){$('scene-content').innerHTML=renderCombat();$('scene-content').scrollTop=old;return;}
 const t=game.atCamp?{...D.LAND[game.land()],risk:'安全'}:D.LAND[game.land()],s=game.s;
 const resources=(D.RESOURCE_LAYOUT[game.land()]||Array(10).fill(null)).map((k,i)=>{
  if(i===7)return '<div class="resource empty" aria-hidden="true">·</div>';
  if(!k)return '<div class="resource empty" aria-hidden="true">·</div>';
  const r=D.RES[k],left=game.left(i),why=game.requirement(k),label=left?`剩余${left}次`:'已采完';
  const tag=r.tool&&!s.inv[r.tool]?({axe:'斧',pick:'镐',rod:'竿'}[r.tool]):r.level&&s.level<r.level?r.level+'层':'';
  return `<button class="resource ${resourceStyle(k)} ${left?'':'exhausted'}" data-a="gather" data-index="${i}" aria-label="${esc(r.name+'，'+label+(why?'，'+why:''))}" title="${esc(r.name+(why?' · '+why:''))}"><b>${r.mark}</b><small>${left?'×'+left:'—'}</small>${left&&tag?'<i>'+tag+'</i>':''}</button>`;
 }).join('');
 $('scene-content').innerHTML=`<article class="scene-card"><div class="location-head"><h1>${esc(game.name)}</h1><span class="risk ${t.risk==='高'||t.risk==='极高'?'danger':''}">${t.risk==='安全'?'安全':t.risk+'危'}</span></div><div class="location-tools"><span>斧${s.inv.axe?'✓':'—'}　镐${s.inv.pick?'✓':'—'}${s.inv.rod?'　竿✓':''}</span><div class="location-actions">${locationActions()}</div></div><div class="resources" id="resources" role="group" aria-label="点击资源采集">${resources}</div></article>`;
 $('scene-content').scrollTop=old;
}
function renderCombat(){const b=game.s.combat,s=game.s,e=D.ENEMIES[b.type],hint=b.intent==='heavy'?'重击将至 · 宜防守':b.intent==='recover'?'敌人调息 · 可进攻':'普通攻击';
 return `<article class="combat-card"><div class="combat-title"><h2>${esc(e.name)}</h2><small>${b.training?'练习 · ':b.repeat?'再战 · ':''}${b.turn}回合</small></div><div class="enemy-hp">气血 ${b.hp}/${b.maxHp}<div class="enemy-track"><div style="width:${b.hp/b.maxHp*100}%"></div></div></div><div class="intent">${hint}</div><div class="fight-log" title="${esc(s.logs[0]?.msg)}">${esc(s.logs[0]?.msg||'')}</div><div class="combat-actions">
 <button data-a="fight" data-mode="attack">剑击<small>基础 ${s.attack+game.weapon}</small></button><button class="spell" data-a="fight" data-mode="spell">剑诀<small>灵力 −9</small></button><button data-a="fight" data-mode="guard">防守<small>减伤 · 蓄势</small></button>
 <button data-a="fight" data-mode="heal">回春散<small>${b.training?'练习药'+b.virtualHeals:'余'+(s.inv.salve||0)}</small></button><button data-a="fight" data-mode="mana">回灵丹<small>${b.training?'练习用':'余'+(s.inv.mana||0)}</small></button><button data-a="fight" data-mode="escape" ${b.type.startsWith('boss')?'disabled':''}>${b.training?'结束':'撤离'}<small>${b.type.startsWith('boss')?'不可撤离':b.training?'恢复原状态':'成功率80%'}</small></button></div></article>`;
}
function tileClass(l){return ['forest','plain'].includes(l)?'':['spring','pond','flowerfield'].includes(l)?'water':['mine','ridge','crag','volcano'].includes(l)?'rock':['marsh','tomb'].includes(l)?'yin':['astral','spire'].includes(l)?'star':['sect','camp','shrine','gate','bazaar'].includes(l)?'landmark':l==='boss'?'boss':'';}
function mapTile(x,y,small=false){
 const s=game.s,valid=x>=0&&x<8&&y>=0&&y<8;
 if(!valid)return '<button class="tile boundary" disabled aria-label="地图边界，不可通行">·</button>';
 const key=game.key(x,y),seen=!!s.seen[key],l=game.land(x,y),site=D.SITES[key],current=s.pos.x===x&&s.pos.y===y;
 const home=game.isCampTile(x,y),ground=Object.values(game.s.caches[key]||{}).some(v=>v>0);
 const mark=home?'府':ground?'拾':l==='boss'?game.zone.bossMark:site?.mark||D.LAND[l].mark;
 const name=seen?(home?game.campName():site?.name||D.NAMED[key]?.[0]||D.LAND[l].name):'未知地点';
 const locked=(l==='boss'&&!s.ritual[s.zone])||(l==='gate'&&!s.cleared[s.zone]);
 return `<button class="tile ${seen?'seen':'fog'} ${s.visited[key]?'visited':''} ${seen&&(home||site||['campsite','shrine','boss','gate'].includes(l))?'landmark':''} ${route.some(r=>r.x===x&&r.y===y)?'route':''} ${current?'current':''} ${seen&&locked?'locked':''}" data-a="${small?'mini-step':'map'}" data-x="${x}" data-y="${y}" ${current?'disabled aria-current="location"':''} title="${esc(name+(locked&&seen?' · 未解锁':''))}" aria-label="${esc(name)}，${x+1}列${y+1}行${current?'，当前位置':locked&&seen?'，未解锁':''}">${current?'我':seen?mark:'?'}</button>`;
}
function renderMap(){
 const s=game.s;let h='';for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)h+=mapTile(s.pos.x+dx,s.pos.y+dy,true);
 $('map').innerHTML=h;$('map-caption').textContent=route.length?'余 '+route.length+' 步':`${s.pos.x+1}, ${s.pos.y+1}`;
 $('stop-button').disabled=!route.length;$('map').setAttribute('aria-busy',String(!!route.length));
 const n=Object.keys(s.seen).filter(k=>k.startsWith(s.zone+':')).length;
 $('world-zone').textContent=game.zone.name;$('world-caption').textContent=`已探 ${n}/64 · 所在 ${s.pos.x+1}列${s.pos.y+1}行`;
 $('map-overlay').hidden=!mapOpen;$('expand-map').setAttribute('aria-expanded',String(mapOpen));
 if(mapOpen){let all='';for(let y=0;y<8;y++)for(let x=0;x<8;x++)all+=mapTile(x,y);$('world-map').innerHTML=all;}
 else $('world-map').innerHTML='';
 syncLayers();
}
function renderPeek(){
 const s=game.s,ids=[['wood','stone','fiber','ore','herb','rune','hide','dust'],['blossom','dew','fiber','stone','wood','ore','herb','dust'],['copper','cinder','ore','stone','wood','fiber','hide','dust'],['moss','soul','herb','fiber','wood','stone','hide','dust'],['star','thunder','rune','stone','ore','fiber','hide','dust']][s.zone];
 const names={wood:'灵木',stone:'灵石',fiber:'青藤',ore:'玄铁',herb:'药草',rune:'阵纹',hide:'兽皮',dust:'灵尘',blossom:'碧花',dew:'灵露',copper:'赤铜',cinder:'焰砂',moss:'阴苔',soul:'幽砂',star:'星髓',thunder:'雷髓'};
 $('weight-caption').textContent=`负重 ${game.weight}/${game.capacity}`;
 $('peek-grid').innerHTML=ids.map(id=>`<button class="peek-item ${s.inv[id]?'':'absent'}" data-a="peek" data-id="${id}" aria-label="${D.ITEMS[id].name}，随身${s.inv[id]||0}个，查看物品"><span>${names[id]}</span><b>${s.inv[id]||0}</b></button>`).join('');
}
function syncLayers(){
 $('game-shell').inert=!!modal||mapOpen; $('panel-root').inert=!!modal||mapOpen;
 $('scene-content').inert=!!panel;$('inventory-peek').inert=!!panel;
 $('guide-root').hidden=!!modal||mapOpen;
}
function setMap(open){
 if(open&&game.s.combat){notify('斗法中不能移动','warn');return;}
 if(open){stop();panel=null;travelOpen=false;mapFocus=document.activeElement;}
 mapOpen=open;render();if(open)$('collapse-map').focus({preventScroll:true});else mapFocus?.focus?.({preventScroll:true});
}
function stepTo(x,y){
 if(game.s.combat){notify('斗法中不能移动','warn');return;}
 stop();travelOpen=false;mapOpen=false;panel=null;
 if(Math.max(Math.abs(x-game.s.pos.x),Math.abs(y-game.s.pos.y))!==1){render();return;}
 run('move',{x,y});
}
function renderTravel(){
 const menu=$('travel-menu');$('travel-toggle').setAttribute('aria-expanded',String(travelOpen));menu.hidden=!travelOpen;if(!travelOpen)return;
 const ph=$('phone').getBoundingClientRect(),anchor=$('travel-toggle').getBoundingClientRect();
 menu.style.top='auto';menu.style.bottom=(ph.bottom-anchor.top+5)+'px';menu.style.maxHeight=Math.max(140,anchor.top-ph.top-12)+'px';
 menu.innerHTML=D.ZONES.map((z,i)=>{const locked=i>=game.s.unlocked,current=i===game.s.zone;return `<button class="travel-option ${locked?'locked':''} ${current?'current':''}" data-a="zone" data-zone="${i}" aria-disabled="${locked}"><span><strong>${z.name}</strong><small>${locked?'先击败'+D.ENEMIES[D.ZONES[i-1].boss].name:current?'当前区域':game.s.cleared[i]?'已平定 · 可再访':(game.s.settlements[i]?'已有洞府':'未建洞府 · 抵达旧营坪')}</small></span><span>${locked?'未开':current?'所在':'前往'}</span></button>`;}).join('');
}
function cost(cost){return Object.entries(cost).map(([k,n])=>`<span class="${game.has(k)<n?'missing':''}">${D.ITEMS[k].name} ${game.has(k)}/${n}</span>`).join(' · ');}
function craftBody(){const rows=D.RECIPES.filter(r=>(r.zone||0)<game.s.unlocked).filter(r=>filter==='all'||(filter==='tool'?r.type==='工具':filter==='gear'?!!(r.gear||r.flag):r.type==='丹药'||r.type==='食物'));
 return rows.map(r=>{const done=(r.unique&&game.has(r.item))||(r.flag&&game.s.flags[r.flag]),wrong=game.recipeRequirement(r);return `<div class="recipe" id="recipe-${r.id}"><div class="recipe-top"><b>${r.name}</b><small>${r.gear?'基础'+(r.gear==='weapon'?'攻击':'防御')+'+'+r.bonus:r.type}</small></div><div class="recipe-cost">${cost(r.cost)}</div><div class="recipe-bottom"><span>${r.room?D.BUILDINGS[r.room].name+' '+r.tier+'阶':'随身可制'}${wrong?' · 未就绪':r.gear?' · 品质随机':''}</span><button class="btn ${!done&&!wrong&&game.enough(r.cost)?'primary':''}" data-a="craft" data-id="${r.id}" ${done?'disabled':''}>${done?'已拥有':wrong?'缺设施':game.enough(r.cost)?'炼制':'缺材料'}</button></div></div>`;}).join('');}
function gearCard(g,pending=false){const r=game.recipe(g.recipe),on=game.s.equipped[r.gear]===g.id;return `<div class="gear-card" data-gear="${g.id}"><div class="gear-head"><b class="rarity-${g.quality}">${D.QUALITIES[g.quality].name}·${r.name}${g.refine?' +'+g.refine:''}</b><small>${on?'已穿戴':pending?'待领取':r.gear==='weapon'?'武器':'防具'}</small></div><div class="gear-attrs">${r.gear==='weapon'?'攻击':'防御'} +${game.gearBonus(g)}${g.affixes.map(a=>' · '+D.AFFIXES[a.id].name+'+'+a.value+D.AFFIXES[a.id].unit).join('')}</div><div class="inline-buttons">${pending?`<button class="btn primary" data-a="claim-gear" data-id="${g.id}">原地拾取</button>`:`<button class="btn" data-a="equip" data-id="${g.id}" ${on?'disabled':''}>${on?'已穿戴':'穿戴'}</button><button class="btn" data-a="refine" data-id="${g.id}" ${g.refine>=3?'disabled':''}>${g.refine>=3?'精炼已满':'精炼 · 灵尘'+((g.refine+1)*4)}</button><button class="btn" data-a="salvage" data-id="${g.id}" ${on?'disabled':''}>分解</button>`}</div></div>`;}
function packBody(){const s=game.s,ids=Object.keys(D.ITEMS).filter(k=>s.inv[k]>0);return `<div class="stat-chips"><span>负重 ${game.weight}/${game.capacity}</span><span>器囊 ${s.gears.length}/36</span><span>灵尘 ${game.has('dust')}</span></div><div class="inline-buttons"><button class="btn" data-a="panel" data-name="warehouse">本境仓库</button><button class="btn" data-a="store" ${!game.storageReady?'disabled':''}>材料入仓</button><button class="btn" data-a="panel" data-name="log">行记</button></div><h3>随身物品</h3>${ids.map(id=>{const it=D.ITEMS[id];return `<div class="item-row"><span class="item-name">${it.name} <small>×${s.inv[id]}</small></span>${it.type==='food'?`<button class="btn" data-a="consume" data-id="${id}">使用</button>`:it.type==='material'?`<button class="btn" data-a="discard" data-id="${id}">丢1</button>`:''}${game.storageReady?`<button class="btn" data-a="store" data-id="${id}">存仓</button>`:''}</div>`;}).join('')||'<p class="empty">行囊为空</p>'}${groundRows()}<h3>法器</h3>${s.gears.map(g=>gearCard(g)).join('')||'<p class="empty">尚未获得法器</p>'}${s.pending.length?'<h3>遗落法器 · 回发现处拾取</h3>'+s.pending.map(g=>`<p class="micro">发现于 ${esc(g.where)}</p>`+gearCard(g,true)).join(''):''}`;}
function campCandidates(){
 const list=[];for(let y=0;y<8;y++)for(let x=0;x<8;x++){
  const k=game.key(x,y),l=game.land(x,y);
  if(!game.s.seen[k]||!D.CAMP_LANDS.includes(l)||D.SITES[k]||D.EVENTS[k]||game.isCampTile(x,y))continue;
  const near=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(dx||dy)near.push(game.land(x+dx,y+dy));
  list.push({x,y,dist:Math.max(Math.abs(x-game.s.pos.x),Math.abs(y-game.s.pos.y)),name:D.NAMED[k]?.[0]||D.LAND[l].name,tip:[near.some(k=>['spring','pond'].includes(k))?'近水':'',near.includes('forest')?'近林':'',near.some(k=>['mine','ridge'].includes(k))?'近矿':''].filter(Boolean).join(' · ')});
 }
 return list.sort((a,b)=>a.dist-b.dist||a.y-b.y).slice(0,4);
}
function buildingCard(id){
 const def=D.BUILDINGS[id],level=game.roomLevel(id),next=def.levels[level],why=game.buildReason(id);
 const costText=next?cost(next.cost):'本版已满阶';
 const status=level?level+' / '+def.levels.length+' 阶':'未建';
 return `<article class="building-card" id="building-${id}"><div class="building-heading"><b class="building-mark">${def.mark}</b><div><strong>${def.name}</strong><small>${status}</small></div></div><p class="building-effect">${esc(next?(level?'升级后：':'建成：')+next.effect:def.levels.at(-1).effect)}</p><div class="building-cost">${costText}</div><div class="building-footer"><span>${next?.home&&game.camp?.level<next.home?'需洞府'+next.home+'阶':next?next.minutes+'分钟':'已建成'}</span><button class="btn ${!why?'primary':''}" data-a="build" data-id="${id}" ${!next?'disabled':''}>${next?level?'升级':'修建':'满阶'}</button></div></article>`;
}
function campBody(){
 const c=game.camp,at=game.atCamp,why=game.canSettle(),possible=!why&&!at;
 const banner=c?`<div class="camp-summary"><div><strong>${esc(game.campName())}</strong><small>${c.pos.x+1}列 ${c.pos.y+1}行 · ${at?'身在洞府':'外出中'}</small></div>${!at?'<button class="btn primary" data-a="home">回府</button>':'<span class="camp-seal">府</span>'}</div>`:`<div class="camp-summary"><div><strong>尚未定居</strong><small>每境一座，选址后再营建</small></div><span class="camp-seal unbuilt">坪</span></div>`;
 let out=banner;
 if(!c||!at){out+=`<section class="site-planner"><div class="planner-heading"><b>${esc(game.name)}</b><span>${game.s.pos.x+1}, ${game.s.pos.y+1}</span></div><p>${esc(at?'已定居':why||'可定居 · 采集点和相邻资源保留')}</p><div class="recipe-cost">${cost(c?D.MOVE_CAMP_COST:D.SETTLE_COST)}</div><button id="settle-button" class="btn ${possible?'primary':''}" data-a="plan-settle" data-relocate="${c?1:0}">${c?'迁居至此':'在此筑庐'}</button>${c?'<small>搬移整座洞府；设施、仓物与灵田进度保留。</small>':'<small>筑庐后才有休整、仓房和生产设施。</small>'}</section>`;}
 if(!c){
  out+='<h3>已探明的候选地</h3>'+campCandidates().map(t=>`<div class="candidate-row"><div><b>${esc(t.name)}</b><small>${t.x+1}, ${t.y+1}${t.tip?' · '+t.tip:''}</small></div><button class="btn" data-a="map" data-x="${t.x}" data-y="${t.y}">前往</button></div>`).join('');
  return out+'<p class="muted">营坪、草坡、林地、石岗和花田可筑庐；水面、妖窟、奇遇和祭坛不可覆盖。</p>';
 }
 out+=`<div class="camp-shortcuts"><button class="btn" data-a="panel" data-name="warehouse">仓库</button><button class="btn" data-a="room" data-room="forge">炼器</button><button class="btn" data-a="room" data-room="alchemy">炼丹</button><button class="btn" data-a="panel" data-name="cultivate">静修</button></div>`;
 const left=game.farmRemaining();
 out+=`<div class="farm-strip"><span>灵田 · ${left===null?'未建':game.farmBatches?'可收'+game.farmBatches+'轮':left>0?'余'+Math.ceil(left/60)+'小时':'待收获'}</span><button class="btn" data-a="farm" ${left===null?'disabled':''}>收获</button></div>`;
 out+='<div class="build-grid">'+Object.keys(D.BUILDINGS).filter(id=>D.BUILDINGS[id].zone===undefined||D.BUILDINGS[id].zone===game.s.zone).map(buildingCard).join('')+'</div>';
 return out;
}
function warehouseBody(){
 const c=game.camp,ready=game.storageReady;
 if(!c)return '<p>先选择地点筑庐，再修建仓房。</p><button class="btn primary" data-a="panel" data-name="camp">选址定居</button>';
 if(!game.roomLevel('warehouse'))return '<p>洞府已有，仓房尚未修建。</p><button class="btn primary" data-a="panel" data-name="camp">修建仓房</button>';
 const ids=Object.keys(D.ITEMS).filter(id=>(c.stash[id]||0)+(game.s.inv[id]||0)>0);
 return `<div class="stat-chips"><span>本仓 ${game.stashWeight()}/${game.stashCapacity()}</span><span>行囊 ${game.weight}/${game.capacity}</span></div><div class="inline-buttons"><button class="btn primary" data-a="store" ${!ready?'disabled':''}>材料入仓</button><button class="btn" data-a="provision" ${!ready?'disabled':''}>出行补给</button><button class="btn" data-a="panel" data-name="camp">营建</button>${!ready?'<button class="btn" data-a="home">回府</button>':''}</div><p class="muted">灵田成熟最多累积3轮；收获优先入本仓，满仓则转行囊或原地待拾。${ready?'府内建造与炼制优先使用行囊，再取本仓。':'仅查看本境仓物，回府才可存取。'}其他地图的仓库独立。</p><div class="warehouse-label"><span>物品 · 随身 / 仓内</span><span>存取</span></div>${ids.map(id=>`<div class="item-row warehouse-row"><span class="item-name">${D.ITEMS[id].name}<small>${game.s.inv[id]||0} / ${c.stash[id]||0}</small></span><button class="btn" data-a="store" data-id="${id}" data-qty="5" ${!ready||!game.s.inv[id]?'disabled':''}>存5</button><button class="btn" data-a="store" data-id="${id}" ${!ready||!game.s.inv[id]?'disabled':''}>存全</button><button class="btn" data-a="withdraw" data-id="${id}" data-qty="1" ${!ready||!c.stash[id]?'disabled':''}>取1</button><button class="btn" data-a="withdraw" data-id="${id}" data-qty="5" ${!ready||!c.stash[id]?'disabled':''}>取5</button></div>`).join('')}`;
}
function groundRows(){
 const ids=Object.keys(game.ground).filter(id=>game.ground[id]>0);
 return ids.length?'<h3>原地待拾 · 满包奖励保留在发现处</h3>'+ids.map(id=>`<div class="item-row"><span class="item-name">${D.ITEMS[id].name} ×${game.ground[id]}</span><button class="btn" data-a="pickup" data-id="${id}">拾取</button></div>`).join(''):'';
}

function cultivateBody(){const s=game.s,m=s.meditation.day===game.day?s.meditation.uses:0;return `<h3>${game.realm} · 寿元剩余 ${game.lifeYears.toFixed(1)}年</h3><p class="muted">四游戏日折一年，战败另减${D.LIFE.defeatYears}年；筑基与指定炼气层数突破可延寿。寿尽永久删档。</p><div class="stat-chips"><span>修为 ${s.xp}/${game.required}</span><span>攻击 ${s.attack+game.weapon}</span><span>防御 ${game.armor}</span><span>气血上限 ${s.maxHp}</span></div><p>采集与斗法得修为，足够时自动突破。</p><div class="inline-buttons"><button class="btn primary" data-a="meditate">吐纳 ${3-m}/3</button><button class="btn" data-a="train">试剑</button></div><p class="muted">吐纳需洞府、灵石1；静室${game.roomLevel('quiet')}阶，每次修为${[8,12,16,22][game.roomLevel('quiet')]}。试剑不掉物资。</p><h3>休整</h3><div class="inline-buttons"><button class="btn" data-a="rest" data-mode="camp">洞府休息</button><button class="btn" data-a="rest" data-mode="supply">补给 · 石1</button><button class="btn" data-a="rest" data-mode="night">休至夜间 · 石1</button><button class="btn" data-a="rest" data-mode="dawn">休至次晨 · 石1</button></div><p class="muted">野外请使用主界面的调息；休整与补给需要自建洞府。</p><h3>护持</h3><p>${s.buffs.fireward>s.minutes?'避火丹：余'+(s.buffs.fireward-s.minutes)+'分钟':'避火：未生效'}<br>${s.buffs.detox>s.minutes?'清瘴丹：余'+(s.buffs.detox-s.minutes)+'分钟':'清瘴：未生效'}</p>`;}
const sourceCache={};
function itemSources(id){if(sourceCache[id])return sourceCache[id];const found=[];D.ZONES.forEach((z,i)=>{const kinds=new Set(z.map.flat());const has=[...kinds].some(l=>(D.RESOURCE_LAYOUT[l]||[]).some(k=>k&&D.RES[k].loot[id]));if(has)found.push(z.name);});if(!found.length){const r=D.RECIPES.find(r=>r.item===id);if(r)found.push((r.zone?D.ZONES[r.zone].name+'开放后':'入门')+'炼制');else if(id==='dust')found.push('分解法器、遗迹、图鉴奖励');else if(id==='hide')found.push('青岚妖兽掉落');else found.push('初始物资或奇遇');}return sourceCache[id]=found.join('、');}
function itemDetails(id){const it=D.ITEMS[id],recipes=D.RECIPES.filter(r=>r.cost[id]).map(r=>r.name),tasks=D.ZONES.filter(z=>z.need[id]).map(z=>z.verb),res=Object.values(D.RES).filter(r=>r.loot[id]);const buildUses=Object.entries(D.BUILDINGS).flatMap(([bid,b])=>b.levels.map((l,i)=>l.cost[id]?b.name+(i+1)+'阶':null).filter(Boolean));const rules=res.map(r=>[r.tool?'随身'+D.ITEMS[r.tool].name:'',r.level?'炼气'+r.level+'层':'',r.spirit?'灵力'+r.spirit:''].filter(Boolean).join('、')).filter(Boolean);
 return `<div>来源：${esc(itemSources(id))}</div><div>用途：${esc([it.effect,recipes.length?'炼制'+recipes.join('、'):'',buildUses.length?'营建'+buildUses.join('、'):'',tasks.length?'任务'+tasks.join('、'):''].filter(Boolean).join('；')||'探索与生存物资')}</div>${rules.length?'<div>采集条件：'+esc([...new Set(rules)].join('；'))+'</div>':''}<div>重量：${it.wt}${it.type==='tool'?'；仓库中的工具不参与采集':''}</div>`;}
function bookRows(){const s=game.s;let rows=[];
 for(const [id,it] of Object.entries(D.ITEMS)){
  const material=['stone','ore','rune','copper','cinder','soul','star','thunder','dust','ancient'].includes(id);const res=Object.values(D.RES).find(r=>r.loot[id]);
  rows.push({key:'item-'+id,name:it.name,known:!!s.codex.items[id],cat:material?'mineral':'life',mark:res?.mark||it.name[0],detail:itemDetails(id),hint:itemSources(id),count:s.codex.items[id]||0});
 }
 for(const [id,e] of Object.entries(D.ENEMIES))if(!e.training){const boss=id.startsWith('boss'),z=boss?Number(id.slice(4)):['river','fishbeast'].includes(id)?1:id==='firebeast'?2:id==='wraith'?3:id==='sentinel'?4:0;rows.push({key:'enemy-'+id,name:e.name,known:!!s.codex.enemies[id],cat:'enemy',mark:boss?D.ZONES[z].bossMark:'妖',hint:D.ZONES[z].name,count:s.codex.enemies[id]||0,detail:`<div>出没：${D.ZONES[z].name}</div><div>气血 ${e.hp} · 攻击 ${e.atk} · 防御 ${e.armor}</div><div>掉落：${Object.entries(e.loot).map(([k,n])=>D.ITEMS[k].name+'×'+n).join('、')}${boss?'；必掉一件法器':'；22%概率掉法器'}</div><div>击败：${Math.max(0,(s.codex.enemies[id]||0)-1)}次</div>`});}
 for(const r of D.RECIPES.filter(r=>r.gear))rows.push({key:'gear-'+r.id,name:r.name,known:!!s.codex.gears[r.id],cat:'gear',mark:r.gear==='weapon'?'剑':'衣',hint:D.ZONES[r.zone||0].name,count:s.codex.gears[r.id]||0,detail:`<div>来源：${D.ZONES[r.zone||0].name}解锁后在对应阶炼器室炼制或区域掉落</div><div>基础${r.gear==='weapon'?'攻击':'防御'}：+${r.bonus}，受品质与精炼加成</div><div>设施：${D.BUILDINGS[r.room]?.name||'炼器室'}${r.tier||1}阶，需亲自在洞府</div><div>配方：${Object.entries(r.cost).map(([k,n])=>D.ITEMS[k].name+'×'+n).join('、')}</div><div>已获得 ${s.codex.gears[r.id]||0} 件</div>`});
 for(const [id,def] of Object.entries(D.BUILDINGS)){
  const best=Math.max(0,...s.settlements.map(c=>game.roomLevel(id,c)));
  rows.push({key:'home-'+id,name:def.name,known:best>0,cat:'home',mark:def.mark,hint:'洞府营建',detail:`<div>最高已建：${best}阶</div>${def.levels.map((l,i)=>'<div><b>'+(i+1)+'阶</b> · '+esc(l.effect)+'<br>材料：'+Object.entries(l.cost).map(([k,n])=>D.ITEMS[k].name+'×'+n).join('、')+'</div>').join('')}`});
 }
 return rows;
}
function bookBody(){let rows=bookRows().filter(r=>filter==='all'||r.cat===filter).filter(r=>!search||(r.known?r.name:'未发现').includes(search)||r.hint.includes(search));
 const rewards=`<div class="book-rewards">${D.BOOK_REWARDS.map(r=>`<div class="reward-line"><span>${r.name} · ${game.bookCount}/${r.need}</span><button class="btn" data-a="claim-book" data-id="${r.id}" ${game.s.codex.claims[r.id]?'disabled':''}>${game.s.codex.claims[r.id]?'已领':game.bookCount>=r.need?'领取':'未达成'}</button></div>`).join('')}</div>`;
 rows.sort((a,b)=>Number(b.known)-Number(a.known));return rewards+(rows.map(r=>`<details class="book-entry ${r.known?'':'unknown'}" data-entry="${r.key}" ${openEntries.has(r.key)?'open':''}><summary><b>${r.known?r.mark:'?'}</b><span>${r.known?esc(r.name):'未发现'}</span><small>${r.known?'已识':'线索'} ›</small></summary><div class="book-content">${r.known?r.detail:'线索：'+esc(r.hint)+'。获得或遭遇后解锁。'}</div></details>`).join('')||'<div class="empty">没有符合条件的条目</div>');}
function helpBody(){const g=game.s.guide;return `<div class="help-intro"><p>当前引导：${{new:'尚未开始',active:'进行中',paused:'已暂停',skipped:'已跳过',done:'已完成'}[g.status]}${g.step<D.GUIDE.length?' · '+(g.step+1)+'/'+D.GUIDE.length:''}</p><div class="inline-buttons"><button class="btn primary" data-a="guide" data-mode="${g.status==='new'?'start':g.step>=D.GUIDE.length?'replay':'resume'}">${g.step>=D.GUIDE.length?'重播引导':'继续引导'}</button><button class="btn" data-a="guide" data-mode="skip">跳过引导</button></div></div>${D.HELP.map(c=>`<details class="help-chapter" data-help="${c.id}" ${helpOpen.has(c.id)?'open':''}><summary>${c.title}</summary>${c.paragraphs.map(p=>'<p>'+esc(p)+'</p>').join('')}</details>`).join('')}`;}
function questBody(){const s=game.s,z=game.zone,altar=s.zone?{x:4,y:4}:(game.camp?.pos||{x:1,y:5});return `<p>青岚灵脉断裂，五处旧封印正在失效。你从一座草庐出发，修复各境阵眼，追查天阙遗留的魔念。</p><h3>当前：${z.name} · ${z.verb}</h3><p>${s.ritual[s.zone]?'封印已经稳定。':(s.zone?'前往'+z.altar+'提交材料。':'在洞府营建山门，自动完成本境护山阵。')}</p>${Object.entries(z.need).map(([id,n])=>`<div class="line">${D.ITEMS[id].name} <b class="${game.has(id)<n?'danger-text':'accent'}">${game.has(id)}/${n}</b> <span class="micro">${s.zone>0?'坛前只用随身物资':'府内可用本仓'}</span></div>`).join('')}<div class="inline-buttons" style="margin-top:9px"><button class="btn primary" data-a="map" data-x="${s.ritual[s.zone]?7:altar.x}" data-y="${s.ritual[s.zone]?2:altar.y}">${s.cleared[s.zone]?'前往首领再战':s.ritual[s.zone]?'前往首领':'前往阵眼'}</button></div><h3>五境进度</h3>${D.ZONES.map((z,i)=>`<div class="task-stage"><b>${i+1}</b><span>${z.name} · ${s.cleared[i]?'已平定':s.ritual[i]?'封印已修，待挑战首领':i<s.unlocked?'待修封印':'未解锁'}</span></div>`).join('')}`;}
function settingsBody(){return `<div class="stat-chips"><span>V10 · 洞府经营与寿元</span><span>${saveAvailable?'可本地保存':'存储受限'}</span></div><p>${esc(saveStatus)}</p><p class="danger-text">寿元：${game.lifeYears.toFixed(1)}年 · 倒下 ${game.s.life.losses}次 · 延寿丹 ${game.s.life.elixirs}/${D.LIFE.elixirLimit}。寿元归零会清除V10、自动备份及本来源旧版继承存档。离线外部JSON仍可手动回档。</p><div class="inline-buttons"><button class="btn primary" data-a="export">导出存档</button><button class="btn" data-a="import">导入存档</button><button class="btn" data-a="restore">恢复上次备份</button></div><p class="muted">换文件路径、浏览器、设备或网址前先导出。正常迁移会保留旧档，寿元耗尽时清除同来源旧档，避免自动复活。</p><h3>体验</h3><div class="inline-buttons"><button class="btn" data-a="motion">${game.s.settings.motion?'减少动效':'恢复动效'}</button><button class="btn" data-a="panel" data-name="log">行记</button><button class="btn" data-a="panel" data-name="help">完整教程</button></div><h3>重新修行</h3><button class="btn warn" data-a="reset">新开存档</button><p class="micro">新开存档需要再次确认，不会删除旧版存档。</p>`;}
function renderPanel(){const root=$('panel-root');if(!panel){root.innerHTML='';return;}
 const old=$('panel-body')?.scrollTop??panelScroll[panel]??0;
 const focus=document.activeElement,focusId=focus?.id,start=focus?.selectionStart,end=focus?.selectionEnd;
 const names={camp:'洞府',warehouse:'仓库',craft:'炼制',pack:'背包',cultivate:'修炼',book:'图鉴',help:'教程',settings:'设置',quest:'主线',log:'行记'};
 const tools=panel==='book'?`<input id="book-search" type="search" aria-label="搜索图鉴" placeholder="搜索已发现名称或地区" value="${esc(search)}"><select id="panel-filter" aria-label="图鉴类型">${[['all','全部'],['life','灵物'],['mineral','矿材'],['enemy','妖兽'],['gear','法器'],['home','建筑']].map(([k,v])=>`<option value="${k}" ${filter===k?'selected':''}>${v}</option>`).join('')}</select>`:panel==='craft'?`<span class="muted" style="flex:1;align-self:center">${game.workshop?'器'+game.roomLevel('forge')+'阶 · 丹'+game.roomLevel('alchemy')+'阶':'野外 · 仅随身配方'}</span><select id="panel-filter" aria-label="配方类型">${[['all','全部'],['tool','工具'],['gear','法器'],['food','丹药食物']].map(([k,v])=>`<option value="${k}" ${filter===k?'selected':''}>${v}</option>`).join('')}</select>`:'';
 const content=panel==='camp'?campBody():panel==='warehouse'?warehouseBody():panel==='craft'?craftBody():panel==='pack'?packBody():panel==='cultivate'?cultivateBody():panel==='book'?bookBody():panel==='help'?helpBody():panel==='settings'?settingsBody():panel==='quest'?questBody():game.s.logs.map(l=>`<div class="history ${esc(l.tone)}"><time>${esc(l.time)}</time>${esc(l.msg)}</div>`).join('');
 root.innerHTML=`<div class="panel" aria-label="${names[panel]}"><div class="panel-head"><div><strong>${names[panel]}</strong>${panel==='book'?'<span>'+game.bookCount+'/'+bookRows().length+'</span>':''}</div><button class="panel-close" data-a="close-panel" aria-label="关闭${names[panel]}">×</button></div>${tools?'<div class="panel-toolbar">'+tools+'</div>':''}<div id="panel-body" class="panel-body">${content}</div></div>`;
 $('panel-body').scrollTop=old;
 if(focusId==='book-search'&&$('book-search')){$('book-search').focus({preventScroll:true});try{$('book-search').setSelectionRange(start,end);}catch{}}
}
function openPanel(name){
 if(game.s.combat&&!['help','settings','log','book'].includes(name)){notify('先结束斗法','warn');return;}
 stop();mapOpen=false;travelOpen=false;if(panel===name){panelScroll[panel]=$('panel-body')?.scrollTop||0;panel=null;}else{if(panel)panelScroll[panel]=$('panel-body')?.scrollTop||0;panel=name;filter='all';search='';}
 if(panel==='book')flush(game.act('book-open'));else{persist();render();}if(panel&&$('panel-body'))$('panel-body').scrollTop=panelScroll[panel]||0;
}
function showModal(value){stop();mapOpen=false;travelOpen=false;modal=value;focusBeforeModal=document.activeElement;renderModal();renderTravel();renderCoach();}
function closeModal(){modal=null;renderModal();renderCoach();focusBeforeModal?.focus?.({preventScroll:true});}
function eventDescription(c){return [c.tool?'需'+D.ITEMS[c.tool].name:'',c.cost?'需'+Object.entries(c.cost).map(([k,n])=>D.ITEMS[k].name+n).join('、'):'',c.loot?Object.entries(c.loot).map(([k,n])=>D.ITEMS[k].name+'×'+n).join('、'):'',c.enemy?'挑战'+D.ENEMIES[c.enemy].name:'',c.gear?'寻获遗器':'',c.restore?'恢复全部气血与灵力':'',c.damage?'未避火时气血−'+c.damage:''].filter(Boolean).join(' · ');}
function renderModal(){const r=$('modal-root');syncLayers();if(!modal){r.innerHTML='';return;}
 let body='';if(modal.kind==='item'){const id=modal.id,it=D.ITEMS[id];body=`<div class="kicker">随身物品</div><h2>${it.name}</h2><p>随身 ${game.s.inv[id]||0} · 本境仓内 ${game.camp?.stash[id]||0}<br>单件负重 ${it.wt}</p><p>${esc(it.effect||'可在图鉴查看来源与炼制用途。')}</p><div class="inline-buttons">${it.type==='food'?`<button class="btn primary" data-a="item-use" data-id="${id}">使用</button>`:''}<button class="btn" data-a="item-pack">打开背包</button><button class="btn" data-a="modal-close">关闭</button></div>`;}
 else if(modal.kind==='intro')body=`<div class="kicker">青岚旧营坪 · 初入仙途</div><h2>从一草一木，开始。</h2><p>上方点字采集，左下角九宫格走路。「我」固定在中央，点周围格子移动。</p><div class="steps">拾材料 → 择地筑庐 → 建仓炼器<br>立山门 → 战妖兽 → 开新境</div><p>看远处，点九宫格旁「展开」。十一段实操引导跟随实际操作，随时可在「教程」继续。寿元归零会结束本轮并清除进度。</p><div class="inline-buttons"><button class="btn primary" data-a="guide" data-mode="start">跟着学</button><button class="btn" data-a="guide" data-mode="skip">自行探索</button><button class="btn" data-a="intro-help">先读教程</button></div><p><small>离线单机 · 本地存档 · 没有广告与付费入口</small></p>`;
 else if(modal.kind==='settle')body=`<div class="kicker">${esc(game.zone.name)} · ${modal.relocate?'迁居':'定居'}</div><h2>${modal.relocate?'搬到这里？':'在此筑起草庐？'}</h2><p>${esc(game.name)} · ${game.s.pos.x+1}列${game.s.pos.y+1}行</p><div class="steps">${cost(modal.relocate?D.MOVE_CAMP_COST:D.SETTLE_COST)}</div><p>${modal.relocate?'整座洞府连同设施与仓物搬移。不会返还材料、复制仓物或刷新灵田。':'每境只能有一座洞府。之后可以迁居，仓房与炼器室需要另行修建。'}</p><div class="inline-buttons"><button class="btn primary" data-a="confirm-settle">${modal.relocate?'确认迁居':'确认筑庐'}</button><button class="btn" data-a="modal-close">取消</button></div>`;
 else if(modal.kind==='site'){const e=game.site;body=`<div class="kicker">${game.zone.name} · 奇遇</div><h2>${esc(e?.name)}</h2><p>${esc(e?.text)}</p>${e?.choices.map((c,i)=>{const bad=(c.tool&&!game.s.inv[c.tool])||(c.cost&&!game.enough(c.cost));return `<button class="event-choice ${bad?'unavailable':''}" data-a="event-choice" data-choice="${i}">${c.label}<small>${esc(eventDescription(c))}</small></button>`;}).join('')}<p class="micro">每个游戏日仅可完成一个选择。现在离开不消耗次数。</p><button class="btn" data-a="modal-close">离开</button>`;}
 else if(modal.kind==='permadeath')body=`<div class="kicker">寿元终结 · 轮回</div><h2>寿元已尽</h2><p>本轮修行结束。角色的自动存档、备份及本来源旧版继承记录已清除，不会因刷新恢复。</p><p>五境等待下一位修行者。新的角色将从青岚旧营坪重新开始。</p><div class="inline-buttons"><button class="btn primary" data-a="rebirth">重新轮回</button></div>`;
 else if(modal.kind==='victory')body=`<div class="kicker">五境灵脉 · 重归安宁</div><h2>五境问道 · 初成</h2><p>${game.day}日 · ${game.realm} · 已平定五境</p><p>封印已经稳定。你仍可返回旧地，探访每日奇遇、收集图鉴、重炼法器与再战首领。</p><div class="inline-buttons"><button class="btn primary" data-a="modal-close">继续修行</button><button class="btn" data-a="export">导出此刻进度</button></div>`;
 else if(modal.kind==='reset')body=`<h2>重新开始修行？</h2><p>当前V10进度将被新存档替换，旧进度留作上次备份。先导出可额外保留一份。</p><div class="inline-buttons"><button class="btn" data-a="export">导出存档</button><button class="btn" data-a="modal-close">取消</button><button class="btn warn" data-a="confirm-reset">确认新开</button></div>`;
 else if(modal.kind==='import')body=`<h2>载入这份进度？</h2><p>${esc(modal.label||'导入存档')}<br>${D.ZONES[importCandidate.s.zone].name} · ${importCandidate.realm}<br>五境已平定 ${importCandidate.s.cleared.filter(Boolean).length}/5</p><p>确认前不会覆盖当前进度。当前进度将保留为备份。</p><div class="inline-buttons"><button class="btn" data-a="modal-close">取消</button><button class="btn primary" data-a="confirm-import">确认载入</button></div>`;
 r.innerHTML=`<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-label="${modal.kind==='intro'?'新手入门':modal.kind==='site'?'奇遇选择':'游戏提示'}" tabindex="-1">${body}</div></div>`;
 requestAnimationFrame(()=>r.querySelector('button')?.focus({preventScroll:true}));
}
function render(){
 renderStatus();renderScene();renderMap();renderPeek();renderTravel();renderPanel();syncLayers();
 $('phone').classList.toggle('reduced',!game.s.settings.motion);
 if(guideRAF)cancelAnimationFrame(guideRAF);guideRAF=requestAnimationFrame(renderCoach);
}
function mapGuide(x,y,tip){
 const next=game.path(x,y)[0];
 if(!next)return {selector:'#expand-map',tip:'点展开查看目的地。'};
 return {selector:`#map [data-x="${next.x}"][data-y="${next.y}"]`,tip:tip+' 点九宫格高亮格走一步。'};
}
function nearestResource(item,kind=null){let best=null;for(let y=0;y<8;y++)for(let x=0;x<8;x++){
 const l=game.land(x,y);if(['boss','gate'].includes(l))continue;const list=D.RESOURCE_LAYOUT[l]||[];
 for(let i=0;i<list.length;i++){const k=list[i];if(!k||!D.RES[k].loot[item]||(kind&&k!==kind))continue;const r=D.RES[k],rec=game.s.nodeHarvest[game.key(x,y)+'#'+i];if(rec?.day===game.day&&rec.used>=r.max)continue;if(r.tool&&!game.s.inv[r.tool])continue;if(r.level&&game.s.level<r.level)continue;const dist=Math.abs(x-game.s.pos.x)+Math.abs(y-game.s.pos.y);if(!best||dist<best.dist)best={x,y,i,dist};}
 }return best;}
function resourceGuide(item,kind=null){
 if(panel)return {selector:'.panel-close',tip:'先收起面板，再去采集。'};
 if(game.s.spirit<20)return {selector:'#rest-button',tip:game.atCamp?'先在洞府休息。':'先调息恢复灵力。'};
 const n=nearestResource(item,kind);
 if(!n)return {selector:game.atCamp?'#cultivate-button':game.camp?'#home-button':'#rest-button',tip:game.camp?'今日资源已尽，回府休至次晨。':'今日资源已尽，安全调息等待次日，注意补水进食。'};
 if(!n.dist)return {selector:`#resources [data-index="${n.i}"]`,tip:'点高亮资源，取得'+D.ITEMS[item].name+'。'};
 return mapGuide(n.x,n.y,`前往${n.x+1}列${n.y+1}行。`);
}
function costGuide(cost,atHome=false){
 const amount=k=>(game.s.inv[k]||0)+(atHome?(game.camp?.stash[k]||0):0);
 const id=Object.keys(cost).find(k=>amount(k)<cost[k]);if(!id)return null;
 const r=resourceGuide(id);return {...r,tip:'缺'+D.ITEMS[id].name+(cost[id]-amount(id))+'。'+r.tip};
}
function settleGuide(){
 if(!game.canSettle()){
  const need=costGuide(D.SETTLE_COST);if(need)return need;
  return {selector:panel==='camp'?'#settle-button':'#camp-button',tip:panel==='camp'?'点在此筑庐，再确认选址。':'打开洞府，确定这处选址。'};
 }
 if(panel)return {selector:'.panel-close',tip:'收起面板，先走到适合定居的地块。'};
 const c=campCandidates()[0];return c?mapGuide(c.x,c.y,'前往合适的营地。'):{selector:'#expand-map',tip:'先探索附近的草坡、林地或营坪。'};
}
function buildingGuide(id){
 if(!game.camp)return settleGuide();
 const next=D.BUILDINGS[id].levels[game.roomLevel(id)];
 if(!next)return {selector:'#camp-button',tip:'该建筑已达到本版上限。'};
 if(next.home&&game.camp.level<next.home)return buildingGuide('residence');
 const need=costGuide(next.cost,true);if(need)return need;
 if(!game.atCamp)return {selector:'#home-button',tip:'材料齐备，回自己的洞府施工。'};
 return {selector:panel==='camp'?`#building-${id} [data-a="build"]`:'#camp-button',tip:'修建'+D.BUILDINGS[id].name+'，材料齐备才会扣除。'};
}
function recipeGuide(id){const r=game.recipe(id);
 if(r.room&&(!game.camp||game.roomLevel(r.room)<r.tier))return buildingGuide(r.room);
 if(r.unique&&game.camp?.stash[r.item]&&!game.s.inv[r.item])return {selector:!game.atCamp?'#home-button':panel==='warehouse'?`[data-a="withdraw"][data-id="${r.item}"][data-qty="1"]`:'#pack-button',tip:'工具放在仓房，要取到行囊才生效。'};
 const need=costGuide(r.cost,!!r.home);if(need)return need;
 if(r.home&&!game.atCamp)return {selector:'#home-button',tip:'材料齐备，回自己的炼器室或丹房制作。'};
 return {selector:panel==='craft'?`[data-a="craft"][data-id="${id}"]`:'#craft-button',tip:panel==='craft'?'点击配方的炼制按钮。':'打开炼制，按配方操作。'};
}
function guideTarget(){const s=game.s,step=s.guide.step,b=s.guide.base;
 if(s.combat)return {selector:s.combat.intent==='heavy'?'[data-a="fight"][data-mode="guard"]':'[data-a="fight"][data-mode="attack"]',tip:s.combat.intent==='heavy'?'看到重击先防守。':'先完成战斗，引导会保留。'};
 if(s.hunger<30){
  if(s.inv.berry)return {selector:'#food-button',tip:'先吃灵果，避免饥饿。'};
  if(game.atCamp)return {selector:'#rest-button',tip:'先在洞府休息，利用每日简餐补给。'};
  const food=['pill','meal','fish'].find(id=>s.inv[id]>0);
  if(food)return {selector:panel==='pack'?`[data-a="consume"][data-id="${food}"]`:'#pack-button',tip:'行囊中有食物，先使用再继续。'};
  return resourceGuide('berry');
 }
 if(s.hp<s.maxHp*.5&&game.camp)return {selector:game.atCamp?'#rest-button':'#home-button',tip:'先回府休息恢复气血，再进行营建。'};
 if(s.water<25){if(s.inv.water)return {selector:'#water-button',tip:'先补饮水，再继续行动。'};return resourceGuide('water');}
 if(step===0)return resourceGuide('fiber');
 if(step===1)return recipeGuide('axe');
 if(step===2)return settleGuide();
 if(step===3)return buildingGuide('warehouse');
 if(step===4){
  if(!game.atCamp)return {selector:'#home-button',tip:'回府，亲手练习仓库存取。'};
  if(s.stats.stores<=(b.stores||0)){
   const id=Object.keys(s.inv).find(k=>s.inv[k]>0&&D.ITEMS[k]?.type==='material');
   if(!id)return resourceGuide('fiber');
   return {selector:panel==='warehouse'?`[data-a="store"][data-id="${id}"]`:panel==='camp'?'[data-name="warehouse"]':'#camp-button',tip:'打开仓库，把一份材料存进去。'};
  }
  const id=Object.keys(game.camp.stash).find(k=>game.camp.stash[k]>0);
  if(!id)return resourceGuide('fiber');
  return {selector:panel==='warehouse'?`[data-a="withdraw"][data-id="${id}"][data-qty="1"]`:panel==='camp'?'[data-name="warehouse"]':'#camp-button',tip:'再取1份出来；其他地图不能隔空使用本仓。'};
 }
 if(step===5)return buildingGuide('forge');
 if(step===6)return recipeGuide('woodSword');
 if(step===7){if(game.roomLevel('alchemy')<1)return buildingGuide('alchemy');return recipeGuide('pill');}
 if(step===8)return {selector:'#book-button',tip:'打开图鉴，新增建筑也有造价和作用说明。'};
 if(step===9)return {selector:!game.atCamp?'#home-button':panel==='cultivate'?'[data-a="train"]':'#cultivate-button',tip:'回自己的洞府，在修炼中完成安全试剑。'};
 return {selector:'#travel-toggle',tip:'查看五境，接下来在洞府修建山门。'};
}

function renderCoach(){
 document.querySelectorAll('.guide-target').forEach(e=>e.classList.remove('guide-target'));
 const root=$('guide-root');root.innerHTML='';const g=game.s.guide;
 if(modal||mapOpen||g.status!=='active'||g.step>=D.GUIDE.length||travelOpen)return;
 const step=D.GUIDE[g.step];let targetInfo=guideTarget(),target=document.querySelector(targetInfo.selector);
 // Overlays now use the central screen area; teach closing them before movement/supplies.
 if(panel&&target&&!target.closest('.panel,.quick-nav,.top-buttons')){
  targetInfo={selector:'.panel-close',tip:'先收起当前面板，再继续操作。'};target=document.querySelector('.panel-close');
 }
 if(target?.closest('.panel-body')){const sig=g.step+':'+targetInfo.selector+':'+panel;if(sig!==guideSignature){target.scrollIntoView({block:'nearest',inline:'nearest'});guideSignature=sig;}}
 if(!target||target.getBoundingClientRect().height===0)target=$('craft-button');
 target.classList.add('guide-target');
 const ph=$('phone').getBoundingClientRect(),tr=target.getBoundingClientRect();
 const card=document.createElement('div');card.className='guide-card';card.setAttribute('role','region');card.setAttribute('aria-label','新手引导');card.style.width=(ph.width-24)+'px';card.style.left='12px';
 card.innerHTML=`<div class="guide-title"><strong>${g.step+1}/${D.GUIDE.length} · ${step.title}</strong><button data-a="guide" data-mode="pause">收起</button></div><p>${esc(step.text)}</p><div class="guide-tip">${esc(targetInfo.tip)}</div>`;root.append(card);
 const ch=card.offsetHeight,tt=tr.top-ph.top,tb=tr.bottom-ph.top;
 let top=tt>ph.height*.5?tt-ch-8:tb+8;
 if(top+ch>ph.height-8)top=tt-ch-8;if(top<8)top=tb+8;
 card.style.top=Math.max(6,Math.min(ph.height-ch-6,top))+'px';
}
function travelTo(x,y){
 if(game.s.combat){notify('斗法中不能移动','warn');return;}
 stop();mapOpen=false;travelOpen=false;panel=null;
 if(x===game.s.pos.x&&y===game.s.pos.y){render();return;}
 const l=game.land(x,y);if(!l){notify('未知目的地','warn');return;}if(l==='boss'&&!game.s.ritual[game.s.zone]){notify('先完成'+game.zone.verb,'warn');render();return;}if(l==='gate'&&!game.s.cleared[game.s.zone]){notify('先击败本境首领','warn');render();return;}
 route=game.path(x,y);if(!route.length){notify('暂时无法前往','warn');render();return;}render();
 const advance=()=>{timer=null;if(!route.length||game.s.combat||modal||panel||travelOpen){stop();render();return;}
  const n=route.shift(),r=game.act('move',n);if(!r.ok||r.stop||game.s.combat)stop();flush(r);if(route.length)timer=setTimeout(advance,game.s.settings.motion?155:70);
 };timer=setTimeout(advance,85);
}
function exportSave(){const envelope={format:'QinglanWendao',version:D.VERSION,exportedAt:new Date().toISOString(),state:game.state()};const blob=new Blob([JSON.stringify(envelope,null,2)],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='青岚问道_第'+game.day+'日_V10存档.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),3000);notify('已生成存档文件，请妥善保存','ok');}
async function importFile(file){if(!file)return;try{if(file.size>2*1024*1024)throw Error('文件超过2MB');const data=JSON.parse(await file.text());if(data.format&&data.format!=='QinglanWendao')throw Error('不是青岚问道存档');importCandidate=new QGame(data.state||data);showModal({kind:'import',label:file.name});}catch(e){notify('导入失败：'+e.message,'warn');}finally{$('import-file').value='';}}
function handle(a,b){
 if(a==='rebirth'&&modal?.kind==='permadeath'){
  try{for(const k of [D.DEATH_KEY,D.SAVE,D.SAVE+'-backup',...D.LEGACY])localStorage.removeItem(k);}catch{}
  deathBoot=false;game=new QGame();panel=null;modal=null;route=[];persist();render();showModal({kind:'intro'});return;
 }
 if(game.s.ended||deathBoot)return;
 if(a==='modal-close'){closeModal();return;}
 if(a==='guide'){stop();modal=null;panel=null;travelOpen=false;renderModal();run('guide',{mode:b.dataset.mode});return;}
 if(a==='intro-help'){modal=null;game.act('guide',{mode:'pause'});renderModal();openPanel('help');return;}
 if(a==='export'){exportSave();return;}
 if(a==='item-use'){const id=b.dataset.id;modal=null;renderModal();run('consume',{id});return;}
 if(a==='item-pack'){modal=null;renderModal();openPanel('pack');return;}
 if(a==='confirm-settle'&&modal?.kind==='settle'){
  if(modal.key!==game.key()){closeModal();notify('位置已经变化，请重新选址','warn');return;}
  const result=game.act('settle',{relocate:modal.relocate});if(result.ok){modal=null;panel='camp';renderModal();}flush(result);return;
 }
 if(a==='confirm-reset'){try{localStorage.setItem(D.SAVE+'-backup',JSON.stringify(game.s));}catch{}game=new QGame();panel=null;modal=null;persist();render();showModal({kind:'intro'});return;}
 if(a==='confirm-import'&&importCandidate){try{localStorage.setItem(D.SAVE+'-backup',JSON.stringify(game.s));}catch{}game=importCandidate;importCandidate=null;panel=null;modal=null;renderModal();persist();render();notify('已载入，原进度留在备份','ok');return;}
 if(a==='event-choice'){const r=game.act('event',{choice:Number(b.dataset.choice)});if(r.ok){modal=null;renderModal();panel=null;}flush(r);return;}
 if(modal)return;
 if(a==='plan-settle'){
  const why=game.canSettle();if(why){notify(why,'warn');return;}
  showModal({kind:'settle',relocate:b.dataset.relocate==='1',key:game.key()});return;
 }
 if(a==='room'){
  stop();panel='craft';filter=b.dataset.room==='alchemy'?'food':'gear';search='';panelScroll.craft=0;render();$('panel-body').scrollTop=0;return;
 }
 if(a==='expand-map'){setMap(true);return;}
 if(a==='collapse-map'){setMap(false);return;}
 if(a==='mini-step'){stepTo(Number(b.dataset.x),Number(b.dataset.y));return;}
 if(a==='quick-rest'){stop();panel=null;run('rest',{mode:game.workshop?'camp':'field'});return;}
 if(a==='peek'){stop();const id=b.dataset.id;showModal({kind:'item',id});return;}
 if(a==='item-use'){const id=b.dataset.id;modal=null;renderModal();run('consume',{id});return;}
 if(a==='item-pack'){modal=null;renderModal();openPanel('pack');return;}
 if(a==='panel'){openPanel(b.dataset.name);return;}
 if(a==='close-panel'){if(panel)panelScroll[panel]=$('panel-body')?.scrollTop||0;panel=null;render();return;}
 if(a==='travel-toggle'){
  stop();mapOpen=false;if(game.s.combat){notify('斗法中不能出行','warn');return;}travelOpen=!travelOpen;panel=null;if(travelOpen)flush(game.act('travel-open'));else{persist();render();}return;
 }
 if(a==='zone'){stop();travelOpen=false;panel=null;run('travel',{zone:Number(b.dataset.zone)});return;}
 if(a==='home'){stop();travelOpen=false;if(!game.camp){openPanel('camp');return;}if(game.atCamp){panel=null;render();notify('已在自己的洞府');return;}travelTo(game.camp.pos.x,game.camp.pos.y);return;}
 if(a==='stop'){stop();render();return;}
 if(a==='map'){travelTo(Number(b.dataset.x),Number(b.dataset.y));return;}
 if(a==='site'){stop();const why=game.siteReady();if(why)notify(why,'warn');else showModal({kind:'site'});return;}
 if(a==='import'){$('import-file').click();return;}
 if(a==='restore'){try{const raw=localStorage.getItem(D.SAVE+'-backup');if(!raw)throw Error('没有可用备份');importCandidate=new QGame(JSON.parse(raw));showModal({kind:'import',label:'恢复上次自动备份'});}catch(e){notify(e.message,'warn');}return;}
 if(a==='reset'){showModal({kind:'reset'});return;}
 if(a==='motion'){game.s.settings.motion=!game.s.settings.motion;persist();render();return;}
 stop();travelOpen=false;
 if(a==='train')panel=null;
 run(a,{id:b.dataset.id,index:Number(b.dataset.index),mode:b.dataset.mode,qty:Number(b.dataset.qty)||1});
}
document.addEventListener('click',e=>{
 const b=e.target.closest('button');
 if(travelOpen&&!e.target.closest('#travel-menu')&&!e.target.closest('#travel-toggle')){travelOpen=false;renderTravel();}
 if(!b||b.disabled)return;handle(b.dataset.a,b);
});
document.addEventListener('input',e=>{if(e.target.id==='book-search'){search=e.target.value;renderPanel();}});
document.addEventListener('change',e=>{if(e.target.id==='panel-filter'){filter=e.target.value;panelScroll[panel]=0;renderPanel();$('panel-body').scrollTop=0;renderCoach();}if(e.target.id==='import-file')importFile(e.target.files[0]);});
document.addEventListener('toggle',e=>{const t=e.target;if(t.dataset?.entry){if(t.open)openEntries.add(t.dataset.entry);else openEntries.delete(t.dataset.entry);}if(t.dataset?.help){if(t.open)helpOpen.add(t.dataset.help);else helpOpen.delete(t.dataset.help);}},true);
document.addEventListener('keydown',e=>{
 if(mapOpen&&e.key==='Tab'){const f=[...$('map-overlay').querySelectorAll('button:not(:disabled)')],first=f[0],last=f.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}return;}
 if(modal&&e.key==='Tab'){const f=[...$('modal-root').querySelectorAll('button:not(:disabled),input,[tabindex="0"]')];if(f.length){const first=f[0],last=f.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}return;}
 if(e.key==='Escape'){e.preventDefault();if(modal?.kind==='permadeath')return;if(modal){if(modal.kind==='intro')game.act('guide',{mode:'skip'});closeModal();persist();}else if(mapOpen){setMap(false);}else if(travelOpen){travelOpen=false;render();}else if(panel){panel=null;render();}else if(game.s.guide.status==='active')run('guide',{mode:'pause'});else{stop();render();}return;}
 if(modal||mapOpen||panel||travelOpen||game.s.combat||e.target.closest('input,textarea,select,button'))return;
 const moves={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0],w:[0,-1],s:[0,1],a:[-1,0],d:[1,0]};if(moves[e.key]){e.preventDefault();stop();const [dx,dy]=moves[e.key];run('move',{x:game.s.pos.x+dx,y:game.s.pos.y+dy});}
});
window.addEventListener('resize',()=>{renderTravel();renderCoach();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stop();persist();}});
window.addEventListener('pagehide',()=>{stop();persist();});
load();render();persist();if(deathBoot)showModal({kind:'permadeath'});else if(game.s.guide.status==='new')showModal({kind:'intro'});if(bootMessage)setTimeout(()=>notify(bootMessage,saveAvailable?'ok':'warn'),300);
window.QinglanDemo={getState:()=>game.state(),metadata:{version:10,saveKey:D.SAVE,width:8,height:8,regions:D.ZONES.map(z=>({name:z.name,need:z.need,boss:z.boss})),recipes:D.RECIPES.map(r=>r.id),bookTotal:bookRows().length},getNode:i=>({kind:game.resource(i),left:game.left(i),condition:game.resource(i)?game.requirement(game.resource(i)):null}),getUI:()=>({panel,travelOpen,mapOpen,modal:modal?.kind||null,route:route.length,saveStatus,deathBoot})};
})();
