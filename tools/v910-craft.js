function craftBody(){const rows=D.RECIPES.filter(r=>(r.zone||0)<game.s.unlocked).filter(r=>filter==='all'||(filter==='bag'?!!r.storageBag:filter==='tool'?r.type==='工具':filter==='gear'?!!(r.gear||r.flag):r.type==='丹药'||r.type==='食物'));
 const stat=r=>{const done=(r.storageBag&&game.hasStorageBag(r.storageBag))||(r.unique&&game.has(r.item))||(r.flag&&game.s.flags[r.flag]);const wrong=game.recipeRequirement(r);return {done,wrong,ok:!done&&!wrong&&game.enough(r.cost)};};
 const counts={ok:0,mat:0,other:0};
 for(const r of rows){const s=stat(r);if(s.ok)counts.ok++;else if(!s.wrong)counts.mat++;else counts.other++;}
 const bar=`<div class="craft-summary"><span class="craft-ok">可炼制 ${counts.ok}</span><span>缺材料 ${counts.mat}</span><span>未就绪 ${counts.other}</span><span class="craft-total">共 ${rows.length}</span></div>`;
 const sorted=[...rows].sort((a,b)=>{const ra=stat(a),rb=stat(b);const ka=ra.ok?0:ra.wrong?2:1,kb=rb.ok?0:rb.wrong?2:1;return ka-kb;});
 return bar+sorted.map(r=>{const s=stat(r),done=s.done,wrong=s.wrong;
   const miss=Object.keys(r.cost).filter(k=>game.has(k)<(r.cost[k]||0));
   const src=miss.length?progMatSource(miss[0]):null;
   const hint=src?`${(D.ITEMS[miss[0]]&&D.ITEMS[miss[0]].name)||miss[0]} 见于 ${src.zoneName} · ${src.res.name}`:'';
   return `<div class="recipe${s.ok?' recipe-ready':''}" id="recipe-${r.id}"><div class="recipe-top"><b>${r.name}</b><small>${r.storageBag?'负重 +'+D.STORAGE_BAGS.find(b=>b.id===r.storageBag).bonus:r.gear?'基础'+(r.gear==='weapon'?'攻击':'防御')+'+'+r.bonus:r.type}</small></div><div class="recipe-cost">${cost(r.cost)}</div><div class="recipe-bottom"><span>${r.room?D.BUILDINGS[r.room].name+' '+r.tier+'阶':r.home?'洞府炼制':'随身可制'}${wrong?' · '+wrong:r.storageBag?' · 本档永久生效，不叠加':r.gear?' · 品质随机':''}</span><button class="btn ${s.ok?'primary':''}" data-a="craft" data-id="${r.id}" ${done?'disabled':''}>${done?'已拥有':wrong?'缺设施':game.enough(r.cost)?'炼制':'缺材料'}</button></div>${hint?`<div class="recipe-hint">采集：${esc(hint)}</div>`:''}</div>`;}).join('');}
