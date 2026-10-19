/* ===== V90.9 阶段成长指引（只读呈现层，不建立第二套进度账本） =====
   全部数据直接读取现有存档与现有配置表：
   game.s（ritual / cleared / level / daoXp / settlements / hunger / water / spirit）
   D.ASCENSION_STAGES、D.ITEMS、D.RES、D.RESOURCE_LAYOUT、D.ZONES
   任何判定都不写回存档，也不改变既有规则。 */

function progStage(){
  const s=game.s;
  if(s.zone<5) return null;
  const st=D.ASCENSION_STAGES[s.zone-5];
  const prev=D.ASCENSION_STAGES[s.zone-6];
  return st?{st,cur:prev?prev.realm:'筑基',goal:st.realm}:null;
}

/* 材料来源：由 RES.loot -> RESOURCE_LAYOUT -> ZONES.map 逐层真实推导 */
function progMatSource(id){
  const s=game.s, zi=s.zone;
  const hits=[];
  for(const [rid,res] of Object.entries(D.RES)){
    if(!res||!res.loot||!(id in res.loot))continue;
    hits.push({rid,res});
  }
  if(!hits.length)return null;
  const zones=[zi].concat(D.ZONES.map((_,i)=>i).filter(i=>i!==zi));
  for(const rid of hits.map(h=>h.rid)){
    for(const z of zones){
      const zz=D.ZONES[z];
      if(!zz||!zz.map)continue;
      const terrains=new Set();
      for(const row of zz.map)for(const t of row){
        const layout=D.RESOURCE_LAYOUT[t];
        if(layout&&layout.includes(rid))terrains.add(t);
      }
      if(terrains.size){
        const res=hits.find(h=>h.rid===rid).res;
        return {zone:z,zoneName:zz.name,res,terrainCount:terrains.size,
                tool:res.tool?D.TOOLS?.[res.tool]?.name||res.tool:null,minutes:res.minutes};
      }
    }
  }
  return null;
}

/* 条件清单：镜像 coreTrialReason / heartTrialReason 的判定项，但一次全部返回 */
function progRows(kind){
  const s=game.s, p=progStage(), rows=[];
  const ok=(label,pass,text,extra)=>({label,pass:!!pass,text,extra:extra||''});
  const zi=s.zone, z=D.ZONES[zi]||{};
  rows.push(ok('所在境域', s.zone===zi, (z.name||'')+(z.short?' · '+z.short:'')));
  rows.push(ok('本境问道坛', s.ritual[zi], s.ritual[zi]?'已完成':'未完成'));
  rows.push(ok('本境首领', s.cleared[zi], s.cleared[zi]?'已击败':'未击败'));
  if(p){
    rows.push(ok('等级要求', s.level>=18, s.level+'/18'));
    rows.push(ok('道行', s.daoXp>=p.st.needDao, s.daoXp+'/'+p.st.needDao));
    for(const [id,n] of [[p.st.primary,2],[p.st.secondary,1]]){
      const item=D.ITEMS[id]||{name:id};
      const inv=s.inv[id]||0, stash=(game.storageReady?s.settlements[zi]?.stash?.[id]:0)||0;
      const have=game.has(id);
      rows.push(ok(item.name, have>=n, have+'/'+n,
        '随身 '+inv+(stash?' · 仓库 '+stash:'')));
    }
  }
  const camp=s.settlements[zi];
  rows.push(ok('本境洞府', !!camp, camp?'已建立':'尚未建立'));
  rows.push(ok('位于本境洞府', game.atCamp, game.atCamp?'是':'否'));
  if(kind==='core'){
    const t=game.coreTrial;
    rows.push(ok('三重雷劫', t.complete, t.phase+'/3'+(t.complete?'（已渡）':t.started?'（进行中）':'（未启）')));
  }else if(kind==='heart'){
    const h=game.heartTrial;
    rows.push(ok('三重问心', h.complete, h.phase+'/3'+(h.complete?'（已过）':h.started?'（入定中）':'（未启）')));
  }
  rows.push(ok('饱腹', s.hunger>2, String(s.hunger)));
  rows.push(ok('饮水', s.water>2, String(s.water)));
  if(kind==='core'||kind==='heart'){
    rows.push(ok('灵力', s.spirit>=3, s.spirit+'/'+s.maxSpirit));
  }
  return rows;
}

