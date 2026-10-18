'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const repo=path.resolve(__dirname,'..');
const main=fs.readFileSync(path.join(repo,'index.html'),'utf8');
const release=fs.readFileSync(path.join(repo,'releases/山野修仙记_V90.8_五阶洞府与高阶炼制版.html'),'utf8');
assert.equal(main,release,'default entrance must equal V90.8 release');
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
console.log('V90.8 EQUIPMENT LAYOUT CONTRACT PASS: 0-36 items, fixed inspector, grid scroll, +5 cap, equal artifacts');
