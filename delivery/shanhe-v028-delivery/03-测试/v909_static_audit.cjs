'use strict';
/* 静态结构审计：直接统计各面板渲染函数的分区、按钮、文本密度 */
const fs = require('fs');
const s = fs.readFileSync('index.html', 'utf8');

function extract(name) {
  const marker = `function ${name}(`;
  const i = s.indexOf(marker);
  if (i < 0) return null;
  let depth = 0, started = false;
  for (let k = i; k < s.length; k++) {
    const c = s[k];
    if (c === '{') { depth++; started = true; }
    else if (c === '}') { depth--; if (started && depth === 0) return s.slice(i, k + 1); }
  }
  return null;
}

const BODIES = [
  ['characterBody', '人物'], ['packBody', '背包'], ['warehouseBody', '仓库'],
  ['craftBody', '炼制'], ['campBody', '洞府'], ['cultivateBody', '修炼'],
  ['questBody', '主线'], ['bookBody', '图鉴'], ['bookListBody', '图鉴列表'],
  ['bookDetailBody', '图鉴详情'], ['manualBody', '功法'], ['helpBody', '教程'],
  ['loreBody', '见闻'], ['settingsBody', '设置'], ['tribulationBody', '金丹雷劫'],
  ['heartTrialBody', '元婴问心'], ['bloodBody', '妖族血脉'], ['daoBody', '大道'],
  ['karmaBody', '因果'], ['mirrorBody', '镜台'], ['riftBody', '裂隙'],
  ['estateBody', '遗府'], ['heavenBody', '九霄'], ['leaderboardBody', '资质榜'],
];

const rows = [];
for (const [fn, label] of BODIES) {
  const body = extract(fn);
  if (!body) { rows.push({ fn, label, missing: true }); continue; }
  const h3 = (body.match(/<h3/g) || []).length;
  const h4 = (body.match(/<h4/g) || []).length;
  const inline = (body.match(/class="inline-buttons"/g) || []).length;
  const btn = (body.match(/class="btn/g) || []).length;
  const actions = new Set([...body.matchAll(/data-a="([a-z0-9\-]+)"/g)].map((m) => m[1]));
  const cards = (body.match(/class="[^"]*(card|row|line|item)[^"]*"/g) || []).length;
  const textRuns = [...body.matchAll(/>([^<>{}]{25,})</g)].map((m) => m[1].trim()).filter(Boolean);
  const maxText = textRuns.reduce((a, t) => Math.max(a, t.length), 0);
  const longText = textRuns.filter((t) => t.length > 90).length;
  rows.push({
    fn, label, chars: body.length, h3, h4, inline, btn,
    actions: actions.size, actionList: [...actions].join(','),
    cards, maxText, longText,
  });
}

console.log('函数               面板        字符    h3  h4 inline  btn  动作  最长文本 超90字块');
for (const r of rows) {
  if (r.missing) { console.log(`${r.fn.padEnd(18)} ${String(r.label).padEnd(10)} 未找到`); continue; }
  console.log([
    r.fn.padEnd(18),
    String(r.label).padEnd(10),
    String(r.chars).padStart(6),
    String(r.h3).padStart(3),
    String(r.h4).padStart(3),
    String(r.inline).padStart(6),
    String(r.btn).padStart(4),
    String(r.actions).padStart(5),
    String(r.maxText).padStart(8),
    String(r.longText).padStart(8),
  ].join(' '));
}

fs.writeFileSync('visual/v909-audit/static-audit.json', JSON.stringify(rows, null, 2), 'utf8');

console.log('\n=== 问题候选：分区缺失但按钮多（平铺堆叠） ===');
for (const r of rows) {
  if (r.missing) continue;
  if (r.h3 + r.h4 === 0 && r.btn >= 4) console.log(`  ${r.label}(${r.fn}) 无任何 h3/h4，却有 ${r.btn} 个按钮 / ${r.actions} 个动作`);
}

console.log('\n=== 问题候选：超长段落（>90 字块 >=2） ===');
for (const r of rows) {
  if (r.missing) continue;
  if (r.longText >= 2) console.log(`  ${r.label}(${r.fn}) 超 90 字文本块 ${r.longText} 处，最长 ${r.maxText} 字`);
}

console.log('\n=== 问题候选：动作极多（>=10 个不同动作挤在一屏） ===');
for (const r of rows) {
  if (r.missing) continue;
  if (r.actions >= 10) console.log(`  ${r.label}(${r.fn}) ${r.actions} 个动作：${r.actionList.slice(0, 140)}`);
}
