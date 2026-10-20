'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),release=path.join(root,'releases');
const baseline=fs.readFileSync(path.join(release,'山野修仙记_V90.1_饥渴时间结算修正版.html'),'utf8');
const html=fs.readFileSync(path.join(release,'山野修仙记_V90.2_人物装备界面优化版.html'),'utf8');
const build=require('../tools/build-v902-character.cjs').buildV902;
assert.equal(html,build(baseline),'Build must deterministically reproduce V90.2');
const extract=s=>[...s.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
const curr=extract(html),orig=extract(baseline);
assert.equal(curr.length,10,'Expected exactly ten scripts');
assert.equal((html.match(/<\/html>/gi)||[]).length,1);
curr.forEach((s,i)=>new vm.Script(s,{filename:'v902-script-'+i}));
for(let i=0;i<curr.length;i++)if(i!==7)assert.equal(curr[i],orig[i],'Non-UI gameplay module changed at '+i);
assert(html.includes('id="v902-character-layout"'));
const style=html.match(/<style id="v902-character-layout">([\s\S]*?)<\/style>/)?.[1]||'';
assert(style.includes('.character-gear-list.character-v92-grid'));
assert(style.includes('grid-template-columns:repeat(2,minmax(0,1fr))'));
assert(style.includes('overflow-y:auto'));
assert(!style.includes('.character-v92 .character-top'));
assert(html.includes('character-body-v92'));
assert(!curr[7].includes('character-v66'));
assert(curr[7].includes("a==='character-gear-select'")&&curr[7].includes("a==='character-salvage-confirm'"));
const ctx=vm.createContext({console});ctx.globalThis=ctx;
for(let i=0;i<=4;i++)vm.runInContext(curr[i],ctx,{timeout:8000});
ctx.D=ctx.QData;
ctx.esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
ctx.activeRole='human';ctx.activeSlot=1;
const ui=curr[7],from=ui.indexOf("let characterGearFilter='all'"),to=ui.indexOf('function campBody(){',from);
assert(from>=0&&to>from);
vm.runInContext(ui.slice(from,to)+'\nglobalThis.characterRenderTest=characterBody;',ctx,{timeout:8000});
let checks=19;
const check=(label,yes)=>{assert.ok(yes,label);checks++};
const recipes=ctx.D.RECIPES.filter(r=>r.gear);
const weapons=recipes.filter(r=>r.gear==='weapon'),armors=recipes.filter(r=>r.gear==='armor');
function fixture(role='human',n=36){
 const g=new ctx.QGame(ctx.QGame.fresh(260901,role),260901,role);
 const all=Array.from({length:n},(_,i)=>{const group=i%2===0?weapons:armors,r=group[(i>>1)%group.length];return {id:'g'+(i+1),recipe:r.id,quality:i%5,refine:i%4,affixes:[],source:'测试'};});
 g.s.gears=all;g.s.nextGear=n+1;
 g.s.equipped.weapon=all.find(x=>g.recipe(x.recipe)?.gear==='weapon')?.id||null;
 g.s.equipped.armor=all.find(x=>g.recipe(x.recipe)?.gear==='armor')?.id||null;
 return g;
}
function render(g,role='human',slot=1){
 ctx.game=g;ctx.activeRole=role;ctx.activeSlot=slot;
 return ctx.characterRenderTest();
}
function set(expression){return vm.runInContext(expression,ctx,{timeout:5000})}
function count(text,regex){return [...text.matchAll(regex)].length}
for(const role of ['human','demon']){
 for(const n of [0,1,2,18,36]){
  set("characterGearFilter='all';characterGearSort='quality';characterSelectedKey='';characterSalvageConfirmKey='';");
  const g=fixture(role,n),markup=render(g,role);
  check(role+n+' item tiles',count(markup,/class="character-v92-item /g)===n);
  check(role+n+' one gear scroll region',count(markup,/class="character-gear-list character-v92-grid"/g)===1);
  check(role+n+' two equipment slots',count(markup,/class="character-v92-slot /g)===2);
  check(role+n+' one inspector',count(markup,/class="character-v92-inspector/g)===1);
  check(role+n+' no select dropdown',!markup.includes('<select'));
  check(role+n+' no duplicate 3 action controls per tile',count(markup,/data-a="equip"/g)===(n?1:0));
  check(role+n+' no old top scrollbar region',!markup.includes('character-top'));
  check(role+n+' weapon/armor slot semantics',markup.includes('data-kind="armor"')||markup.includes('character-v92-slot-label'));
  if(n){
   check(role+n+' selected item stays in current slot',markup.includes('data-id="g1"'));
   const chosen=set("characterSelectedKey");
   check(role+n+' selection scoped',chosen.startsWith(role+':1:g'));
   const gear=g.s.gears[0];const type=g.recipe(gear.recipe)?.gear;
   check(role+n+' correct attribute labels',markup.includes(type==='weapon'?'攻击':'防御'));
  }else check(role+n+' empty state',markup.includes('前往炼制'));
 }
 const g=fixture(role,36);
 set("characterGearFilter='weapon';characterGearSort='rating';characterSelectedKey='';characterSalvageConfirmKey='';");
 let w=render(g,role);
 check(role+' filtered weapons',count(w,/class="character-v92-item /g)===18);
 check(role+' rating sort visibly active',w.includes('战力↓'));
 set("characterGearFilter='armor';characterGearSort='refine';characterSelectedKey='';");
 let a=render(g,role);
 check(role+' filtered armor',count(a,/class="character-v92-item /g)===18);
 check(role+' refine sort visibly active',a.includes('精炼↓'));
 check(role+' equipped armor slot shows armor',a.includes('防具'));
 const held=set("characterSelectedKey");
 ctx.activeSlot=2;
 render(g,role,2);
 check(role+' selection scoped per slot',set('characterSelectedKey')!==held);
 // Un-equipped selected gear requires confirmation before destructive salvage.
 set("characterGearFilter='all';characterSelectedKey='"+role+":2:g5';characterSalvageConfirmKey='"+role+":2:g5';");
 const confirm=render(g,role,2);
 check(role+' confirm requires explicit action',confirm.includes('确认分解此装备')&&!confirm.includes('data-a="salvage"'));
 const stable=render(g,role,2);
 check(role+' stat render deterministic',stable===confirm);
}
console.log('V90.2 CHARACTER LAYOUT PASS',checks,'assertions: 0/1/2/18/36 gear, two races, single-scroll UI, selection and safety.');
