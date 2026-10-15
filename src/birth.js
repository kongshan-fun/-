/* V14 birth rules. Deterministic, DOM-free and independently testable. */
(function(root){
'use strict';
const RACES={
 human:{id:'human',name:'人族',short:'人族',intro:'以灵根引气，以悟性问道。',detail:'抽取灵根、五行偏性、悟性、根骨与气运。天赋影响修炼、气血、术法与炼器品质，不设天赋通关门槛。',hp:100,spirit:110,attack:7,years:56,spellCost:9,spellMult:1.75,spellName:'御灵诀',energy:'灵力',start:'炼气',second:'筑基',realms:['炼气','筑基','金丹','元婴','化神','炼虚','合体','大乘','渡劫','飞升'],lore:'十二道旧封印将崩。你从青岚醒来，拾取山野灵物，择地筑庐，寻找通往天门的道路。'},
 demon:{id:'demon',name:'妖族',short:'妖族',intro:'山野启灵，凝丹化形。',detail:'抽取本相、血脉品阶、灵智、妖躯与气运。先天躯壳强健、妖元较少；化形后仍保留妖族与血脉，不转为人族。',hp:116,spirit:92,attack:8,years:64,spellCost:10,spellMult:1.65,spellName:'妖元冲击',energy:'妖元',start:'启灵',second:'通脉',realms:['启灵','通脉','妖丹','化形','妖王','妖皇','妖尊','妖圣','渡劫','飞升'],lore:'你在青岚山野初开灵智。人妖共栖的凡界正被裂隙侵蚀；修复十二道封印、凝丹化形，终在同一天门渡劫。'}
};
const ROOTS=[{id:'mixed',name:'杂灵根',weight:30,xp:0,count:4},{id:'triple',name:'三灵根',weight:30,xp:4,count:3},{id:'dual',name:'双灵根',weight:23,xp:8,count:2},{id:'heaven',name:'天灵根',weight:12,xp:12,count:1},{id:'mutant',name:'异灵根',weight:5,xp:15,count:1}];
const BLOODS=[{id:'common',name:'凡血',weight:32,xp:0,damage:0},{id:'spirit',name:'灵血',weight:30,xp:3,damage:1},{id:'variant',name:'异血',weight:23,xp:6,damage:2},{id:'ancient',name:'古血',weight:12,xp:9,damage:3},{id:'ancestral',name:'真灵遗血',weight:3,xp:12,damage:4}];
const FORMS=[{id:'wolf',name:'苍狼',note:'攻势 +4%',damage:4},{id:'fox',name:'青狐',note:'妖元上限 +12',spirit:12},{id:'ape',name:'玄猿',note:'气血上限 +14',hp:14},{id:'serpent',name:'灵蛇',note:'药物恢复 +12%',heal:12},{id:'crane',name:'白鹤',note:'术法耗元 −1',cost:-1}];
const ELEMENTS=[{id:'metal',name:'金',note:'攻击 +1',attack:1},{id:'wood',name:'木',note:'采药额外一份概率 15%',herb:.15},{id:'water',name:'水',note:'灵力上限 +10',spirit:10},{id:'fire',name:'火',note:'攻势 +4%',damage:4},{id:'earth',name:'土',note:'气血上限 +12',hp:12}];
const clone=x=>JSON.parse(JSON.stringify(x));
const validRace=id=>{if(!Object.hasOwn(RACES,id))throw Error('未知种族');return id;};
const nameOf=(s,id)=>{s=String(s||'').trim();if(/[<>\x00-\x1f]/.test(s)||[...s].length>12)throw Error('道号限12字，不可含特殊标记');return s|| (id==='human'?'无名散修':'山野灵妖');};
function generator(seed){let s=Number(seed)>>>0;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
function weighted(list,r){let p=r()*100;for(const x of list){p-=x.weight;if(p<0)return x;}return list.at(-1);}
function roll(race,seed,name=''){
 validRace(race);if(!Number.isInteger(seed)||seed<1||seed>4294967295)throw Error('天赋种子无效');
 const r=generator(seed),grade=weighted(race==='human'?ROOTS:BLOODS,r),pick=list=>list[Math.floor(r()*list.length)];
 const b={v:1,race,seed,name:nameOf(name,race),origin:'rolled',grade:grade.id};
 if(race==='human'){const pool=ELEMENTS.map(x=>x.id),elements=[];for(let n=0;n<grade.count;n++)elements.push(pool.splice(Math.floor(r()*pool.length),1)[0]);b.elements=elements;b.affinity=elements[0];if(grade.id==='mutant')b.mutation=pick(['雷','冰','风']);}
 else b.form=pick(FORMS).id;
 b.insight=40+Math.floor(r()*51);b.vigor=40+Math.floor(r()*51);b.fortune=1+Math.floor(r()*100);
 return b;
}
function legacy(id,seed=261014){if(!['sword','herb'].includes(id))id='sword';return {v:1,race:'human',seed:(Number(seed)>>>0)||1,name:id==='herb'?'旧世丹修':'旧世剑修',origin:'legacy',legacyClass:id,grade:'legacy',insight:50,vigor:50,fortune:1};}
function validate(b,race){validRace(race);if(!b||b.v!==1||b.race!==race)throw Error('天赋与种族不符');
 if(b.origin==='legacy'){if(race!=='human'||!['sword','herb'].includes(b.legacyClass))throw Error('旧世传承数据无效');return {...legacy(b.legacyClass,b.seed),name:nameOf(b.name,race)};}
 const expected=roll(race,b.seed,b.name);
 for(const k of ['v','race','seed','origin','grade','affinity','mutation','form','insight','vigor','fortune'])if(b[k]!==expected[k])throw Error('天赋记录损坏：'+k);
 if(JSON.stringify(b.elements)!==JSON.stringify(expected.elements))throw Error('灵根记录损坏');return expected;
}
function effects(b){
 if(b.origin==='legacy')return {xp:0,hp:0,spirit:0,attack:0,damage:0,heal:0,quality:0,herb:b.legacyClass==='herb'?.35:0,cost:0};
 const grade=(b.race==='human'?ROOTS:BLOODS).find(x=>x.id===b.grade),trait=b.race==='human'?ELEMENTS.find(x=>x.id===b.affinity):FORMS.find(x=>x.id===b.form);
 return {xp:grade.xp+Math.floor((b.insight-40)/5),hp:Math.floor((b.vigor-40)*.4)+(trait.hp||0),spirit:trait.spirit||0,attack:trait.attack||0,damage:(grade.damage||0)+(trait.damage||0),heal:trait.heal||0,quality:Number(((b.fortune-1)/99*8).toFixed(2)),herb:trait.herb||0,cost:trait.cost||0};
}
function profile(b){const r=RACES[b.race],e=effects(b);let base={...r};
 if(b.origin==='legacy')base={...r,...(b.legacyClass==='herb'?{hp:94,spirit:115,attack:6,years:64,spellCost:11,spellMult:1.45}:{hp:100,spirit:100,attack:7,years:56,spellCost:9,spellMult:1.9})};
 return {...base,hp:base.hp+e.hp,spirit:base.spirit+e.spirit,attack:base.attack+e.attack,spellCost:base.spellCost+e.cost,herbChance:e.herb,healSpell:b.origin==='legacy'&&b.legacyClass==='herb'};
}
function gradeName(b){return b.origin==='legacy'?'旧世传承':(b.race==='human'?ROOTS:BLOODS).find(x=>x.id===b.grade).name;}
function cards(b){const e=effects(b);if(b.origin==='legacy')return [['旧世传承',b.legacyClass==='herb'?'丹道传承':'剑道传承','原有属性与进度保留，不重新抽取']];
 const shared=[[b.race==='human'?'悟性':'灵智',String(b.insight),'修为增益 +'+Math.floor((b.insight-40)/5)+'%'],[b.race==='human'?'根骨':'妖躯',String(b.vigor),'初始气血 +'+Math.floor((b.vigor-40)*.4)],['气运',String(b.fortune),'品质判定 +'+e.quality.toFixed(1)]];
 if(b.race==='human'){const grade=ROOTS.find(x=>x.id===b.grade),a=ELEMENTS.find(x=>x.id===b.affinity);return [['灵根',gradeName(b)+(b.mutation?' · '+b.mutation:''),'修为增益 +'+grade.xp+'%'],['五行偏性',b.elements.map(id=>ELEMENTS.find(x=>x.id===id).name).join(' / '),a.name+'偏性：'+a.note],...shared];}
 const g=BLOODS.find(x=>x.id===b.grade),f=FORMS.find(x=>x.id===b.form);return [['血脉',g.name,'修为 +'+g.xp+'% · 攻势 +'+g.damage+'%'],['本相',f.name,f.note],...shared];
}
function realm(state){const r=RACES[state.race||state.character];if(!r)return '未知境界';const n=['','一','二','三','四','五','六','七','八','九'];return state.major>1?r.realms[state.major]:state.level<=9?r.start+n[state.level]+'层':r.second+(state.level<=12?'初期':state.level<=15?'中期':'后期');}
const API={RACES,ROOTS,BLOODS,FORMS,ELEMENTS,roll,legacy,validate,effects,profile,cards,gradeName,realm,nameOf};
root.QBirth=API;if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(globalThis);
