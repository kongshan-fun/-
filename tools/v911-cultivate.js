/* ===== V90.11 修炼面板父子级重构 =====
   父页只保留摘要与入口；法门 / 破境条件 / 休整各自成子页，用返回按钮回父页。
   不新增滚动容器、不改任何既有动作与规则。 */

function isCultChild(p){return p==='cultivate-trial'||p==='cultivate-art'||p==='cultivate-rest';}

function cultivateBody(){const s=game.s,m=s.meditation.day===game.day?s.meditation.uses:0;
 const rating=globalThis.QCombatRating.live(game);
 const trialName=s.zone===5&&s.major===1?(s.character==='demon'?'妖丹血雷':'金丹雷劫'):
   s.zone===6&&s.major===2?(s.character==='demon'?'本相问心':'元婴问心'):
   s.zone===11&&s.major===8?'飞升天门':s.ascended?'飞升已成':'破境条件';
 const trialState=s.ascended?'飞升已成 · 可自由选择':
   s.zone===5&&s.major===1?(game.coreTrial.complete?'三重已渡 · 可正式破境':game.coreTrial.phase?'进行至第'+(game.coreTrial.phase+1)+'重':'尚未启劫'):
   s.zone===6&&s.major===2?(game.heartTrial.complete?'三重已过':game.heartTrial.started?'第'+(game.heartTrial.phase+1)+'重':'尚未入定'):
   '查看本境破境所需条件';
 const artTop=s.major>=2?3:s.major>=1?2:1;
 const nav=(name,title,sub,state)=>`<button type="button" class="cult-nav-row" data-a="cult-step" data-name="${name}"><span class="cult-nav-main"><b>${title}</b><small>${sub}</small></span><span class="cult-nav-right">${state||''}<i>›</i></span></button>`;
 return `<div class="inline-buttons"><button class="btn primary" data-a="panel" data-name="manuals">功法传承</button><button class="btn" data-a="panel" data-name="birth">命格 · ${esc(game.s.birth.name)}</button></div>
<h3>${game.realm} · 寿元剩余 ${game.lifeYears.toFixed(1)}年</h3>
<p class="muted">四游戏日折一年，战败额外折寿${D.LIFE.defeatYears}年。寿尽只删除当前档位。</p>
<div class="stat-chips"><span>${s.level>=18?'道行 '+s.daoXp+'/'+(game.tribulationNeed||'—'):'修为 '+s.xp+'/'+game.required}</span><span>攻击 ${s.attack+game.weapon}</span><span>防御 ${game.armor}</span><span>气血 ${s.maxHp}</span></div>
<div class="power-rating"><strong>综合战力 ${rating.total.toLocaleString('zh-CN')}</strong><small>基础 ${rating.basic} · 武器 ${rating.weapon} · 防具 ${rating.armor} · 词条 ${rating.affix} · 境界系数 ×${rating.realm}</small></div>
<div class="inline-buttons"><button class="btn primary" data-a="meditate">吐纳 ${3-m}/3</button><button class="btn" data-a="train">试剑</button></div>
<nav class="cult-nav" aria-label="修炼分区">
${nav('cultivate-trial',trialName,'本境破境所需条件与试炼入口',trialState)}
${nav('cultivate-art','境界专属法门','每日限次 · 消耗灵石与游戏时间',artTop+' 项可用')}
${nav('cultivate-rest','休整','洞府休息 · 用餐 · 休至夜间或次晨','')}
</nav>
<p class="micro">试剑与法门每天有限次，不替代仪式或首领挑战。所有条件与消耗与旧版完全一致。</p>`;}

