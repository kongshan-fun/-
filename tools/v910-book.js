function bookListBody(){
 let rows=bookRows().filter(r=>filter==='all'||r.cat===filter).filter(r=>!search||((r.known||r.cat==='bag')?r.name:'未发现').includes(search)||r.hint.includes(search));
 const claimable=D.BOOK_REWARDS.filter(r=>!game.s.codex.claims[r.id]&&game.bookCount>=r.need).length;
 const rewards=`<details class="book-rewards-fold"><summary><span>图鉴成就 ${game.bookCount}/192</span><span class="book-rewards-flag">${claimable?'可领 '+claimable+' 项':'暂无可领'}</span></summary><div class="book-rewards">${D.BOOK_REWARDS.map(r=>`<div class="reward-line"><span>${r.name} · ${game.bookCount}/${r.need}</span><button class="btn" data-a="claim-book" data-id="${r.id}" ${game.s.codex.claims[r.id]?'disabled':''}>${game.s.codex.claims[r.id]?'已领':game.bookCount>=r.need?'领取':'未达成'}</button></div>`).join('')}</div></details>`;
 rows.sort((a,b)=>Number(b.known)-Number(a.known));
 const LABEL={item:'资源',life:'灵物',mineral:'矿材',tool:'工具',bag:'永久储物袋',food:'食物与丹药',enemy:'妖兽',gear:'装备法器',home:'洞府建筑',secret:'秘境',zone:'境域',realm:'修炼'};
 const ORDER=['item','life','mineral','tool','bag','food','gear','enemy','home','secret','zone','realm'];
 const groups={};
 for(const r of rows)(groups[r.cat]=groups[r.cat]||[]).push(r);
 const openAll=!!search||filter!=='all';
 const entry=r=>`<button class="book-entry book-entry-link ${r.known?'vis-book-'+r.cat:'unknown'}" data-a="book-open" data-key="${r.key}"><span class="book-entry-main"><span class="book-entry-title ${r.cat==='gear'?'codex-gear-name':''}">${r.known||r.cat==='bag'?esc(r.name):'未发现'}</span><span class="book-entry-sub">${r.known||r.cat==='bag'?({item:'资源',life:'灵物',mineral:'矿材',tool:'工具',bag:'永久储物袋',food:'食物与丹药',enemy:'妖兽',gear:'装备法器',home:'洞府建筑',secret:'秘境',zone:'境域',realm:'修炼'}[r.cat]||'已发现条目'):'尚未发现 · 点击查看线索'}</span></span><span class="book-entry-arrow">${r.known?'已识':'线索'} ›</span></button>`;
 const list=Object.keys(groups).sort((a,b)=>{const ia=ORDER.indexOf(a),ib=ORDER.indexOf(b);return (ia<0?99:ia)-(ib<0?99:ib);}).map(cat=>{
   const items=groups[cat],known=items.filter(r=>r.known||r.cat==='bag').length;
   return `<details class="book-group"${openAll?' open':''}><summary><span>${LABEL[cat]||'其他'}</span><span class="book-group-count">${known}/${items.length}</span></summary><div class="book-group-body">${items.map(entry).join('')}</div></details>`;
 }).join('')||'<div class="empty">没有符合条件的条目</div>';
 return `<div class="book-list">${rewards}${list}</div>`;
}
