'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'releases/山野修仙记_V90.6_十二阶储物袋与特殊储物袋版.html'),'utf8');


const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
assert.equal(scripts.length,10);scripts.forEach((s,i)=>new vm.Script(s,{filename:'inline-'+i}));
const ctx=vm.createContext({console});ctx.globalThis=ctx;
for(let i=0;i<=4;i++)vm.runInContext(scripts[i],ctx,{timeout:8000});
const {QGame:Game,QData:D}=ctx,ui=scripts[7],start=ui.indexOf('function questDisplay(){'),end=ui.indexOf('function simulatedLifeAdReady(){',start);
assert(start>0&&end>start);
const body=ui.slice(start,end);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let checks=5;
const check=(name,condition)=>{assert.ok(condition,name);checks++};
function fixture(role,zone){
 const game=new Game(Game.fresh(260310+zone,role),260310+zone,role);
 game.s.zone=zone;game.s.ritual[zone]=zone%2===0;
 const bodyElement={scrollTop:0},linkFocus={guide:0,world:0},backFocus={n:0};
 const dom={focus(){backFocus.n++}};
 const $=id=>id==='panel-body'?bodyElement:id==='panel-root'?{querySelector(q){
 if(q.includes('panel-back'))return dom;
 return {focus(){q.includes('data-page="guide"')?linkFocus.guide++:linkFocus.world++}};
 }}:null;
 let renders=0;
 const render=()=>{renders++;bodyElement.scrollTop=0};
 const stop=()=>{};
 const objective=()=>({title:'本境主线',detail:'完成地标目标',point:{x:4,y:4,mark:'泉'},needs:[],note:'',action:null});
 const renderEngine=new Function('game','D','esc','objective','realmPlaybookHTML','relicCourtQuestHTML','$','render','stop',
  "let panel='quest',panelScroll={},questReturnFocus='guide';\n"+body+
  "\nreturn {questDisplay,guidePage,worldPage,enterQuestChild,leaveQuestChild,get:()=>({panel,scroll:documentBody.scrollTop}),setScroll:n=>documentBody.scrollTop=n};"
  .replaceAll('documentBody','bodyElement'));
 // Supply documentBody closure under local lexical scope.
 const resolved=new Function('game','D','esc','objective','realmPlaybookHTML','relicCourtQuestHTML','$','render','stop','documentBody',
  "let panel='quest',panelScroll={},questReturnFocus='guide';\n"+body+
  "\nreturn {questDisplay,guidePage,worldPage,enterQuestChild,leaveQuestChild,get:()=>({panel,scroll:documentBody.scrollTop}),setScroll:n=>documentBody.scrollTop=n};");
 return {...resolved(game,D,esc,objective,()=>'<div id="guide-detail">攻略详情</div>',()=>'<div id="journal">见闻</div>',$,render,stop,bodyElement),linkFocus,backFocus};
}
for(const role of ['human','demon'])for(const zone of [0,1,5,8,11]){
 const x=fixture(role,zone);
 const main=x.questDisplay(),guide=x.guidePage(),world=x.worldPage();
 check(role+zone+' two links',(main.match(/data-a="quest-subpage"/g)||[]).length===2);
 check(role+zone+' no folded details',!main.includes('q3-fold'));
 check(role+zone+' full guide',guide.includes('guide-detail')&&guide.includes('当前任务'));
 check(role+zone+' full progress',(world.match(/<li /g)||[]).length===12);
 check(role+zone+' bottom back',guide.includes('data-a="quest-return"')&&world.includes('data-a="quest-return"'));
 x.setScroll(153);check(role+zone+' enter guide',x.enterQuestChild('guide')&&x.get().panel==='quest-guide'&&x.get().scroll===0);
 x.setScroll(77);check(role+zone+' return guide',x.leaveQuestChild()&&x.get().panel==='quest'&&x.get().scroll===153);
 check(role+zone+' focus main guide',x.linkFocus.guide===1&&x.backFocus.n===1);
 x.setScroll(250);check(role+zone+' enter world',x.enterQuestChild('world')&&x.get().panel==='quest-world');
 x.setScroll(111);check(role+zone+' return world',x.leaveQuestChild()&&x.get().panel==='quest'&&x.get().scroll===250);
 check(role+zone+' world focus',x.linkFocus.world===1);
 check(role+zone+' reject unknown child',x.enterQuestChild('bad')===false);
}
check('header parent back',ui.includes('data-a="quest-return" aria-label="返回主线"'));
check('top close routes back',ui.includes("if(isQuestChild(panel)){leaveQuestChild();return;}if(panel)panelScroll"));
check('escape routes back',ui.includes("else if(panel){if(isQuestChild(panel)){leaveQuestChild();return;}"));
console.log('V90.6 QUEST SUBPAGE CHECK PASS',checks,'assertions');
