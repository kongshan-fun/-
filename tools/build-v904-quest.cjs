'use strict';
const Q4_CSS="\n/* V90.4 native quest subpages */\n#panel-root .q4-links{display:flex;flex-direction:column;gap:8px}\n#panel-root .q4-link{display:flex;justify-content:space-between;align-items:center;min-height:62px;gap:8px;padding:11px 12px;width:100%;text-align:left;background:var(--panel-card,var(--surface,#fff));border:1px solid var(--line,#ddd);border-radius:8px;color:var(--ink,#222)}\n#panel-root .q4-link span:first-child{display:flex;flex-direction:column;gap:5px;min-width:0}\n#panel-root .q4-link strong{font-size:13px}#panel-root .q4-link small,#panel-root .q4-link em{font-size:10px;font-style:normal;color:var(--muted,#777)}#panel-root .q4-link em{flex:none}\n#panel-root .panel-body.q4-body{overflow-y:auto;min-height:0;padding:11px 12px 16px;overscroll-behavior:contain}\n#panel-root .q4-page{display:flex;flex-direction:column;gap:12px;min-width:0}\n#panel-root .q4-intro{border-bottom:1px solid var(--line,#ddd);padding:2px 0 11px}\n#panel-root .q4-intro small,#panel-root .q4-intro p{font-size:11px!important;color:var(--muted,#777)}\n#panel-root .q4-intro h3{font-size:17px!important;line-height:1.4!important;margin:5px 0!important}\n#panel-root .q4-current,#panel-root .q4-page>.realm-playbook,#panel-root .q4-stages,#panel-root .q4-realm{padding:11px;border:1px solid var(--line,#ddd);border-radius:8px;background:var(--panel-card,var(--surface,#fff))}\n#panel-root .q4-current strong{font-size:13px}#panel-root .q4-current p{font-size:12px!important;line-height:1.65!important;margin:5px 0!important}\n#panel-root .q4-current small{font-size:10px;color:var(--gold,#52735d)}\n#panel-root .q4-page>.realm-playbook{margin:0!important}#panel-root .q4-page .realm-playbook-row{padding:7px 0!important}\n#panel-root .q4-count{display:flex;align-items:baseline;justify-content:space-between}#panel-root .q4-count strong{font-size:24px}#panel-root .q4-count small{font-size:11px;color:var(--muted,#777)}\n#panel-root .q4-stages{list-style:none;margin:0;padding:4px 11px}\n#panel-root .q4-stages li{display:flex;align-items:center;gap:8px;min-height:55px;border-bottom:1px solid var(--line,#eee);padding:7px 0}\n#panel-root .q4-stages li:last-child{border:0}#panel-root .q4-no{width:23px;flex:none;font-size:11px;color:var(--muted,#777)}\n#panel-root .q4-name{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}#panel-root .q4-name strong{font-size:12px}#panel-root .q4-name small{font-size:10px;color:var(--muted,#777)}\n#panel-root .q4-stages em{flex:none;font-size:10px;font-style:normal;color:var(--muted,#777)}#panel-root .q4-stages li.current strong{color:var(--gold,#52735d)}\n#panel-root .q4-realm p{font-size:11px!important;line-height:1.7!important}#panel-root .q4-realm small{font-size:10px;color:var(--muted,#777)}\n#panel-root .q4-footer>.btn{display:block;width:100%;min-height:40px}\n#panel-root .q4-link:focus-visible{outline:2px solid var(--gold,#52735d)}\nbody.theme-immortal #panel-root .q4-link,body.theme-immortal #panel-root .q4-current,body.theme-immortal #panel-root .q4-stages,body.theme-immortal #panel-root .q4-realm,body.theme-immortal #panel-root .q4-page>.realm-playbook{background:#192b4b;border-color:#4e6b92;color:#eaf5ff}\nbody.theme-mono #panel-root .q4-link,body.theme-mono #panel-root .q4-current,body.theme-mono #panel-root .q4-stages,body.theme-mono #panel-root .q4-realm,body.theme-mono #panel-root .q4-page>.realm-playbook{background:#fff;border-color:#ddd;color:#222}\n@media(max-height:670px){#panel-root .panel-body.q4-body{padding:7px 9px}#panel-root .q4-page{gap:9px}}\n";
const SUBPAGE_FNS="\nfunction isQuestChild(p){return p==='quest-guide'||p==='quest-world';}\nfunction enterQuestChild(kind){\n if(panel!=='quest'||!['guide','world'].includes(kind))return false;\n panelScroll.quest=$('panel-body')?.scrollTop||0;\n questReturnFocus=kind;panel='quest-'+kind;panelScroll[panel]=0;\n stop();render();if($('panel-body'))$('panel-body').scrollTop=0;\n $('panel-root')?.querySelector('.panel-back')?.focus({preventScroll:true});\n return true;\n}\nfunction leaveQuestChild(){\n if(!isQuestChild(panel))return false;\n panelScroll[panel]=$('panel-body')?.scrollTop||0;panel='quest';render();\n if($('panel-body'))$('panel-body').scrollTop=panelScroll.quest||0;\n $('panel-root')?.querySelector('[data-a=\"quest-subpage\"][data-page=\"'+questReturnFocus+'\"]')?.focus({preventScroll:true});\n return true;\n}\n";
function guidePage(){
 const q=objective(),p=q.point;
 return `<div class="q4-page"><div class="q4-intro"><small>第${game.s.zone+1}/12境 · ${esc(game.realm)}</small><h3>${esc(game.zone.name)} · 探索指引</h3><p>内容随当前档案与本境进度更新。</p></div>
 <section class="q4-current"><strong>当前任务 · ${esc(q.title)}</strong><p>${esc(q.detail)}</p>${p?`<small>第${p.x+1}列第${p.y+1}行 · 地图「${esc(p.mark)}」字</small>`:''}</section>
 ${realmPlaybookHTML()}<div class="q4-footer"><button type="button" class="btn" data-a="quest-return">← 返回主线</button></div></div>`;
}
function worldPage(){
 const s=game.s,n=s.cleared.filter(Boolean).length;
 const status=i=>s.cleared[i]?'已平定':i===s.zone&&s.ritual[i]?'首领待战':i===s.zone?'探索中':i<s.unlocked?'已解锁':'未解锁';
 return `<div class="q4-page"><div class="q4-intro"><small>${esc(game.character.name)} · 本世修行记录</small><h3>凡界十二境</h3><p>进度依据通关数据；进入地图不代表已经平定首领。</p></div>
 <div class="q4-count"><strong>${n}/12</strong><small>${esc(game.realm)} · 第${game.day}日</small></div>
 <ol class="q4-stages">${D.ZONES.map((z,i)=>`<li class="${i===s.zone?'current':''}" ${i===s.zone?'aria-current="step"':''}><span class="q4-no">${String(i+1).padStart(2,'0')}</span><span class="q4-name"><strong>${esc(z.name)}</strong><small>${s.cleared[i]?'仪式与首领已完成':i===s.zone?esc(objective().title):i<s.unlocked?'开放探索':'等待前置条件'}</small></span><em>${status(i)}</em></li>`).join('')}</ol>
 <div class="q4-realm"><strong>修行境界</strong><p>${esc(game.character.realms.join(' → '))}</p><small>高境关卡通关后还需要在本境洞府完成主动破境。</small></div>
 <div class="q4-footer"><button type="button" class="btn" data-a="quest-return">← 返回主线</button></div></div>`;
}
function patchRelease(source){
 let h=source;
 const one=(needle,replacement)=>{let i=h.indexOf(needle);if(i<0||h.indexOf(needle,i+needle.length)>=0)throw Error('not unique: '+needle.slice(0,85));h=h.slice(0,i)+replacement+h.slice(i+needle.length)};
 const begin=' <details class="q3-fold" data-quest="guide"';
 const end='</details></section>`;\n}\nfunction questBody(){return questDisplay();}';
 let i=h.indexOf(begin),j=h.indexOf(end,i+begin.length);
 if(i<0||j<0)throw Error('fold section');
 const links=` <div class="q4-links">
 <button type="button" class="q4-link" data-a="quest-subpage" data-page="guide"><span><strong>本境探索与生存指引</strong><small>探索路线、材料与生存建议</small></span><em>查看攻略 ›</em></button>
 <button type="button" class="q4-link" data-a="quest-subpage" data-page="world"><span><strong>凡界十二境进度</strong><small>已平定 \${n}/12 · \${esc(game.realm)}</small></span><em>查看进度 ›</em></button></div>`;
 h=h.slice(0,i)+links+h.slice(j);
 one('const questFolds=new Set();',"let questReturnFocus='guide';");
 one('if(t.dataset?.quest){if(t.open)questFolds.add(t.dataset.quest);else questFolds.delete(t.dataset.quest);}','');
 one('function questBody(){return questDisplay();}', 'function questBody(){return questDisplay();}\n'+guidePage.toString()+'\n'+worldPage.toString()+'\n'+SUBPAGE_FNS);
 one("const names={birth:'命格'","const names={'quest-guide':'本境探索与生存指引','quest-world':'凡界十二境进度',birth:'命格'");
 one("panel==='quest'?questBody():game.s.logs.map","panel==='quest'?questBody():panel==='quest-guide'?guidePage():panel==='quest-world'?worldPage():game.s.logs.map");
 one("(panel==='warehouse'||panel==='cultivate')?'<button class=\"panel-back\"","isQuestChild(panel)?'<button class=\"panel-back\" data-a=\"quest-return\" aria-label=\"返回主线\">← 返回主线</button>':(panel==='warehouse'||panel==='cultivate')?'<button class=\"panel-back\"");
 one("(panel==='warehouse'||panel==='cultivate')?'返回洞府'","isQuestChild(panel)?'返回主线':(panel==='warehouse'||panel==='cultivate')?'返回洞府'");
 one("['warehouse','cultivate','manuals','tribulation','hearttrial','lore','rift','mirror','karma','dao','estate','heaven'].includes(panel)||panel==='book'&&bookDetailKey?'←':'×'","isQuestChild(panel)||['warehouse','cultivate','manuals','tribulation','hearttrial','lore','rift','mirror','karma','dao','estate','heaven'].includes(panel)||panel==='book'&&bookDetailKey?'←':'×'");
 one("panel==='quest'?'q3-body':''","panel==='quest'?'q3-body':isQuestChild(panel)?'q4-body':''");
 one("if(a==='lore-open'&&panel==='quest')","if(a==='quest-subpage'&&panel==='quest'){enterQuestChild(b.dataset.page);return;}\n if(a==='quest-return'){leaveQuestChild();return;}\n if(a==='lore-open'&&panel==='quest')");
 one("if(a==='panel-back'||a==='close-panel'){if(panel)panelScroll[panel]","if(a==='panel-back'||a==='close-panel'){if(isQuestChild(panel)){leaveQuestChild();return;}if(panel)panelScroll[panel]");
 one("else if(panel){if(['karma'","else if(panel){if(isQuestChild(panel)){leaveQuestChild();return;}if(['karma'");
 one("function openPanel(name){\n codexRecipeReturn=false;","function openPanel(name){\n if(name==='quest'&&isQuestChild(panel)){leaveQuestChild();return;}\n codexRecipeReturn=false;");
 one("codexMapReturn=false;panelScroll={};","codexMapReturn=false;panelScroll={};questReturnFocus='guide';");
 let at=h.indexOf("</head>");if(at<0)throw Error('head missing');h=h.slice(0,at)+'<style id="v904-quest">\n'+Q4_CSS+'\n</style>\n'+h.slice(at);
 one('V90.3 · 主线引导与地图标识优化版</title>','V90.4 · 主线子页面与百档通关验证版</title>');
 if((h.match(/<script\b/gi)||[]).length!==10||(h.match(/<\/html>/gi)||[]).length!==1)throw Error('bad html');
 return h;
}
module.exports={patchRelease};
if(require.main===module){const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'..');const h=fs.readFileSync(path.join(root,'releases/山野修仙记_V90.3_主线引导与地图标识优化版.html'),'utf8');fs.writeFileSync(path.join(root,'releases/山野修仙记_V90.4_主线子页面与通关验证版.html'),patchRelease(h),'utf8');console.log('V90.4 built');}