/* 下一步：只在所有未完成项中取最关键的一条，避免多个同等醒目的按钮 */
function progNext(kind){
  const s=game.s, p=progStage(), zi=s.zone, z=D.ZONES[zi]||{};
  if(!p) return null;
  if(!s.ritual[zi]) return {label:'前往本境问道坛完成仪式',hint:(z.altar||'问道坛')+'需要 '+(z.need?Object.entries(z.need).map(([k,n])=>(D.ITEMS[k]?.name||k)+'×'+n).join('、'):'仪式材料'),act:null};
  if(!s.cleared[zi]) return {label:'前往本境首领处',hint:'首领：'+(p.st.bossName||z.boss||'本境首领'),act:null};
  if(s.level<18) return {label:'修炼提升等级',hint:'当前 '+s.level+'/18，可打坐或采集积累修为',act:'meditate'};
  if(s.daoXp<p.st.needDao) return {label:'继续积累道行',hint:'道行 '+s.daoXp+'/'+p.st.needDao+'，问道坛、试炼与主线推进都会增长',act:'meditate'};
  const miss=[];
  for(const [id,n] of [[p.st.primary,2],[p.st.secondary,1]]){
    if(game.has(id)<n){
      const it=D.ITEMS[id]||{name:id}, src=progMatSource(id);
      miss.push({name:it.name,need:n,have:game.has(id),src});
    }
  }
  if(miss.length){
    const m=miss[0];
    const where=m.src?(m.src.zoneName+'的'+m.src.res.name+'（约 '+(m.src.tool?'需'+m.src.tool+'，':'')+'每次 '+m.src.minutes+' 分钟）'):'详细来源见图鉴';
    return {label:'采集 '+m.name+'（缺 '+(m.need-m.have)+'）',hint:where,act:'codex-open',args:'book'};
  }
  if(!s.settlements[zi]) return {label:'在本境建立洞府',hint:'破境须在本境洞府静修',act:'build'};
  if(!game.atCamp) return {label:'返回本境洞府',hint:'当前不在洞府坐标，无法静修破境',act:null};
  if(kind==='core'&&!game.coreTrial.complete) return {label:game.coreTrial.started?'继续三重雷劫（第'+(game.coreTrial.phase+1)+'重）':'进入三重雷劫',hint:'雷劫未渡，无法正式破境',act:'tribulation-open'};
  if(kind==='heart'&&!game.heartTrial.complete) return {label:game.heartTrial.started?'继续三重问心（第'+(game.heartTrial.phase+1)+'重）':'进入三重问心',hint:'问心未过，无法正式破境',act:'heart-open'};
  if(s.hunger<=2||s.water<=2) return {label:'先用餐与补水',hint:'饱腹 '+s.hunger+'、饮水 '+s.water+'，过低会在破境时额外扣血',act:null};
  return {label:'正式突破 · '+p.goal,hint:'全部条件已满足，消耗道材后破境',act:'breakthrough'};
}

function progGuide(kind){
  const s=game.s, p=progStage();
  if(!p) return '';
  const rows=progRows(kind), next=progNext(kind);
  const done=rows.filter(r=>r.pass).length;
  const btn=next?next.act
    ? `<button class="btn primary prog-act" data-a="${next.act}"${next.args?` data-name="${next.args}"`:''}>${esc(next.label)}</button>`
    : `<p class="prog-hint">${esc(next.hint)}</p>`
    : '';
  return `<section class="prog-card" aria-label="阶段成长指引">
<div class="prog-head"><span class="prog-realm">${esc(p.cur)} → ${esc(p.goal)}</span><span class="prog-prog">${done}/${rows.length}</span></div>
<p class="prog-where">${esc(D.ZONES[s.zone]?.name||'')} · 第 ${s.zone+1} 境</p>
<div class="prog-rows">${rows.map(r=>`<div class="prog-row ${r.pass?'ok':'no'}"><span class="prog-mark">${r.pass?'✓':'✗'}</span><span class="prog-label">${esc(r.label)}</span><span class="prog-val">${esc(r.text)}</span>${r.extra?`<small class="prog-extra">${esc(r.extra)}</small>`:''}</div>`).join('')}</div>
${next?`<div class="prog-next"><strong>下一步</strong><span>${esc(next.hint)}</span></div>`:''}
${btn}
</section>`;
}
