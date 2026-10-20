/* ===== V90.13 设置改为父子页 =====
   原则：一页只放同一类内容。设置里六个不同类型的分区改为父页入口 + 子页。
   不新增下拉/折叠，不改任何设置项与动作。 */

function isSetChild(p){return p==='set-save'||p==='set-life'||p==='set-char'||p==='set-visual'||p==='set-help'||p==='set-reset';}

function settingsBody(){
 const pct=Math.min(100,Math.round(game.lifeYears));
 const themeName=(()=>{const t=(document.body.className||'');return t.includes('mono')?'极简黑白':t.includes('immortal')?'流光仙境':'暖白松绿';})();
 const nav=(name,title,sub,state)=>`<button type="button" class="cult-nav-row" data-a="panel-step" data-name="${name}">`+
  `<span class="cult-nav-main"><b>${title}</b><small>${sub}</small></span>`+
  `<span class="cult-nav-right">${state||''}<i>›</i></span></button>`;
 return `<div class="v909-set">
<div class="v909-set-head"><span class="v909-set-id">V90.13 · ${game.character.name} · 档位 ${String(activeSlot).padStart(3,'0')}</span><span class="v909-set-save ${saveAvailable?'is-ok':'is-bad'}">${saveAvailable?'可本地保存':'存储受限'}</span></div>
<p class="v909-set-status">${esc(saveStatus)}</p>
${game.s.ascended?`<section class="v909-mod v909-mod-gold"><h3 class="v909-mod-title">飞升已成 · 轮回结算</h3><p class="v909-mod-hint">可在人间继续发育，或确认结束当前本世领取轮回玉；首次飞升资质成绩不随之后的岁月改变。</p><div class="v909-actions"><button class="btn primary v909-btn" data-a="ascension-retire">结束本世 · 结算轮回玉</button></div></section>`:''}
<nav class="cult-nav" aria-label="设置分区">
${nav('set-save','存档与备份','导出、导入、恢复上次备份','')}
${nav('set-life','修行状态与寿元','剩余 '+(game.lifeYears>999?999:game.lifeYears).toFixed(1)+' 年 · 倒下 '+game.s.life.losses+' 次','')}
${nav('set-char','角色与档案','人族与妖族各 100 档 · 飞升资质榜','')}
${nav('set-visual','视觉与体验',themeName,'')}
${nav('set-help','帮助与记录','行记 · 完整教程','')}
${nav('set-reset','重新修行','新开存档 · 需再次确认','')}
</nav>
<p class="micro">设置分区之间互不影响；每个子页顶部都可「← 返回设置」。</p>
</div>`;
}

function settingsChildBody(){
 const sub=panel.replace('set-','');
 if(sub==='save')return `<div class="v909-set">
<section class="v909-mod"><h3 class="v909-mod-title">存档与备份</h3><p class="v909-mod-hint">换文件路径、浏览器、设备或网址前先导出。继承旧版存档只可主动进行一次。</p><div class="v909-actions"><button class="btn primary v909-btn" data-a="export">导出存档</button><button class="btn v909-btn" data-a="import">导入存档</button><button class="btn v909-btn" data-a="restore">恢复上次备份</button></div><p class="v909-note">进度保存在本机浏览器。寿元耗尽只删除当前种族的当前档位及其备份，不影响其他档位；外部 JSON 仍可手动回档。</p></section>
<p class="v909-set-status">${esc(saveStatus)}</p></div>`;
 if(sub==='life')return `<div class="v909-set">
<section class="v909-mod"><h3 class="v909-mod-title">修行状态与寿元</h3><div class="v909-kv"><span>剩余寿元</span><b>${game.lifeYears.toFixed(1)} 年</b></div><div class="v909-kv"><span>倒下次数</span><b>${game.s.life.losses} 次</b></div><div class="v909-kv"><span>延寿丹</span><b>${game.s.life.elixirs}/${D.LIFE.elixirLimit}</b></div><div class="v909-actions"><button class="btn primary v909-btn" data-a="ad-life" ${simulatedLifeAdReady()?'':'disabled'}>${game.s.combat?'斗法中不可使用':game.lifeYears>15?'寿元低于16年时可领':'领取10年寿元'}</button></div><p class="v909-note">寿元剩余 15 年以内时，每次达到条件可领取 10 年寿元；每世不限次数，但每次须重新满足条件。领取无真实广告、无网络请求、不消耗轮回玉。寿元归零会清除当前档位及其备份，寿尽后不能复活。</p></section></div>`;
 if(sub==='char')return `<div class="v909-set">
<section class="v909-mod"><h3 class="v909-mod-title">角色与档案</h3><p class="v909-mod-hint">人族与妖族各 100 个独立档位；各档命格、寿元、背包、地图与洞府完全独立。</p><div class="v909-actions"><button class="btn primary v909-btn" data-a="characters">种族与百档档案</button><button class="btn v909-btn" data-a="ranking-open">本机飞升资质榜</button></div><p class="v909-note">飞升榜仅在本机保存、可导出 JSON，不是已接入云端的公开排行榜。</p></section></div>`;
 if(sub==='visual')return `<div class="v909-set">
<section class="v909-mod"><h3 class="v909-mod-title">视觉与体验</h3><div class="theme-picker v909-themes" role="group" aria-label="视觉主题"><button class="btn theme-choice" data-a="theme-set" data-theme="forest" aria-pressed="false">暖白松绿</button><button class="btn theme-choice" data-a="theme-set" data-theme="mono" aria-pressed="false">极简黑白</button><button class="btn theme-choice" data-a="theme-set" data-theme="immortal" aria-pressed="false">✦ 流光仙境</button></div><div class="v909-actions"><button class="btn v909-btn" data-a="motion">${game.s.settings.motion?'减少动效':'恢复动效'}</button></div><p class="v909-note">三种主题可自由切换。流光仙境包含灵光与粒子动效；「减少动效」会关闭过渡与动画，不影响任何操作与显示。</p></section></div>`;
 if(sub==='help')return `<div class="v909-set">
<section class="v909-mod"><h3 class="v909-mod-title">帮助与记录</h3><div class="v909-actions"><button class="btn v909-btn" data-a="panel" data-name="log">行记</button><button class="btn v909-btn" data-a="panel" data-name="help">完整教程</button></div><p class="v909-note">当前版本 V90.13：设置改为分区进入；炼制按品类与品阶进入；洞府设施回归本体展示。</p></section></div>`;
 return `<div class="v909-set">
<section class="v909-mod v909-mod-danger"><h3 class="v909-mod-title">重新修行</h3><p class="v909-mod-hint">新开存档需要再次确认，不会删除旧版存档。当前档位的命格、寿元与背包会被新档取代。</p><div class="v909-actions"><button class="btn warn v909-btn" data-a="reset">新开存档</button></div></section></div>`;
}
