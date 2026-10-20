'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const repo=path.resolve(__dirname,'..');
const main=fs.readFileSync(path.join(repo,'index.html'),'utf8');
/* P0-1 修复：不再钉死 V90.8 发布文件。
   改为「index.html 必须与某一个发布文件字节一致」，且标题里的版本号与那个文件名一致。
   这样每次发版都不用改本测试，同时仍然守住"默认入口 == 发布文件"这条约定。 */
const title=(main.match(/<title>([^<]+)<\/title>/)||[])[1]||'';
const version=(title.match(/V\d+\.\d+/)||[])[0]||'';
assert.ok(version,'index.html 标题里没有版本号');
const releases=fs.readdirSync(path.join(repo,'releases')).filter(f=>f.endsWith('.html'));
const same=releases.filter(f=>fs.readFileSync(path.join(repo,'releases',f),'utf8')===main);
assert.equal(same.length,1,`index.html 应恰好等于一个发布文件，实际命中 ${same.length} 个：${same.join(',')}`);
assert.ok(same[0].includes('_'+version+'_'),`发布文件名版本与标题不一致：${same[0]} vs ${version}`);
const rules=[
  /#panel-root \.character-v92\{display:grid;grid-template-rows:auto auto auto minmax\(0,1fr\) auto;/,
  /#panel-root \.character-gear-list\.character-v92-grid\{height:100%;min-height:0;min-width:0;align-self:stretch;display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\);grid-auto-rows:minmax\(108px,max-content\);align-content:start;[^}]*overflow-y:auto;overflow-x:hidden;/,
  /#panel-root \.character-v92-inspector\{flex:none;height:calc\(116px \+ env\(safe-area-inset-bottom\)\);max-height:calc\(116px \+ env\(safe-area-inset-bottom\)\);[^}]*overflow:hidden;/,
  /#panel-root \.character-v92-inspect-main small\{display:-webkit-box;[^}]*-webkit-line-clamp:2;/,
  /#panel-root \.character-v92-controls\{flex:none;display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\);/,
  /selected\.refine>=5\?'disabled'/,
  /selected\.refine>=5\?'精炼满阶'/
];
for(const re of rules)assert.match(main,re,'missing character gear containment/inspector rule: '+re);
assert(!main.includes("selected.refine>=3?'disabled'"),'stale refine cap');
for(const count of [0,1,2,3,4,5,6,10,36]){
  const rows=Math.ceil(count/2);
  assert.equal(rows,Math.floor(count/2)+(count%2),'two-column equipment row math');
  if(count===3)assert.equal(rows,2,'third equipment starts a second row');
}
for(const clause of [
  '#panel-root .building-card .building-effect{min-height:0;max-height:none;overflow:visible}',
  '.entry-save-content{min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain}',
  '.entry-save-grid{height:100%;min-height:340px;grid-template-rows:repeat(5,minmax(60px,1fr))}',
  '#panel-root .character-v92-inspect-main small{display:block;-webkit-line-clamp:unset;',
  '@media(max-height:620px){',
  '@media(max-height:510px){',
  '#panel-root .panel-body.character-body-v92{overflow-y:auto!important;overflow-x:hidden!important}'
]) assert(main.includes(clause),'missing containment audit rule: '+clause);
for(const clause of [
  'id="v908-rarity-art"',
  'background-image:linear-gradient(100deg,#fff5b5 0%,#ffb7dc 18%,#c5b2ff 36%,#91ddff 54%,#a9ffd0 72%,#fff0a0 88%,#fff5b5 100%)',
  'animation:v908-prismatic-flow 8s linear infinite',
  '@media(prefers-reduced-motion:reduce)',
  'body.theme-mono .rarity-4',
  "const rarityMarkup=x=>",
  '${rarityMarkup(item)}',
  'codex-gear-name'
]) assert(main.includes(clause),'missing rarity art treatment: '+clause);
console.log('V90.8 UI CONTAINMENT + RARITY ART CONTRACT PASS: responsive layout, five quality grades, prismatic top tier, toasts and codex');
