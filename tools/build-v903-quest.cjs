'use strict';
function glyph(n){return /净泉|灵泉/.test(n)?"泉":/古炉/.test(n)?"炉":/古碑/.test(n)?"碑":/祭台/.test(n)?"台":"坛";}
function poi(i,type){const z=D.ZONES[i];if(!z)return null;for(let y=0;y<8;y++)for(let x=0;x<8;x++)if(z.map[y][x]===type){const k=i+":"+x+","+y;return {x,y,key:k,mark:type==="shrine"?glyph(z.altar):type==="boss"?z.bossMark:"界",name:type==="shrine"?z.altar:(D.NAMED[k]?.[0]||D.ENEMIES[z.boss]?.name||"界碑")};}return null;}
function objective(){
 const s=game.s,i=s.zone,z=D.ZONES[i],camp=s.settlements[i],here=!!camp&&game.atCamp;
 const at=p=>!!p&&p.x===s.pos.x&&p.y===s.pos.y;
 const where=p=>p?`第${p.x+1}列第${p.y+1}行「${p.mark}」字处`:"地图";
 const action=(label,type,args={})=>({label,type,...args});
 const needs=(x,stash=false)=>Object.entries(x).map(([id,n])=>({id,name:D.ITEMS[id]?.name||id,n,have:(s.inv[id]||0)+(stash?(camp?.stash?.[id]||0):0)}));
 const out={title:"",detail:"",short:"",point:null,needs:[],note:"",action:null};
 if(s.ascended)return {...out,title:"凡界修行已成",detail:"十二境已平定，飞升完成。仙界暂未开放；已解锁区域可继续回访。",short:"凡界飞升已成"};
 if(!s.ritual[i]){
  if(i===0){
   out.title=camp?"修建青岚山门与护山阵":"先择地筑庐，建立洞府";
   out.detail=camp?"在你的自建洞府修建「山门与护山阵」。完成后才能挑战青岚妖窟。":"旧营坪不是现成的山门。先采集木石与青藤，选址筑庐，之后才可营建山门。";
   out.point=camp?{x:camp.pos.x,y:camp.pos.y,mark:"府",name:"自建洞府"}:null;
   out.needs=camp?needs(z.need,true):[];
   out.action=!camp?action("打开洞府选址","panel",{panel:"camp"}):here?action("查看山门营建","panel",{panel:"camp"}):action("返回自建洞府","map",{x:camp.pos.x,y:camp.pos.y});
   out.short=camp?"返回洞府 · 修建山门":"先择地筑庐 · 建立洞府";
  }else{
   const p=poi(i,"shrine");out.title=z.verb+" · "+z.altar;out.point=p;
   out.detail="前往地图指示的位置完成"+z.verb+"仪式。所需材料必须随身携带，不能隔空使用仓库。";
   out.needs=needs(z.need);out.action=p?(at(p)?action("在此完成"+z.verb,"repair"):action("导航到"+z.altar,"map",{x:p.x,y:p.y})):null;
   out.short=z.verb+" · 地图「"+(p?.mark||"坛")+"」字（第"+(p?.x+1||5)+"列第"+(p?.y+1||5)+"行）";
  }
 }else if(!s.cleared[i]){
  const p=poi(i,"boss"),enemy=D.ENEMIES[z.boss]?.name||"首领";out.point=p;
  out.title="挑战首领 · "+enemy;
  out.detail="仪式已完成。前往地图标记处挑战"+enemy+"，出发前检查气血、食水与装备。";
  out.action=p?(at(p)?action("在此挑战首领","hunt"):action("导航到首领据点","map",{x:p.x,y:p.y})):null;
  out.short="挑战"+enemy+" · 找地图「"+z.bossMark+"」字";
 }else if(i>=5&&s.major===i-4){
  const stage=D.ASCENSION_STAGES[i-5],core=i===5&&!game.coreTrial.complete,heart=i===6&&!game.heartTrial.complete;
  out.title=core?"凝丹雷劫 · 三重试炼":heart?"元婴问心 · 三重试炼":"回洞府准备突破境界";
  out.detail=core?"在丹霞雷渊本境洞府，完成「修炼 → 凝丹雷劫」后再正式突破。":heart?"在婴灵古墟本境洞府，完成「修炼 → 元婴问心」后再正式突破。":"本境首领已败；请在本境建洞府，积累道行并备齐突破道材，在修炼中主动破境。";
  out.point=camp?{x:camp.pos.x,y:camp.pos.y,mark:"府",name:"本境自建洞府"}:null;
  out.needs=stage?needs({[stage.primary]:2,[stage.secondary]:1},true):[];
  out.note=stage?"道行 "+s.daoXp+"/"+stage.needDao+" · 可从本境仓房使用突破材料":"";
  out.action=!camp?action("先在本境筑庐","panel",{panel:"camp"}):here?action("进入修炼与破境","panel",{panel:"cultivate"}):action("回到本境洞府","map",{x:camp.pos.x,y:camp.pos.y});
  out.short=core?"本境洞府 · 凝丹雷劫":heart?"本境洞府 · 元婴问心":"本境洞府 · 道行"+s.daoXp+"/"+(stage?.needDao||0)+"待突破";
 }else if(i===11&&s.major>=8){
  const p=poi(i,"gate");out.title="渡劫已成 · 前往飞升天门";out.point=p;
  out.detail="在飞升天门的界碑结算。需150道行、劫雷晶×3、天门符×2；可直接飞升，也可选做九霄终劫。";
  out.needs=needs(D.ASCENSION_RULE.cost);out.note="飞升道行 "+s.daoXp+"/"+D.ASCENSION_RULE.dao;
  out.action=p?(at(p)?action("查看飞升与九霄终劫","heaven-open"):action("导航到飞升天门","map",{x:p.x,y:p.y})):null;
  out.short="渡劫已成 · 前往「界」字飞升天门";
 }else if(i<11){
  out.title="本境已平定 · 前往"+D.ZONES[i+1].name;
  out.detail="仪式与首领已完成，可出行至下一境。旧境洞府、仓房、地图与物资仍会保留。";
  out.action=i+1<s.unlocked?action("前往"+D.ZONES[i+1].name,"zone",{zone:i+1}):null;
  out.short="本境通关 · 下一境"+D.ZONES[i+1].name;
 }else{
  out.title="回本境洞府完成渡劫突破";out.detail="完成本境修炼与突破后，再前往飞升天门。";
  out.action=action("打开洞府","panel",{panel:"camp"});out.short=out.title;
 }
 return out;
}
function questDisplay(){
 const s=game.s,q=objective(),n=s.cleared.filter(Boolean).length;
 const position=q.point?`<div class="q3-place">${esc(q.point.name)} · 第${q.point.x+1}列第${q.point.y+1}行 · 地图「${q.point.mark}」字</div>`:"";
 const materials=q.needs.length?`<div class="q3-needs">${q.needs.map(e=>`<span class="${e.have>=e.n?"ready":"missing"}">${esc(e.name)} <b>${e.have}/${e.n}</b></span>`).join("")}</div>`:"";
 const a=q.action,button=a?`<button class="btn primary" data-a="${a.type}"${a.type==="map"?` data-x="${a.x}" data-y="${a.y}"`:a.type==="panel"?` data-name="${a.panel}"`:a.type==="zone"?` data-zone="${a.zone}"`:""}>${esc(a.label)} →</button>`:"";
 const status=i=>s.cleared[i]?"已通过":s.ritual[i]?"待首领":i<s.unlocked?(i===s.zone?"进行中":"已解锁"):"未解锁";
 return `<section class="q3">
 <div class="q3-title"><strong>${esc(game.zone.name)}</strong><span>第${s.zone+1}/12境 · 已平定${n}/12</span></div>
 <div class="q3-main"><small>当前目标</small><h3>${esc(q.title)}</h3><p>${esc(q.detail)}</p>${position}${q.note?`<div class="q3-note">${esc(q.note)}</div>`:""}${materials}${button?`<div class="q3-actions">${button}</div>`:""}</div>
 ${relicCourtQuestHTML()}
 <details class="q3-fold" data-quest="guide" ${questFolds.has("guide")?"open":""}><summary>本境探索与生存指引<span>详细攻略</span></summary>${realmPlaybookHTML()}</details>
 <details class="q3-fold" data-quest="world" ${questFolds.has("world")?"open":""}><summary>凡界十二境进度<span>${n}/12已平定</span></summary>
 <div class="q3-stages">${D.ZONES.map((zone,i)=>`<div class="${i===s.zone?"current":""}"><span>${String(i+1).padStart(2,"0")}</span><strong>${esc(zone.name)}</strong><small>${status(i)}</small></div>`).join("")}</div><p class="q3-realm">${esc(game.character.realms.join(" → "))}</p></details></section>`;
}
const Q3_STYLE="\n#panel-root .panel-body.q3-body{overflow-y:auto;padding:10px 11px 20px}\n.q3{display:flex;flex-direction:column;gap:10px;min-width:0}\n.q3-title{display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:0 2px 9px;border-bottom:1px solid var(--line,#ddd)}\n.q3-title strong{font-size:15px;color:var(--ink,#333)}\n.q3-title span{font-size:11px;color:var(--muted,#777);white-space:nowrap}\n.q3-main{padding:12px;border:1px solid var(--line,#ddd);border-radius:9px;background:var(--panel-card,var(--surface,#fff))}\n.q3-main>small{display:block;color:var(--muted,#777);font-size:10px;margin-bottom:3px}\n.q3-main h3{font-size:16px!important;margin:0 0 6px!important;line-height:1.4!important}\n.q3-main>p{font-size:12px!important;line-height:1.7!important;margin:0 0 7px!important}\n.q3-place{font-size:11px;color:var(--gold,#52735d);font-weight:650;padding:5px 0}\n.q3-note{font-size:11px;color:var(--muted,#777);padding:4px 0}\n.q3-needs{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 0}\n.q3-needs span{font-size:11px;padding:5px 7px;border:1px solid var(--line,#ddd);border-radius:5px;background:var(--panel-bg,var(--surface,#fff))}\n.q3-needs .missing b{color:var(--danger,#ac5752)}\n.q3-needs .ready b{color:var(--gold,#52735d)}\n.q3-actions{margin-top:10px}\n.q3-actions .btn{width:100%;min-height:39px;font-size:13px}\n.q3 .world-journal-entry{margin:0!important;padding:8px 10px!important;min-height:59px}\n.q3 .world-journal-entry strong{font-size:12px}\n.q3 .world-journal-entry small{font-size:10px}\n.q3 .world-journal-entry .btn{font-size:11px;flex:none}\n.q3-fold{border:1px solid var(--line,#ddd);border-radius:8px;background:var(--panel-card,var(--surface,#fff));overflow:hidden}\n.q3-fold>summary{display:flex;align-items:center;gap:6px;justify-content:space-between;padding:11px 12px;list-style:none;cursor:pointer;font-size:12px;font-weight:650;color:var(--ink,#222)}\n.q3-fold>summary::-webkit-details-marker{display:none}\n.q3-fold>summary span{margin-left:auto;color:var(--muted,#777);font-size:10px;font-weight:400}\n.q3-fold>summary::after{content:\"⌄\";color:var(--muted,#777)}\n.q3-fold[open]>summary::after{content:\"⌃\"}\n.q3-fold>.realm-playbook{margin:0!important;padding:8px 11px!important;border:0!important;background:transparent!important}\n.q3-fold .realm-playbook-row{padding:6px 0!important}\n.q3-stages{padding:0 12px 8px}\n.q3-stages>div{display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid var(--line,#eee)}\n.q3-stages>div>span{width:22px;font-size:10px;color:var(--muted,#777)}\n.q3-stages>div strong{flex:1;font-size:11px;color:var(--ink,#333)}\n.q3-stages>div small{font-size:10px;color:var(--muted,#777)}\n.q3-stages>div.current strong{color:var(--gold,#52735d)}\n.q3-realm{font-size:10px!important;padding:9px 12px;border-top:1px solid var(--line,#ddd)}\n#game-shell .tile.q3-target{border-color:var(--gold,#52735d)!important;box-shadow:inset 0 0 0 1px var(--gold,#52735d)}\nbody.theme-immortal .q3-main,body.theme-immortal .q3-fold{background:#192b4b;border-color:#526b8f}\nbody.theme-immortal .q3-title strong,body.theme-immortal .q3-main h3,body.theme-immortal .q3-fold>summary{color:#eaf6ff!important}\nbody.theme-mono .q3-main,body.theme-mono .q3-fold{background:#fff;border-color:#d4d4d4}\n@media(max-height:680px){#panel-root .panel-body.q3-body{padding:7px 8px}.q3{gap:7px}.q3-main{padding:9px}.q3-main h3{font-size:14px!important}.q3-fold>summary{padding:9px 10px}}\n";
function compile(base){
 let h=base;
 function patch(a,b){let i=h.indexOf(a);if(i<0||h.indexOf(a,i+a.length)>=0)throw Error("Not unique "+a.slice(0,110));h=h.slice(0,i)+b+h.slice(i+a.length);}
 function replaceRange(a,b,v){let i=h.indexOf(a),j=h.indexOf(b,i+a.length);if(i<0||h.indexOf(a,i+a.length)>=0||j<0)throw Error("Range invalid "+a);h=h.slice(0,i)+v+h.slice(j);}
 patch("<title>山野修仙记 V90.2 · 人物装备界面优化版</title>","<title>山野修仙记 V90.3 · 主线引导与地图标识优化版</title>");
 patch("'2:7,2':['熔炎洞府']","'2:7,2':['赤焰魔猿巢']");
 patch("'4:7,2':['破界天门']","'4:7,2':['破界殿·堕仙残念']");
 patch("前往净泉灵坛净泉，再平定蛟首。","前往第5列第5行「泉」字净泉灵坛完成净泉仪式，再击败青潭蛟影。");
 patch("镇魂古碑平乱后击败幽沼首领。","前往第5列第5行「碑」字镇魂古碑完成镇魂，再击败渡魂鬼将。");
 patch("设置可切换暖白松绿与极简黑白主题","设置可切换暖白松绿、极简黑白与流光仙境三种主题");
 replaceRange("function questBody(){","function simulatedLifeAdReady(){","const questFolds=new Set();\n"+glyph.toString()+"\n"+poi.toString()+"\n"+objective.toString()+"\n"+questDisplay.toString()+"\nfunction questBody(){return questDisplay();}\n");
 patch(" const short={wood:'木',stone:'石',rune:'纹',dew:'露',blossom:'花',herb:'药',copper:'铜',cinder:'火',ore:'矿',moss:'苔',soul:'魂',star:'星',thunder:'雷'};\n const text=s.ascended?'飞升已成 · 仙界待续':s.cleared[s.zone]?(s.zone>=5?(s.major===s.zone-4?(s.zone===5&&!game.coreTrial.complete?'回洞府 · 凝丹雷劫':'返回洞府 · 破境'):s.zone===11?'前往天门 · 飞升':'已突破 · 前往下一境'):'已开 '+D.ZONES[s.zone+1].name):s.ritual[s.zone]?'前往「'+game.zone.bossMark+'」挑战首领':Object.entries(game.zone.need).map(([id,n])=>(short[id]||D.ITEMS[id].name)+' '+game.has(id)+'/'+n).join('　');"," const text=objective().short;");
 replaceRange("function mapTile(x,y,small=false){","function renderMap(){",String.raw`
function mapTile(x,y,small=false){
 const s=game.s,valid=x>=0&&x<8&&y>=0&&y<8;
 if(!valid)return '<button class="tile boundary" disabled aria-label="地图边界，不可通行">·</button>';
 const key=game.key(x,y),seen=!!s.seen[key],l=game.land(x,y),site=D.SITES[key],current=s.pos.x===x&&s.pos.y===y;
 const dest=objective().point,goal=!!dest&&dest.x===x&&dest.y===y,visible=seen||goal;
 const home=game.isCampTile(x,y),ground=Object.values(s.caches[key]||{}).some(v=>v>0),ev=s.highEvents?.[s.zone],evOn=ev?.status==='pending'&&ev.tile===key;
 const mark=home?'府':ground?'拾':evOn?'异':l==='boss'?game.zone.bossMark:site?.mark||(l==='shrine'?glyph(game.zone.altar):null)||D.NAMED[key]?.[1]||D.LAND[l].mark;
 const name=visible?(home?game.campName():site?.name||D.NAMED[key]?.[0]||dest?.name||D.LAND[l].name):'未知地点';
 const locked=l==='boss'&&!s.ritual[s.zone]||l==='gate'&&!s.cleared[s.zone];
 return '<button class="tile '+(visible?'seen':'fog')+' '+(s.visited[key]?'visited':'')+' '+(visible&&(home||site||goal||evOn||['campsite','shrine','boss','gate'].includes(l))?'landmark':'')+' '+(goal?'q3-target':'')+' '+(route.some(p=>p.x===x&&p.y===y)?'route':'')+' '+(current?'current':'')+' '+(visible&&locked?'locked':'')+'" data-a="'+(small?'mini-step':'map')+'" data-x="'+x+'" data-y="'+y+'" '+(current?'disabled aria-current="location"':'')+' title="'+esc(name+(goal?' · 主线目标':'')+(locked&&visible?' · 未解锁':''))+'" aria-label="'+esc(name)+'，'+(x+1)+'列'+(y+1)+'行'+(goal?'，主线目标':'')+(current?'，当前位置':locked&&visible?'，未解锁':'')+'">'+(current?'我':visible?mark:'?')+'</button>';
}
`);
 patch("panel==='character'?'character-body-v92':''","panel==='character'?'character-body-v92':panel==='quest'?'q3-body':''");
 patch("if(t.dataset?.help){if(t.open)helpOpen.add(t.dataset.help);else helpOpen.delete(t.dataset.help);}",
       "if(t.dataset?.help){if(t.open)helpOpen.add(t.dataset.help);else helpOpen.delete(t.dataset.help);}if(t.dataset?.quest){if(t.open)questFolds.add(t.dataset.quest);else questFolds.delete(t.dataset.quest);}");
 const p=h.indexOf("</head>");if(p<0)throw Error("Missing head");
 h=h.slice(0,p)+'<style id="v903-quest">\n'+Q3_STYLE+'\n</style>\n'+h.slice(p);
 if((h.match(/<script\b/gi)||[]).length!==10||(h.match(/<\/html>/gi)||[]).length!==1)throw Error("Invalid HTML");
 return h;
}
module.exports={compile};
if(require.main===module){const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');const base=fs.readFileSync(path.join(root,'releases/山野修仙记_V90.2_人物装备界面优化版.html'),'utf8');fs.writeFileSync(path.join(root,'releases/山野修仙记_V90.3_主线引导与地图标识优化版.html'),compile(base),'utf8');console.log('V90.3 generated');}
