/* Crop outputs are plants; ore, tokens and boss loot stay in the world. */
(function(D){
D.GARDEN={schema:1,maxPlots:26,sowMinutes:5,seedPity:12};
D.gardenCapacity=level=>level>0?Math.min(26,4+2*(level-1)):0;
const rows=[
 ['herb','止血草','seedHerb',1,12,3,['herb'],'药圃'],
 ['fiber','青藤','seedFiber',1,24,4,['grass'],'药圃'],
 ['berry','灵果','seedBerry',1,36,5,['fruit'],'果圃'],
 ['wood','灵木','seedWood',1,72,6,['wood','twig'],'苗圃'],
 ['waterherb','水灵草','seedWaterherb',2,24,3,['waterherb'],'药圃'],
 ['blossom','碧灵花','seedBlossom',2,24,3,['blossom'],'药圃'],
 ['dew','凝露草','seedDew',2,36,2,['dew'],'药圃'],
 ['moss','玄阴苔','seedMoss',4,48,3,['moss'],'药圃'],
 ['venom','幽沼毒草','seedVenom',4,36,2,['venom'],'药圃'],
 ['coreHerb','丹霞芝','seedCoreHerb',6,48,3,['coreHerb'],'药圃'],
 ['soulDew','养魂莲','seedSoulDew',7,60,2,['soulDew'],'药圃'],
 ['godFruit','化神果','seedGodFruit',8,72,3,['godFruit'],'果圃'],
 ['unionBark','同心灵木','seedUnionBark',10,96,3,['unionBark'],'苗圃']
];
D.CROPS={};D.CROP_SOURCES={};
for(const [item,name,seed,tier,hours,yieldCount,sources,kind]of rows){
 D.CROPS[seed]={id:seed,name,seed,item,tier,minutes:hours*60,yield:yieldCount,sources,kind};
 D.ITEMS[seed]={name:name+'种子',wt:0,type:'material',seed:true,tier,effect:'灵田'+tier+'阶可种；'+hours+'游戏小时成熟，收获'+D.ITEMS[item].name+'×'+yieldCount+'；种子不占负重'};
 for(const source of sources)D.CROP_SOURCES[source]=seed;
}
for(let i=0;i<12;i++)D.BUILDINGS.farm.levels[i].effect=D.gardenCapacity(i+1)+'块田地；逐块播种、成熟后收获，不再自动产矿';
D.HELP.push({id:'garden978',title:'灵田：种子、田地与成熟',paragraphs:[
 '一阶4块，每升一阶增加2块，十二阶26块。灵木与灵植在同一田园种植，苗圃生长较慢；矿石、劫材与秘境遗器不能种出来。',
 '成功采集草木时有18%机会获得对应种子，连续12次同种有效采集至少获得1粒；枯枝仅6%，连续30次保底。失败、取消、重复点击已采完节点都不判定。种子零重量，可存仓；首次建灵田赠4粒基础种子。',
 '每块播种消耗对应种子1、清水1和5游戏分钟。批量操作先检查全部资源，条件不足不扣费。普通灵草12小时，灵木72小时，高阶灵植48至96游戏小时成熟。',
 '成长只按本档游戏时间；离线、改系统时间不催熟。成熟作物不会枯死，也不会连续重复产出；收获后需重新播种。仓库和行囊装不下的产物留在田中，不能消失或重复领取。',
 '旧灵田已完成的最多3轮收益及待领物资保留；不足一轮的进度折为一次到期结算，不无限续产。首次升级先归档原存档，迁移与新手种子只发一次。'
]});
})(globalThis.QData);
