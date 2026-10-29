/* V90.77 UI in the existing closure; no alternate demo-only UI. */
function biguStatus977(info=game.biguInfo()){
 return ({locked:'第七境解锁',off:'尚未开启',ended:'寿尽待处理',combat:'斗法中暂停',recovery:'回灵中暂停',reserve:'储备不足 · 暂停',active:'已开启 · 生效中'})[info.reason];
}
function biguCard977(){
 const i=game.biguInfo();return `<section class="bigu977-card" aria-label="灵息辟谷"><div class="bigu977-top"><div><span class="bigu977-glyph" aria-hidden="true">息</span><strong>灵息辟谷</strong></div><button id="bigu-toggle" class="bigu977-switch" data-a="bigu-toggle" role="switch" aria-checked="${i.enabled}" aria-label="消耗${esc(i.energy)}抵扣普通饥渴" ${!i.unlocked?'disabled':''}>${i.enabled?'已开启':'未开启'}<i aria-hidden="true"></i></button></div><div class="bigu977-metrics"><span>自然消耗 <b>${i.percent}%</b></span><span class="bigu977-state ${i.reason==='reserve'?'is-paused':''}">${esc(biguStatus977(i))}</span></div><p class="bigu977-explain">${i.unlocked?'每 1 点'+esc(i.energy)+'抵扣合计 2 点普通饥渴；保留至少四成能量。':'自然减耗随境界自动生效；第七境起，可额外消耗'+esc(i.energy)+'维持生机。'}</p><div class="bigu977-foot"><small>${i.unlocked?esc(i.energy)+' '+game.s.spirit+' / '+game.s.maxSpirit+' · 保底 '+i.reserve:'当前：'+esc(i.label)+' · 无需手动开启减耗'}</small><button data-a="bigu-rules" class="bigu977-link">规则</button></div></section>`;
}
// A compact parent page. The feature is not another long dashboard or nested
// accordion; its setting and actual pause reason are visible together.
cultivateBody=function(){
 const s=game.s,m=s.meditation.day===game.day?s.meditation.uses:0,i=game.biguInfo(),rating=QCombatRating.live(game);
 const trial=s.ascended?'飞升已成':s.level>=36?'飞升天门':game.needsTribulation?'渡劫 · 入下一境':'晋升 · 入下一境';
 const ready=game.stageIndex===3&&s.xp>=game.required;
 const note=s.ascended?'继续修行或结算本世':ready?'本境修为已满 · 查看条件':'修满本境后期再行破境';
 const nav=(name,title,hint)=>`<button class="cult-nav-row" data-a="cult-step" data-name="${name}"><span class="cult-nav-main"><b>${title}</b><small>${hint}</small></span><span class="cult-nav-right">›</span></button>`;
 return `<div class="cult977"><div class="cult977-head"><strong>${esc(game.realm)}</strong><span>第 ${game.realmIndex} 境 · 寿 ${game.lifeYears.toFixed(1)} 年</span></div><div class="cult977-stats"><span>修为 <b>${s.xp.toLocaleString('zh-CN')}</b> / ${game.required.toLocaleString('zh-CN')}</span><span>战力 ${rating.total.toLocaleString('zh-CN')}</span></div><div class="cult977-actions"><button class="btn primary" data-a="meditate">吐纳 ${Math.max(0,3-m)}/3</button><button class="btn" data-a="train">试剑</button><button class="btn" data-a="panel" data-name="manuals">功法</button><button class="btn" data-a="panel" data-name="birth">命格</button></div>${biguCard977()}<nav class="cult-nav cult977-nav" aria-label="修炼分区">${nav('cultivate-trial',trial,note)}${nav('cultivate-art','境界法门','每日限次 · 灵石与游戏时间')}${nav('cultivate-rest','休整与补给','用餐、休息 · 辟谷不代替回血')}</nav></div>`;
};
function biguRules977(){
 const i=game.biguInfo();return `<div class="bigu977-dialog"><div class="kicker">修行法门 · 随境而进</div><h2 id="bigu-title" tabindex="-1">灵息辟谷</h2><p class="bigu977-lead">减轻凡俗食水之需，不另设资源池。</p><div class="bigu977-stages">${D.BIGU.tiers.map((t,n)=>`<div class="${t.from===i.tier?'current':''}"><span>第 ${t.from}–${[4,6,8,10,12][n]} 境</span><b>消耗 ${t.percent}%</b></div>`).join('')}</div><div class="bigu977-rules"><p>自然减耗始终有效；第七境可自选开启能量抵扣。</p><p>每 1 点${esc(i.energy)}抵扣合计 2 点普通饱腹、饮水消耗。先保障行动所需，再保留四成能量。</p><p>斗法、调息、休整、吐纳暂停额外抵扣；环境额外饮水照常消耗。</p><p>不补满食水、不直接回血。小数消耗和未用抵扣额度随档保存，刷新不清零。</p></div><button class="btn primary bigu977-confirm" data-a="modal-close">明白了</button></div>`;
}
function biguAwakening977(){
 const i=game.biguInfo(),isOld=modal?.oldArchive;
 return `<div class="bigu977-dialog bigu977-awakening"><div class="bigu977-seal" aria-hidden="true">息</div><div class="kicker">${isOld?'修行法门已适配 · 旧档直接领悟':'突破领悟 · 新能力'}</div><h2 id="bigu-title" tabindex="-1">灵息辟谷</h2><p class="bigu977-lead">${game.s.character==='demon'?'妖元周流，渐脱五谷之需。':'真元周流，渐脱五谷之需。'}</p><div class="bigu977-gift"><span>境界自然减耗 <small>无需开启</small></span><strong>−${i.reduction}%</strong></div><div class="bigu977-rules"><p>开启后，每 1 点${esc(i.energy)}抵扣合计 2 点普通饥渴消耗。</p><p>保留至少四成能量；斗法与回灵修行时暂停。环境额外饮水仍需自行补给。</p></div><label class="bigu977-choice"><input id="bigu-enable-now" type="checkbox" ${i.enabled?'checked':''}><span><b>立即开启灵息辟谷</b><small>可随时在「洞府 → 修炼」修改</small></span></label><div class="bigu977-dialog-actions"><button class="btn" data-a="bigu-later">暂不开启</button><button class="btn primary" data-a="bigu-confirm">确认领悟</button></div><p class="bigu977-memo">不勾选也能享受境界自然减耗。</p></div>`;
}
const renderModal977=renderModal;
renderModal=function(){
 if(!modal||!['bigu-awakening','bigu-rules'].includes(modal.kind))return renderModal977();
 const r=$('modal-root');syncLayers();
 r.innerHTML=`<div class="modal-backdrop"><div class="modal bigu977-modal" role="dialog" aria-modal="true" aria-labelledby="bigu-title" tabindex="-1">${modal.kind==='bigu-awakening'?biguAwakening977():biguRules977()}</div></div>`;
 requestAnimationFrame(()=>r.querySelector('#bigu-title')?.focus({preventScroll:true}));
};
function commitBigu977(change){
 const before=game.s.bigu?QGame.copy(game.s.bigu):null;game.s.bigu=game.biguRecord();change(game.s.bigu);
 if(!persist()){if(before)game.s.bigu=before;else delete game.s.bigu;notify('设置未能保存，已保持原选择，请检查存储空间','warn');return false;}
 return true;
}
function checkBiguNotice977(oldArchive=false){
 if(!activeRole||frontPage||!game||game.s.ended||deathBoot||game.s.combat||modal)return;
 const i=game.biguInfo();if(i.tier<5||i.noticeTier>=i.tier)return;
 if(i.unlocked&&i.noticeTier<7){if(!oldArchive&&panel==='cultivate-trial'){panel='cultivate';render();}showModal({kind:'bigu-awakening',oldArchive});return;}
 if(commitBigu977(b=>{b.noticeTier=i.tier;}))notify(i.label+' · 自然饥渴消耗降低 '+i.reduction+'%','ok');
}
function acceptBigu977(enabled){
 if(!game.biguInfo().unlocked)return;
 const i=game.biguInfo();
 if(!commitBigu977(b=>{b.enabled=enabled;b.noticeTier=i.tier;}))return;
 closeModal();render();notify(enabled?'已开启灵息辟谷 · '+biguStatus977():'已领悟 · 暂不开启，境界减耗仍有效','ok');
}
const selectCharacter977=selectCharacter;
selectCharacter=function(...args){selectCharacter977(...args);checkBiguNotice977(args[1]!=='new');};
const flush977=flush;
flush=function(result){const r=flush977(result);checkBiguNotice977(false);return r;};
const handle977=handle;
handle=function(a,b){
 if(a==='bigu-confirm'&&modal?.kind==='bigu-awakening'){acceptBigu977(!!$('bigu-enable-now')?.checked);return;}
 if((a==='bigu-later'||a==='modal-close')&&modal?.kind==='bigu-awakening'){acceptBigu977(false);return;}
 if(a==='bigu-rules'&&activeRole&&!frontPage){showModal({kind:'bigu-rules'});return;}
 if(a==='bigu-toggle'&&activeRole&&panel==='cultivate'&&!modal){
  const info=game.biguInfo();if(!info.unlocked||game.s.ended||game.s.combat)return;
  if(commitBigu977(s=>{s.enabled=!info.enabled;s.noticeTier=info.tier;})){renderPanel();notify(!info.enabled?'灵息辟谷已开启 · 能量不足时自动暂停':'已关闭额外抵扣 · 境界自然减耗仍有效','ok');}return;
 }
 const r=handle977(a,b);checkBiguNotice977(false);return r;
};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal?.kind==='bigu-awakening'){e.preventDefault();e.stopImmediatePropagation();acceptBigu977(false);}},true);
const combat977=renderCombatPanel;
renderCombatPanel=function(){
 let out=combat977();const i=game.biguInfo();
 if(i.unlocked&&i.enabled)out=out.replace('<div class="cb-log-wrap">','<div class="bigu977-combat-note">灵息辟谷 · 斗法中暂停抵扣，'+esc(i.energy)+'优先用于战斗</div><div class="cb-log-wrap">');
 return out;
};