function cultivateTrialBody(){const s=game.s;
 let advance='';
 if(s.zone>=5&&!s.ascended){const t=D.ASCENSION_STAGES[s.zone-5],ready=s.cleared[s.zone];
  advance=`<h3>破境 · ${game.realmAt(s.zone-3)}</h3>${progGuide('core')}`+
   (s.zone===5&&s.major===1?`<div class="trial-cultivate-entry"><button class="btn primary" data-a="tribulation-open">${game.coreTrial.complete?'查看雷劫记录':game.coreTrial.phase?'继续雷劫':'进入三重雷劫'}</button><p class="micro">三重雷息可提前预判：护元、纳雷或承劫。道材留到正式破境才扣除。当前 ${game.coreTrial.phase?('第'+(game.coreTrial.phase+1)+'重'):(game.coreTrial.complete?'三重已渡':'尚未启劫')}。</p></div>`:'')+
   (s.zone===6&&s.major===2?`<div class="trial-cultivate-entry"><button class="btn primary" data-a="heart-open">${game.heartTrial.complete?'回顾问心':'前往问心试炼'}</button><p class="micro">以断碑旧事、心魔幻象与自我抉择完成三重问心；原破境材料仍只扣一次。当前 ${game.heartTrial.started?('第'+(game.heartTrial.phase+1)+'重'):(game.heartTrial.complete?'三重已过':'尚未入定')}。</p></div>`:'')+
   `<button class="btn ${(s.zone===5&&s.major===1&&!game.coreTrial.complete)||(s.zone===6&&s.major===2&&!game.heartTrial.complete)?'':'primary'}" data-a="breakthrough" ${s.ascended||s.zone===5&&s.major===1&&!game.coreTrial.complete||s.zone===6&&s.major===2&&!game.heartTrial.complete?'disabled':''}>${s.zone===5&&s.major===1&&!game.coreTrial.complete?'先渡雷劫':s.zone===6&&s.major===2&&!game.heartTrial.complete?'先过问心':s.major===s.zone-4?'尝试破境':'已突破本境'}</button>`;
 }
 if(s.zone===11&&s.major===8&&!s.ascended){const f=D.ASCENSION_RULE;
  advance=`<h3>飞升天门</h3><div class="stat-chips"><span>道行 ${s.daoXp}/${f.dao}</span>${Object.entries(f.cost).map(([id,n])=>`<span>${D.ITEMS[id].name} ${game.has(id)}/${n}</span>`).join('')}</div><p>已达渡劫境。积累道行并随身携带劫雷晶和天门符，在渡劫天门的「界」格点击飞升。仙界内容尚未开放。</p><button class="btn primary" data-a="map" data-x="7" data-y="5">前往天门</button>`;
 }
 if(s.ascended)advance='<h3>飞升已成 · 自由选择</h3><p>仙界尚未开放。你可以留在人间继续探索、炼器与收集，也可以主动结束本轮领取大额轮回玉。本世首次飞升成绩已经锁定，不受此后行动影响。</p><div class="inline-buttons"><button class="btn primary" data-a="ascension-retire">结束本世 · 领取轮回玉</button><button class="btn" data-a="ranking-open">查看资质榜</button></div>';
 return advance||'<p class="muted">当前境界尚未开启大境界试炼。继续积累修为与道行即可。</p>';}

function cultivateArtBody(){const s=game.s;
 return `<h3>境界专属法门</h3><p class="muted">每天有限次，每次消耗灵石和游戏时间；不替代仪式或首领挑战。</p>`+
  `<div class="cult-art-list"><button type="button" class="btn" data-a="realm-art" data-id="sustain">炼气·调和五谷（石1）</button>`+
  (s.major>=1?'<button type="button" class="btn" data-a="realm-art" data-id="ward">筑基·护元调息（石2）</button>':'')+
  (s.major>=2?'<button type="button" class="btn" data-a="realm-art" data-id="insight">金丹·凝神参道（石2）</button>':'')+
  `</div>`+
  (s.major<1?'<p class="micro">达到筑基后可解锁「护元调息」，金丹后解锁「凝神参道」。</p>':'')+
  `<p class="micro">三者互不叠加，按当日次数独立计算。</p>`;}

function cultivateRestBody(){const s=game.s;
 return `<h3>休整</h3><div class="cult-art-list"><button type="button" class="btn" data-a="rest" data-mode="camp">洞府休息</button>`+
  `<button type="button" class="btn" data-a="rest" data-mode="supply">用餐 · 食物+清水</button>`+
  `<button type="button" class="btn" data-a="rest" data-mode="night">休至夜间</button>`+
  `<button type="button" class="btn" data-a="rest" data-mode="dawn">休至次晨</button></div>`+
  `<p class="muted">休息只恢复气血和灵力；饱腹、饮水需食物与清水补充，洞府用餐可使用本境仓房物资。高级炼器仍需对应设施。</p>`;}
