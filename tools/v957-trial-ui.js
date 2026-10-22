/* V90.57 修炼页面：引擎试算和实际扣血共享 tribPreview() 口径。 */
function cultivateTrialBody(){
 const s=game.s;
 if(s.ascended)return '<h3>飞升已成 · 自由探索</h3><p>第十二境已渡，仙界尚未开放。可以继续搜集或结束本世结算。</p><button class="btn primary" data-a="ascension-retire">结束本世 · 领取轮回玉</button>';
 const final=s.level===36,preview=game.tribPreview(final),full=game.stageIndex===3&&s.xp>=game.required;
 const where=final?(s.zone===11&&game.land()==='gate'):(game.atCamp);
 const conditions=progRows('current');
 const next=progNext('current');
 const canAct=next.act===(final?'ascend':'breakthrough');
 const head=final?'第十二重 · 飞升终劫':'渡劫 · '+game.realm+' → 下一境';
 const actionBtn=final?`<button class="btn ${canAct?'primary':''}" data-a="ascend" ${canAct?'':'disabled'}>${canAct?'飞升 · 承受第十二重天劫':esc(next.label)}</button>`:`<button class="btn ${canAct?'primary':''}" data-a="breakthrough" ${canAct?'':'disabled'}>${canAct?'渡劫 · 承受固定伤害':esc(next.label)}</button>`;
 return `<section class="trial-page v957-tribulation"><div class="trial-intro"><small>第 ${game.realmIndex}/12 境 · ${esc(game.realm)} · 后期修满后触发</small><h3>${head}</h3><p>固定扣血，不掷概率也不要求旧版三重试炼；护劫丹每颗减伤15%，最多两颗。${final?'终劫通过后才会正式飞升，结算后气血恢复至满值。':'渡劫在本境洞府执行；结算后按下一境的气血上限显示。'}</p></div><div class="stat-chips"><span>本次伤害 ${preview.damage}</span><span>你的气血上限 ${s.maxHp}</span><span>渡劫后剩余 ${preview.percent}%</span></div><p class="muted">当前气血 ${s.hp}/${s.maxHp} · 当前修为 ${s.xp}/${game.required} · 护劫丹 ${preview.pills} 颗。${preview.survivalDamage?'食水耗尽将额外扣血 '+preview.survivalDamage+'；请先补给。':'本次行动无额外饥渴扣血预期。'}预计成功时气血 ${preview.hpAfter}/${preview.maxAfter}。</p><div class="prog-rows" aria-label="渡劫条件清单">${conditions.map(r=>`<div class="prog-row ${r.pass?'ok':'no'}"><span class="prog-mark">${r.pass?'✓':'·'}</span><span class="prog-label">${esc(r.label)}</span><span class="prog-val">${esc(r.text)}</span></div>`).join('')}</div><p class="trial-note">${esc(next.hint)}</p>${actionBtn}${!full?'<p class="micro">只有后期修满才显示可执行的渡劫按钮；初中期修满会自动升到下一段。</p>':''}</section>`;
}
