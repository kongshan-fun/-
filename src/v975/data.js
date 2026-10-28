/* V90.75: one character home, twelve map tiers, consistent consumable catalog. */
(function(D){
'use strict';
D.RELEASE='V90.75';
D.HOME_ROOMS=['residence','warehouse','forge','alchemy','quiet','farm'];
D.WAREHOUSE_CAPS=[0,600,1200,2400,4500,8000,14000,24000,40000,65000,100000,160000,250000];
D.WAREHOUSE_GEAR_CAPS=[0,48,80,120,180,260,360,480,640,800,1000,1300,1600];
D.OLD_HOME_TIERS=[0,1,3,5,9,12];
D.OLD_FARM_LOOT=JSON.parse(JSON.stringify(D.FARM_LOOT));
D.MAP_MATERIALS=[['wood','fiber'],['dew','blossom'],['copper','cinder'],['moss','soul'],['star','thunder'],...D.ASCENSION_STAGES.map(s=>[s.primary,s.secondary])];
D.HOME_NAMES=['草庐','溪畔小筑','赤岩石府','幽篁道院','星阙灵府','丹霞洞天','婴灵仙居','云海道宫','虚空灵府','合道仙宫','大乘洞天','十二阶洞天'];
const oldCosts={};for(const id of D.HOME_ROOMS)oldCosts[id]=JSON.parse(JSON.stringify(D.BUILDINGS[id].levels[0].cost));
for(const id of D.HOME_ROOMS){
 const def=D.BUILDINGS[id];
 def.levels=Array.from({length:12},(_,i)=>{
  const t=i+1,[primary,secondary]=D.MAP_MATERIALS[i],cost=i?{[primary]:6+t*2,[secondary]:3+t,stone:4+t*2}:oldCosts[id];
  if(i>0&&primary==='stone')cost.stone+=6+t*2;
  const effect=id==='warehouse'?'物资容量 '+D.WAREHOUSE_CAPS[t].toLocaleString('zh-CN')+' · 装备 '+D.WAREHOUSE_GEAR_CAPS[t]+' 件':
   id==='forge'?'开放第 '+t+' 图装备、储物袋与赋灵':
   id==='alchemy'?'开放第 '+t+' 图丹药、灵膳与灵饮':
   id==='quiet'?'吐纳收益随修为境界和静室阶数增长':
   id==='farm'?'每24游戏小时生产灵草与本阶道材，最多累积3轮':'全地图唯一洞府 · 开放同阶设施';
  return {name:id==='residence'?D.HOME_NAMES[i]:def.name+' · '+t+'阶',cost,minutes:id==='residence'?100+t*20:40+t*10,home:id==='residence'?undefined:t,mapTier:t,effect};
 });
}
// The mountain gate is a world objective, not a seventh upgradeable home room.
D.BUILDINGS.gate.name='青岚护山阵';
D.BUILDINGS.gate.levels[0].effect='地图仪式，完成后开放青岚首领；不属于洞府设施';
D.FARM_LOOT.length=1;
for(let t=1;t<=12;t++){
 const [p,q]=D.MAP_MATERIALS[t-1],loot={herb:2+t,berry:2+t,waterherb:Math.floor(t/3)};
 if(t>1){loot[p]=(loot[p]||0)+Math.ceil(t/3);loot[q]=(loot[q]||0)+Math.ceil(t/4);}
 D.FARM_LOOT[t]=loot;
}
// Each equipment and bag recipe belongs to exactly one world-map tier.
for(const r of D.RECIPES){
 if(r.gear||r.storageBag){r.mapTier=(Number(r.zone)||0)+1;r.tier=r.mapTier;r.room='forge';r.home=true;delete r.realmReq;}
 if(r.item&&r.room==='alchemy'){r.mapTier=(Number(r.zone)||0)+1;r.tier=r.mapTier;}
 if(r.type==='高阶丹药')r.type='丹药';
}
for(const bag of D.STORAGE_BAGS)if(bag.tier)bag.forgeTier=bag.tier;
D.SUPPLIES={
 salve:{kind:'hp',hp:32,tier:1,battle:true},mana:{kind:'spirit',spirit:40,tier:1,battle:true},
 berry:{kind:'food',hunger:22,tier:1},water:{kind:'water',water:30,tier:1},
 pill:{kind:'food',hunger:42,water:8,tier:1},meal:{kind:'food',hunger:45,water:8,tier:1},fish:{kind:'food',hunger:28,tier:1},
 coreTonic:{kind:'hp',hp:Math.round(D.REALM_STATS[5].hp*.35),spirit:Math.round(D.REALM_STATS[5].spirit*.25),tier:6,battle:true},
 daoTonic:{kind:'hp',hp:Math.round(D.REALM_STATS[10].hp*.40),spirit:Math.round(D.REALM_STATS[10].spirit*.30),tier:11,battle:true}
};
D.QUICK_KINDS=['hp','spirit','food','water'];
D.QUICK_LABELS=['回血','回灵','食物','饮水'];
D.QUICK_DEFAULTS=['salve','mana','berry','water'];
const numeral=['一','二','三','四','五','六','七','八','九','十','十一','十二'];
function effectText(e){return [['hp','气血'],['spirit','灵力'],['hunger','饱腹'],['water','饮水']].filter(([k])=>e[k]).map(([k,n])=>n+' +'+e[k]).join(' · ');}
D.supplyText=effectText;
for(let t=1;t<=12;t++){
 const i=t-1,zone=D.ZONES[i],[p,q]=D.MAP_MATERIALS[i],stats=D.REALM_STATS[i];
 const rows=[
  ['hp','养元丹',{hp:Math.round(stats.hp*.32),battle:true},{herb:2,[q]:1,stone:1}],
  ['spirit','聚灵丹',{spirit:Math.round(stats.spirit*.38),battle:true},{herb:1,[p]:1,stone:2}],
  ['food','灵膳',{hunger:Math.min(100,35+t*5),water:Math.min(25,5+t)}, {berry:2,[q]:1,water:1}],
  ['water','灵饮',{water:Math.min(100,40+t*5),spirit:Math.round(stats.spirit*.08)}, {water:2,[q]:1}]
 ];
 for(const [kind,suffix,amount,cost] of rows){
  const id='supply'+kind+t,name=zone.short+suffix;
  const e={kind,tier:t,...amount};D.SUPPLIES[id]=e;
  D.ITEMS[id]={name,wt:1,type:'food',tier:t,effect:effectText(e)+(e.battle?' · 战斗使用占一回合':' · 非战斗使用')};
  D.RECIPES.push({id,name,type:kind==='hp'||kind==='spirit'?'丹药':'食物',item:id,cost,home:true,room:'alchemy',tier:t,mapTier:t,zone:i});
 }
}
for(const [id,e] of Object.entries(D.SUPPLIES))if(D.ITEMS[id])D.ITEMS[id].effect=effectText(e)+(e.battle?' · 战斗使用占一回合':' · 非战斗使用');
D.realmDisplay=function(s){
 const lv=Math.max(1,Math.min(36,Math.round(Number(s?.level)||1))),i=Math.ceil(lv/3)-1,st=(lv-1)%3;
 const need=Math.round(D.REALM_BASE[i]*D.STAGE_MULT[st]*D.difficultyOf(s).scale);
 return (D.REALM12[s?.character]||D.REALM12.human)[i]+(st===2&&s.xp>=need?'圆满':D.STAGE3[st]);
};
// Replace obsolete mandatory-plot instructions, not the player's story flags.
D.HELP.splice(0,D.HELP.length,
 {id:'start',title:'开始修行',paragraphs:['选择难度、种族与独立档位。先采集灵木、青藤与灵石，点击洞府建造本世唯一的草庐。','地图仪式与首领决定地图进度；角色修为决定十二境三十六段。地图与境界各自显示，不会把旧故事冒充当前任务。']},
 {id:'home975',title:'唯一洞府 · 十二阶设施',paragraphs:['每个角色当前档位只有一座洞府，各地图共用。点击洞府直接进入；返回探索保留原地图与位置。战斗和秘境中不可进入。','洞府、仓房、炼器室、丹房、静室、灵田均为十二阶。第N阶与第N张地图对应，需要先开放地图并达到对应修为境界；旧档等效迁移的高阶设施不会降级。','仓房一阶容量600，十二阶250000。材料和装备分别计容量；迁入物资超过容量也不会丢弃，只限制继续存入。','旧版多洞府合并：同类设施按旧五阶等效映射到新十二阶，合并全部仓物与装备；已到期灵田产出保留。原始旧档在首次保存前独立归档。']},
 {id:'spirit975',title:'赋灵消耗当前修为',paragraphs:['赋灵统一消耗灵石与当前修为xp；不再读取已停用的道行池。不会扣除已获得的境界，消耗后可能不再满足圆满。','先在洞府建炼器室，再选择精良及以上品质的装备。成功赋灵后增长赋灵熟练度，熟练度不是开工费用。','修为不足或材料不足不会抽词条，不消耗随机数或材料；修为来源包括采集、战斗、吐纳等实际行为。']},
 {id:'supplies975',title:'分阶补给与快捷配置',paragraphs:['每张地图对应养元丹、聚灵丹、灵膳与灵饮。回血、回灵以药品对应境界的基准属性定量，不会让廉价低阶药随玩家无限变强。','快捷栏四格分别为回血、回灵、食物和饮水。点击配置选择随身库存或已发现道具；选择随当前档位保存。物品耗尽不会自动改用其他珍贵丹药。','战斗回血、回灵占用一回合；食物与饮水只在非战斗时使用。快捷栏不远程取用洞府仓物；在仓库按已配置补给整理行装。']},
 {id:'progress975',title:'修行目标与地图进度',paragraphs:['主线页分为修行目标、地图进度和可选见闻。金丹雷考、元婴问心等旧故事不再作为破境前置。','修为达到本境后期圆满后进入洞府破境；需要雷劫时检查气血与护劫丹。通往新地图仍须满足前一图首领及境界要求。','旧支线已做的选择和奖励记录保留，未经历的故事不会自动显示为完成。']},
 {id:'lifespan',title:'寿元与存档',paragraphs:['游戏时间影响寿元；战败仍折寿16年。关闭网页不会自动推进时间。','首次寿尽可以选择续命；在救援弹窗切后台不会提前结算删档。换设备、浏览器或文件路径前请先导出JSON。','旧存档迁移或导入覆盖之前会保存可恢复备份；备份失败时取消覆盖，不得通过清除浏览器数据解决。']},
 {id:'v907-ascension',title:'飞升与本机排行',paragraphs:['渡劫后期修为圆满、平定十二图并携带飞升材料后，到天门界碑飞升。','飞升后可以继续游玩或主动结算本世；轮回玉仍只属于该难度、种族和档位。','本机速通榜以耗寿整数年排序，包括战败折寿。简单模式不计榜。','V90.75属于新的经营规则。本机榜与旧版分开保存；旧版成绩保留在旧榜档案，不静默清空。']}
);
for(const row of D.GUIDE){if(/定居|筑庐|洞府/.test(row.title||''))row.text='点击固定洞府按钮，建造本世唯一洞府；换地图无需重建。';}
})(globalThis.QData);
