/* V90.78 facility ownership is explicit. UI filters never grant permissions. */
(function(D){
'use strict';
D.RELEASE='V90.78';
D.STATIONS={forge:'炼器室',alchemy:'丹房',workbench:'工作台'};
D.BUILDINGS.workbench={name:'工作台',mark:'作',automatic:true,levels:[{name:'基础工作台',cost:{},minutes:0,effect:'洞府建成即启用；不升级。工具、器具与十二阶储物袋。'}]};
D.stationOf=r=>r.gear?'forge':r.storageBag||r.flag||r.type==='工具'?'workbench':'alchemy';
for(const r of D.RECIPES){
 r.station=D.stationOf(r);
 if(r.station==='workbench'){
  r.portable=['axe','pick','rod'].includes(r.id);r.room=r.portable?undefined:'workbench';r.home=!r.portable;
  // Map tier is independent of a workstation's (nonexistent) upgrade level.
  r.mapTier=r.mapTier||((r.zone||0)+1);r.tier=1;
 }
}
for(const bag of D.STORAGE_BAGS)if(bag.tier)bag.station='workbench';
for(const [id,name] of [['coreTonic','六阶回元丹'],['daoTonic','十一阶道源丹']]){
 D.ITEMS[id].name=name;const r=D.RECIPES.find(r=>r.item===id);if(r)r.name=name;
}
D.SUPPLIES.mana.tier=D.RECIPES.find(r=>r.item==='mana').mapTier;
for(let i=0;i<12;i++){
 D.BUILDINGS.forge.levels[i].effect='第'+(i+1)+'图武器、防具与装备精炼；赋灵只需一阶炼器室';
}
const setHelp=(id,title,paragraphs)=>{const page=D.HELP.find(p=>p.id===id);if(page)Object.assign(page,{title,paragraphs});else D.HELP.push({id,title,paragraphs});};
setHelp('home975','唯一洞府 · 建筑各司其职',[
 '每角色当前档位、本世一座洞府，全地图共用。点击设施主体进入功能；升级在营建页确认。战斗和秘境中不可进入，离府仍回原探索位置。',
 '炼器室只管装备打造与精炼；丹房有丹药、灵膳与灵饮；工作台随洞府启用、无等级，管理工具与储物袋。赋灵为洞府独立入口，只需已建一阶炼器室，不额外建设赋灵台。',
 '底部功法入口按种族显示功法／血脉。野外可查看，参悟和炼化等府内行为仍需回府，打开资料不会自动传送。',
 '洞府、仓房、炼器室、丹房、静室和灵田保持十二阶，地图、境界和设施条件同时校验。仓房十二阶容量250000，装备1600件。'
]);
setHelp('spirit975','赋灵 · 修为与熟练度',[
 '进入洞府点击赋灵，选择精良以上且有词条槽的装备。只要求一阶炼器室，不新增赋灵建筑或升级费用。',
 '消耗灵石与当前修为，不扣除已获得的境界。熟练度在成功赋灵后增长，不是开工费用。锁定、保底及既有词条保持原规则。'
]);
setHelp('storage-bags','十二阶储物袋 · 工作台制作',[
 '在洞府工作台的储物袋分类制作。一至十二阶配方仍受对应地图、境界和材料限制；工作台本身无等级，不再要求同阶炼器室。',
 '只需制作一次，仅最大容量生效；不占负重，不增加36件随身器囊格数。既有储物袋永久拥有记录保持不变。',
 '杀神储物袋仍为累计100次真实妖兽击杀；虚空储物袋仍为未完成秘境节点成功后的独立1%判定，二者不可制作。'
]);
setHelp('blood','妖族命格：血脉与妖元',[
 '妖族基础寿元114年、人族100年；实际初始数值还受已确认命格与轮回玉加点影响。',
 '妖族沿血脉路线成长，消耗精血觉醒本命神通。底部功法入口为妖族展示血脉；不重新抽取已经确定的命格。'
]);
setHelp('survival','饥渴与休息：按时间结算',[
 '饱腹和饮水上限100；普通消耗随境界依次为100%、75%、50%、30%、15%。第七境可选灵息辟谷，用真元／妖元额外抵扣，保留四成能量。',
 '环境额外饮水照常消耗。战斗、调息、休整和吐纳暂停额外抵扣，境界自然减耗仍生效。食水不足会降低休息恢复效率，辟谷不直接回血。'
]);
for(const page of D.HELP){page.title=page.title.replace(/（P\d+）/g,'');page.paragraphs=page.paragraphs.map(s=>s.replace(/V90\.75属于新的经营规则/g,'新经营规则').replace(/炼制 → 储物袋/g,'洞府 → 工作台 → 储物袋'));}
for(const q of D.GUIDE){
 if(q.id==='settle'){q.title='开辟本世洞府';q.text='备好灵木、青藤与灵石，点击固定洞府按钮建造一次草庐。不用寻找建造地块，工作台随之启用。';}
 if(q.id==='axe')q.text='先按清单备料，可从背包的随身手作制作粗木斧。洞府建成后，在无等级工作台统一管理工具。';
 if(q.id==='sword')q.text='进入洞府炼器室，备好桃木灵剑材料后打造并装备。丹药与储物袋不会混在此页。';
}
})(globalThis.QData);
