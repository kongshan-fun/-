/* V7 data: preserves the five V5 maps; adds real event and equipment data. */
(function(root){
"use strict";
 const ZONES=[
  {name:'青岚山麓',short:'青岚',bossMark:'妖',boss:'boss0',altar:'青岚山门',verb:'修阵',need:{wood:4,stone:3,rune:2},
   map:[
    ['forest','plain','forest','ridge','mine','plain','ruins','ridge'],
    ['plain','spring','plain','forest','ridge','plain','bazaar','plain'],
    ['forest','plain','ruins','plain','forest','mine','plain','boss'],
    ['plain','forest','plain','spring','plain','plain','ridge','plain'],
    ['mine','plain','forest','plain','ruins','forest','plain','spring'],
    ['plain','sect','plain','forest','plain','ruins','plain','gate'],
    ['forest','plain','spring','plain','mine','plain','forest','plain'],
    ['plain','ridge','plain','forest','plain','mine','plain','forest']
   ]},
  {name:'碧溪灵谷',short:'碧溪',bossMark:'蛟',boss:'boss1',altar:'净泉灵坛',verb:'净泉',need:{dew:3,blossom:3,herb:2},
   map:[
    ['flowerfield','forest','pond','plain','flowerfield','ridge','forest','pond'],
    ['plain','pond','flowerfield','forest','pond','plain','flowerfield','plain'],
    ['forest','plain','pond','plain','forest','flowerfield','pond','boss'],
    ['plain','flowerfield','forest','pond','flowerfield','forest','plain','pond'],
    ['pond','forest','flowerfield','plain','shrine','pond','forest','flowerfield'],
    ['camp','plain','pond','flowerfield','forest','plain','forest','gate'],
    ['forest','flowerfield','plain','pond','forest','flowerfield','pond','plain'],
    ['plain','ridge','forest','flowerfield','pond','forest','plain','flowerfield']
   ]},
  {name:'赤砂火岭',short:'赤岭',bossMark:'猿',boss:'boss2',altar:'赤焰古炉',verb:'镇火',need:{copper:4,cinder:2,ore:2},
   map:[
    ['crag','ridge','plain','crag','volcano','ridge','crag','plain'],
    ['plain','mine','crag','ridge','volcano','crag','ridge','mine'],
    ['ridge','plain','crag','volcano','crag','plain','crag','boss'],
    ['crag','ridge','volcano','plain','mine','volcano','crag','ridge'],
    ['plain','crag','ridge','volcano','shrine','crag','plain','mine'],
    ['camp','ridge','crag','plain','volcano','crag','mine','gate'],
    ['crag','plain','mine','ridge','crag','volcano','plain','crag'],
    ['ridge','crag','plain','mine','ridge','plain','crag','volcano']
   ]},
  {name:'玄阴幽沼',short:'幽沼',bossMark:'鬼',boss:'boss3',altar:'镇魂古碑',verb:'镇魂',need:{moss:4,soul:2,herb:2},
   map:[
    ['marsh','forest','tomb','marsh','pond','tomb','forest','marsh'],
    ['pond','marsh','forest','tomb','marsh','forest','tomb','pond'],
    ['marsh','plain','tomb','pond','marsh','tomb','marsh','boss'],
    ['tomb','marsh','pond','forest','tomb','marsh','pond','forest'],
    ['marsh','tomb','forest','marsh','shrine','marsh','tomb','pond'],
    ['camp','marsh','pond','tomb','marsh','forest','marsh','gate'],
    ['marsh','pond','tomb','forest','marsh','tomb','pond','marsh'],
    ['pond','marsh','forest','marsh','tomb','pond','marsh','forest']
   ]},
  {name:'天阙遗境',short:'天阙',bossMark:'仙',boss:'boss4',altar:'天阙祭台',verb:'启天门',need:{star:4,thunder:2,rune:2},
   map:[
    ['astral','spire','ruins','astral','plain','spire','astral','ruins'],
    ['plain','astral','spire','ruins','astral','plain','spire','astral'],
    ['astral','plain','ruins','spire','astral','ruins','astral','boss'],
    ['spire','astral','plain','astral','ruins','spire','plain','astral'],
    ['astral','ruins','spire','plain','shrine','astral','spire','ruins'],
    ['camp','astral','ruins','spire','astral','plain','astral','gate'],
    ['ruins','spire','astral','plain','ruins','astral','spire','plain'],
    ['astral','plain','spire','ruins','astral','spire','ruins','astral']
   ]}
 ];
 const LAND={
  plain:{name:'灵草坡',mark:'草',risk:'低'},forest:{name:'青岚灵林',mark:'林',risk:'中'},spring:{name:'清灵溪',mark:'溪',risk:'低'},
  ridge:{name:'低阶灵石岗',mark:'岭',risk:'中'},mine:{name:'废弃矿洞',mark:'矿',risk:'高'},ruins:{name:'残碑废墟',mark:'墟',risk:'高'},
  bazaar:{name:'山间坊市',mark:'坊',risk:'安全'},sect:{name:'青岚山门',mark:'宗',risk:'安全'},boss:{name:'妖窟',mark:'妖',risk:'极高'},
  gate:{name:'传境界碑',mark:'界',risk:'安全'},camp:{name:'行脚营地',mark:'营',risk:'安全'},shrine:{name:'封印祭坛',mark:'坛',risk:'高'},
  flowerfield:{name:'碧灵花田',mark:'花',risk:'低'},pond:{name:'灵露月潭',mark:'潭',risk:'低'},
  crag:{name:'赤铜岩场',mark:'铜',risk:'高'},volcano:{name:'熔火地穴',mark:'火',risk:'高'},
  marsh:{name:'玄阴湿地',mark:'沼',risk:'高'},tomb:{name:'葬魂古冢',mark:'冢',risk:'高'},
  astral:{name:'星辰遗矿',mark:'星',risk:'高'},spire:{name:'天雷石塔',mark:'雷',risk:'极高'}
 };
 const ITEMS={
  wood:{name:'灵木',wt:2,type:'material'},stone:{name:'低阶灵石',wt:2,type:'material'},fiber:{name:'青藤',wt:1,type:'material'},
  berry:{name:'山野灵果',wt:1,type:'food',effect:'饱腹 +22'},water:{name:'清泉水',wt:1,type:'food',effect:'饮水 +30'},
  herb:{name:'止血草',wt:1,type:'material'},ore:{name:'玄铁矿',wt:2,type:'material'},rune:{name:'阵纹残片',wt:1,type:'material'},
  hide:{name:'妖兽皮',wt:2,type:'material'},salve:{name:'回春散',wt:1,type:'food',effect:'气血 +32'},
  pill:{name:'辟谷丸',wt:1,type:'food',effect:'饱腹 +42，饮水 +8'},axe:{name:'粗木斧',wt:2,type:'tool'},pick:{name:'石镐',wt:3,type:'tool'},
  dew:{name:'碧灵露',wt:1,type:'material'},blossom:{name:'碧灵花',wt:1,type:'material'},
  copper:{name:'赤铜晶',wt:2,type:'material'},cinder:{name:'焰心砂',wt:1,type:'material'},
  moss:{name:'玄阴苔',wt:1,type:'material'},soul:{name:'幽魂砂',wt:1,type:'material'},
  star:{name:'星髓矿',wt:2,type:'material'},thunder:{name:'雷霆髓',wt:1,type:'material'}
 };
 const RECIPES=[
  {id:'axe',name:'粗木斧',type:'工具',cost:{wood:2,fiber:1,stone:1},item:'axe',unique:true},
  {id:'pick',name:'石镐',type:'工具',cost:{wood:2,fiber:2,stone:2},item:'pick',unique:true},
  {id:'woodSword',name:'桃木灵剑',type:'剑 +7',cost:{wood:3,stone:2,fiber:1},home:true,gear:'weapon',bonus:7},
  {id:'ironSword',name:'玄铁法剑',type:'剑 +12',cost:{wood:2,ore:5,fiber:1},home:true,gear:'weapon',bonus:12},
  {id:'springSword',name:'碧溪灵剑',type:'剑 +19',cost:{blossom:1,dew:1,ore:1},home:true,gear:'weapon',bonus:19,zone:1},
  {id:'emberSword',name:'赤铜焰剑',type:'剑 +29',cost:{copper:2,cinder:1,stone:2},home:true,gear:'weapon',bonus:29,zone:2},
  {id:'yinSword',name:'玄阴灵刃',type:'剑 +40',cost:{moss:2,soul:1,herb:1},home:true,gear:'weapon',bonus:40,zone:3},
  {id:'skySword',name:'天阙星剑',type:'剑 +52',cost:{star:2,thunder:1,rune:1},home:true,gear:'weapon',bonus:52,zone:4},
  {id:'robe',name:'青藤道袍',type:'衣 +2',cost:{fiber:4,wood:1},home:true,gear:'armor',bonus:2},
  {id:'hideRobe',name:'妖皮护甲',type:'衣 +4',cost:{hide:2,fiber:2},home:true,gear:'armor',bonus:4},
  {id:'springRobe',name:'碧露法衣',type:'衣 +7',cost:{blossom:2,dew:1,fiber:1},home:true,gear:'armor',bonus:7,zone:1},
  {id:'emberRobe',name:'赤铜护身甲',type:'衣 +11',cost:{copper:2,cinder:1,hide:1},home:true,gear:'armor',bonus:11,zone:2},
  {id:'yinRobe',name:'玄阴法袍',type:'衣 +15',cost:{moss:2,soul:1,fiber:2},home:true,gear:'armor',bonus:15,zone:3},
  {id:'skyRobe',name:'星辰法衣',type:'衣 +20',cost:{star:2,thunder:1,ore:1},home:true,gear:'armor',bonus:20,zone:4},
  {id:'talisman',name:'探灵符',type:'神识 +1',cost:{wood:2,fiber:1},home:true,flag:'talisman'},
  {id:'salve',name:'回春散',type:'丹药',cost:{herb:2,fiber:1},item:'salve'},
  {id:'pill',name:'辟谷丸',type:'丹药',cost:{berry:2,wood:1},item:'pill'}
 ];
 const ENEMIES={
  sprite:{name:'草木精怪',hp:23,atk:5,armor:0,xp:5,loot:{hide:1}},
  wolf:{name:'青鬃妖狼',hp:37,atk:8,armor:1,xp:8,loot:{hide:1,herb:1}},
  guard:{name:'失控石傀',hp:49,atk:10,armor:2,xp:11,loot:{ore:2,rune:1}},
  river:{name:'碧潭妖蜥',hp:66,atk:13,armor:3,xp:14,loot:{blossom:1,dew:1}},
  firebeast:{name:'赤岩火蝎',hp:91,atk:18,armor:5,xp:19,loot:{copper:2,cinder:1}},
  wraith:{name:'玄阴魇灵',hp:131,atk:25,armor:7,xp:25,loot:{moss:2,soul:1}},
  sentinel:{name:'星阙灵卫',hp:174,atk:32,armor:9,xp:32,loot:{star:2,thunder:1}},
  boss0:{name:'噬灵妖魇',hp:95,atk:13,armor:3,xp:30,loot:{rune:3}},
  boss1:{name:'青潭蛟影',hp:152,atk:17,armor:5,xp:40,loot:{dew:3,blossom:2}},
  boss2:{name:'赤焰魔猿',hp:229,atk:23,armor:8,xp:54,loot:{copper:3,cinder:2}},
  boss3:{name:'渡魂鬼将',hp:314,atk:31,armor:11,xp:70,loot:{soul:3,moss:3}},
  boss4:{name:'堕仙残念',hp:410,atk:39,armor:14,xp:100,loot:{star:4,thunder:3}}
 };
 const NAMED={
  '0:1,5':['青岚山门'],'0:2,2':['断碑旧址'],'0:4,4':['碎星祭坛'],'0:5,5':['封尘矿车'],
  '0:6,1':['山间坊市'],'0:7,2':['妖魇洞窟'],'0:7,5':['前往灵谷'],
  '1:0,5':['碧溪营地'],'1:4,4':['净泉灵坛'],'1:7,2':['潜蛟寒潭'],'1:7,5':['前往赤岭'],
  '2:0,5':['赤岭营地'],'2:4,4':['赤焰古炉'],'2:7,2':['熔炎洞府'],'2:7,5':['前往幽沼'],
  '3:0,5':['幽沼营地'],'3:4,4':['镇魂古碑'],'3:7,2':['冥水古殿'],'3:7,5':['前往天阙'],
  '4:0,5':['天阙营地'],'4:4,4':['天阙祭台'],'4:7,2':['破界天门'],'4:7,5':['归途界碑']
 };
 const EVENTS={
  '0:2,2':{text:'断碑中寻得止血草×2。',loot:{herb:2}},
  '0:4,4':{text:'祭坛拾得阵纹残片×1。',loot:{rune:1}},
  '0:5,5':{text:'矿车夹层拾得玄铁矿×2。',loot:{ore:2}},
  '1:2,1':{text:'花丛发现碧灵花×2。',loot:{blossom:2}},
  '2:1,1':{text:'废矿遗留赤铜晶×2。',loot:{copper:2}},
  '3:2,2':{text:'古冢发现幽魂砂×1。',loot:{soul:1}},
  '4:2,2':{text:'遗墟取得星髓矿×2。',loot:{star:2}}
 };
 const RES={
  grass:{mark:'草',name:'灵草',loot:{fiber:1},max:2,minutes:12,xp:1},
  twig:{mark:'枝',name:'枯枝',loot:{wood:1},max:1,minutes:10,xp:1},
  fruit:{mark:'果',name:'灵果',loot:{berry:1},max:1,minutes:10,xp:1},
  stone:{mark:'石',name:'低阶灵石',loot:{stone:1},max:1,minutes:15,xp:1},
  wood:{mark:'木',name:'灵木',tool:'axe',loot:{wood:2},max:2,minutes:20,xp:2},
  ore:{mark:'矿',name:'玄铁矿脉',tool:'pick',loot:{ore:2},max:2,minutes:25,xp:2},
  spiritStone:{mark:'灵',name:'灵石矿脉',tool:'pick',loot:{stone:2},max:1,minutes:23,xp:2},
  spring:{mark:'泉',name:'清泉',loot:{water:2},max:3,minutes:10,xp:1},
  herb:{mark:'药',name:'止血草',loot:{herb:1},max:2,minutes:14,xp:1},
  rune:{mark:'纹',name:'古阵残纹',level:2,spirit:12,loot:{rune:1},max:1,minutes:30,xp:3},
  dew:{mark:'露',name:'碧灵露',loot:{dew:1},max:2,minutes:15,xp:2},
  blossom:{mark:'花',name:'碧灵花',loot:{blossom:1},max:2,minutes:15,xp:2},
  copper:{mark:'铜',name:'赤铜矿',tool:'pick',loot:{copper:2},max:2,minutes:22,xp:3},
  cinder:{mark:'火',name:'焰心砂',tool:'pick',level:4,spirit:10,loot:{cinder:1},max:2,minutes:25,xp:4},
  moss:{mark:'苔',name:'玄阴苔',loot:{moss:1},max:2,minutes:19,xp:3},
  soul:{mark:'魂',name:'幽魂砂',level:5,spirit:12,loot:{soul:1},max:2,minutes:29,xp:4},
  star:{mark:'星',name:'星髓矿',tool:'pick',loot:{star:2},max:2,minutes:26,xp:4},
  thunder:{mark:'雷',name:'雷霆髓',level:6,spirit:16,loot:{thunder:1},max:2,minutes:32,xp:5}
 };
 const RESOURCE_LAYOUT={
  sect:['grass','twig','stone','grass','spring','twig','twig',null,'stone','fruit'],
  plain:['grass','fruit','twig','stone','grass','grass','twig',null,'fruit','grass'],
  forest:['wood','twig','wood','grass','fruit','wood','twig',null,'wood','grass'],
  spring:['grass','spring','herb','spring','fruit','herb','spring',null,'spring','grass'],
  ridge:['stone','spiritStone','stone','stone','twig','grass','stone',null,'spiritStone','stone'],
  mine:['ore','stone','ore','ore',null,'stone','ore',null,'spiritStone','stone'],
  ruins:['rune','stone','rune','herb',null,'stone','rune',null,'grass','rune'],
  bazaar:[null,null,'twig',null,null,null,null,null,null,null],
  boss:[null,null,null,null,null,null,null,null,null,null],
  gate:[null,null,null,null,null,null,null,null,null,null],
  camp:['grass','fruit','twig','spring','herb','fruit','twig',null,'spring','stone'],
  shrine:['herb','stone','rune','grass','twig','herb','stone',null,'grass','rune'],
  flowerfield:['blossom','grass','blossom','fruit','dew','blossom','twig',null,'blossom','grass'],
  pond:['dew','spring','dew','herb','dew','dew','blossom',null,'spring','dew'],
  crag:['copper','stone','copper','cinder','ore','copper','stone',null,'cinder','copper'],
  volcano:['cinder','copper','cinder','stone','ore','cinder','copper',null,'cinder','ore'],
  marsh:['moss','herb','moss','soul','moss','moss','spring',null,'moss','soul'],
  tomb:['soul','rune','moss','soul','soul','herb','moss',null,'soul','rune'],
  astral:['star','star','thunder','stone','rune','star','ore',null,'thunder','star'],
  spire:['thunder','star','thunder','rune','star','thunder','star',null,'thunder','rune']
 };
// Distinct resource chains; no dummy buttons or imaginary drops.
Object.assign(ITEMS,{
 fish:{name:'碧溪灵鱼',wt:1,type:'food',effect:'饱腹 +28，饮水 +6'},
 waterherb:{name:'水灵草',wt:1,type:'material'},venom:{name:'幽沼毒草',wt:1,type:'material'},
 ancient:{name:'上古残卷',wt:1,type:'material'},dust:{name:'灵尘',wt:0,type:'material'},
 rod:{name:'竹钓竿',wt:2,type:'tool'},mana:{name:'回灵丹',wt:1,type:'food',effect:'灵力 +40'},
 detox:{name:'清瘴丹',wt:1,type:'food',effect:'幽沼耗灵减免，持续 240 分钟'},
 fireward:{name:'避火丹',wt:1,type:'food',effect:'赤岭额外耗水减免，持续 240 分钟'},
 meal:{name:'灵鱼干',wt:1,type:'food',effect:'饱腹 +45，饮水 +12'}
});
Object.assign(RES,{
 fish:{mark:'鱼',name:'碧溪灵鱼',tool:'rod',loot:{fish:1},max:2,minutes:20,xp:2},
 waterherb:{mark:'药',name:'水灵草',loot:{waterherb:1},max:2,minutes:16,xp:2},
 venom:{mark:'毒',name:'幽沼毒草',level:5,loot:{venom:1},max:2,minutes:22,xp:3},
 ancient:{mark:'卷',name:'上古残卷',level:6,spirit:14,loot:{ancient:1},max:1,minutes:32,xp:5}
});
RESOURCE_LAYOUT.pond=['dew','spring','fish','waterherb','dew','fish','blossom',null,'spring','dew'];
RESOURCE_LAYOUT.marsh=['moss','herb','venom','soul','moss','moss','spring',null,'moss','soul'];
RESOURCE_LAYOUT.spire=['thunder','star','ancient','rune','star','thunder','star',null,'thunder','rune'];
RECIPES.push(
 {id:'rod',name:'竹钓竿',type:'工具',cost:{wood:2,fiber:3},item:'rod',unique:true,zone:1},
 {id:'mana',name:'回灵丹',type:'丹药',cost:{waterherb:2,dew:1},item:'mana',zone:1},
 {id:'meal',name:'灵鱼干',type:'食物',cost:{fish:2,wood:1},item:'meal',zone:1},
 {id:'fireward',name:'避火丹',type:'丹药',cost:{cinder:1,herb:1},item:'fireward',zone:2},
 {id:'detox',name:'清瘴丹',type:'丹药',cost:{venom:1,herb:1},item:'detox',zone:3}
);
ENEMIES.rabbit={name:'山野灵兔',hp:18,atk:4,armor:0,xp:4,loot:{berry:2,herb:1}};
ENEMIES.fishbeast={name:'灵鳍妖鱼',hp:55,atk:11,armor:2,xp:12,loot:{fish:2,waterherb:1}};
ENEMIES.dummy={name:'练剑木傀',hp:25,atk:4,armor:0,xp:0,loot:{},training:true};
const SITES={
 '0:3,5':{id:'cave',name:'隐居石窟',mark:'洞',text:'石窟内留下旧器，深处传来妖物的动静。',choices:[
  {label:'搜寻洞口',loot:{ore:2,herb:1}},
  {label:'深入石窟',enemy:'wolf',loot:{hide:2},gear:true}]},
 '0:2,6':{id:'cache',name:'山门旧匣',mark:'宝',text:'一只旧匣半掩在草木之间。',choices:[
  {label:'取用补给',loot:{berry:2,water:2}},
  {label:'取用材料',loot:{wood:2,stone:2}}]},
 '1:1,3':{id:'spring',name:'灵泉涌眼',mark:'泉',text:'泉眼凝聚灵息，今日只能择其一用。',choices:[
  {label:'泉水洗髓',restore:true},
  {label:'收集泉露',loot:{dew:3,waterherb:2}}]},
 '1:5,2':{id:'fish',name:'碧潭鱼群',mark:'鱼',text:'一群灵鱼在水草间游动。',choices:[
  {label:'以竿垂钓',tool:'rod',loot:{fish:3}},
  {label:'采水灵草',loot:{waterherb:2,blossom:1}}]},
 '2:3,3':{id:'furnace',name:'赤砂残炉',mark:'炉',text:'残炉仍有余火，可以温养旧器或开炉寻宝。',choices:[
  {label:'开炉炼宝',cost:{cinder:2,copper:2},gear:true,minQuality:1},
  {label:'回收矿料',loot:{copper:2,ore:1}}]},
 '2:5,1':{id:'lava',name:'熔岩遗匣',mark:'宝',text:'遗匣旁的热浪灼人。避火丹可抵御灼伤。',choices:[
  {label:'冒险开匣',loot:{cinder:2,dust:2},damage:8},
  {label:'外围采样',loot:{copper:1,stone:1}}]},
 '3:2,2':{id:'night',name:'古冢夜语',mark:'冢',night:true,text:'只有夜间，碑后的残魂才会现身。',choices:[
  {label:'安抚残魂',cost:{herb:2},loot:{soul:2,ancient:1}},
  {label:'斩除阴魂',enemy:'wraith',loot:{soul:2},gear:true}]},
 '3:5,3':{id:'ferry',name:'阴河渡口',mark:'渡',text:'摆渡者愿以阴材换取救命的药草。',choices:[
  {label:'交换灵尘',cost:{herb:2},loot:{dust:4,moss:1}},
  {label:'沿岸拾取',loot:{moss:2,venom:1}}]},
 '4:2,2':{id:'scroll',name:'断卷石台',mark:'卷',text:'上古残卷仍记载着星阙炼器术。',choices:[
  {label:'拓印残卷',loot:{ancient:2,star:1}},
  {label:'提取灵尘',loot:{dust:5,rune:1}}]},
 '4:5,3':{id:'vault',name:'残星宝库',mark:'塔',text:'灵卫守着旧天阙的遗器，绕行也能取得少量材料。',choices:[
  {label:'挑战守卫',enemy:'sentinel',gear:true,minQuality:2,loot:{ancient:1}},
  {label:'外围搜集',loot:{star:2,thunder:1}}]}
};
const QUALITIES=[
 {name:'普通',mult:1,count:0},{name:'精良',mult:1.12,count:1},{name:'灵器',mult:1.3,count:1},
 {name:'法宝',mult:1.55,count:2},{name:'仙器',mult:1.85,count:2}
];
const QUALITY_WEIGHTS=[[70,25,5,0,0],[60,30,9,1,0],[50,33,15,2,0],[42,35,19,3.8,.2],[32,36,25,6,1]];
const AFFIXES={
 pierce:{name:'破甲',unit:'',slot:'weapon'},crit:{name:'会心',unit:'%',slot:'weapon'},
 leech:{name:'吸血',unit:'%',slot:'weapon'},spell:{name:'术威',unit:'%',slot:'weapon'},
 fire:{name:'焰伤',unit:'',slot:'weapon'},ward:{name:'护元',unit:'',slot:'armor'},
 flow:{name:'回灵',unit:'',slot:'armor'},renew:{name:'回春',unit:'',slot:'armor'}
};
const BOOK_REWARDS=[
 {id:'ten',need:10,name:'初识山野',loot:{stone:2,salve:1}},
 {id:'twentyfive',need:25,name:'行遍山川',loot:{stone:5,pill:2,dust:3}},
 {id:'fortyfive',need:45,name:'博览五境',loot:{dust:8,ancient:1}}
];
const GUIDE=[
 {id:'gather',title:'先拾一份材料',text:'上方点草、枝、石采集。左下角九宫格用于移动，我始终在中央。'},
 {id:'axe',title:'备好伐木工具',text:'打开炼制，制作粗木斧。斧头必须随身携带，放进仓库不能砍树。'},
 {id:'settle',title:'找地方安身',text:'走到营坪、草坡或林地，打开洞府，在此筑庐。选址后才有自己的住所。'},
 {id:'warehouse',title:'先建一间仓房',text:'回到草庐，修建仓房。仓库属于这座洞府，不与其他地图共用。'},
 {id:'storage',title:'亲手存一次、取一次',text:'打开仓库，存入一份材料，再取出来。以后府内建造炼制可直接取用本仓。'},
 {id:'forge',title:'修建炼器室',text:'备齐木、石和青藤，修建一阶炼器室。高级法器还需要升级设施。'},
 {id:'sword',title:'炼第一把法器',text:'在自己的炼器室炼桃木灵剑。系统会自动穿戴评分更高的装备。'},
 {id:'alchemy',title:'丹房与第一炉丹',text:'修建一阶丹房，再炼一颗辟谷丸。回春散仍可在野外研配，丹药需丹房。'},
 {id:'book',title:'查来源与用途',text:'打开图鉴，查看材料、法器和建筑条目。只在需要时阅读，不占主界面。'},
 {id:'train',title:'在洞府安全试剑',text:'点修炼里的试剑。敌方重击先防守，普通回合剑击；练习不损失真实物资。'},
 {id:'travel',title:'安顿好，再远行',text:'打开出行查看五境。接下来收集阵纹，在洞府建山门，再挑战第一境首领。'}
];
const HELP=[
 {
  "id": "start",
  "title": "从散修到洞府",
  "paragraphs": [
   "你从青岚旧营坪出发。这里不是现成宗门，没有免费仓库、炼器室或丹房。初始随身物资为灵木2、低阶灵石1、青藤2、灵果4、清泉水3、回春散2；先采集、做工具，再选一处地方筑庐。",
   "第一次进入选「跟着学」，十一段实操依次是：采一份材料、制斧、择地筑庐、建仓房、亲手存取、建炼器室、炼剑、建丹房并炼辟谷丸、看图鉴、安全试剑、查看出行。每段检查实际行为，不是翻完文字就结束。",
   "引导会检查你携带的工具、所缺材料、所在地、生命和饥渴状态；不够时先补给或找资源。已有设施和装备不要求重复建造。可收起、暂停、跳过或从教程继续；完成奖励只发一次，重播不重复发奖。"
  ]
 },
 {
  "id": "screen",
  "title": "九宫格、地图与按钮",
  "paragraphs": [
   "上方两行资源字格代表当前位置的资源，点草、枝、石、木等直接采集。左下角九宫格中央永远是「我」，点击周围八格走一步，斜向也是一步。每一步都会重新以玩家为中心；边界空位不可点击，不会穿越到地图另一侧。",
   "「展开」显示本境完整8×8文字地图，点目的地后收起浮层并逐格寻路。遇敌、进入奇遇或到达界碑会停步；点「停步」、其他移动格或打开面板也会取消路线。未完成仪式不能进入首领格。",
   "地图「府」是你自己的洞府，「坪」只是未建设的旧营坪。「回府」沿路走回本境洞府，会正常耗时耗粮、也可能遇敌；没有洞府时这个按钮显示「定居」。出行菜单可以前往已开放的区域，跨境抵达该境自建洞府或旧营坪，不会自动送一套房。",
   "主界面没有滚动：资源、随身栏、九宫格和五个功能入口位置固定。洞府、仓库、炼制、背包、图鉴、教程都在固定浮层操作，长内容在内部滑动，关闭按钮不滚走。采集与缺条件提示只悬浮，不挤动页面。"
  ]
 },
 {
  "id": "settle",
  "title": "选址、筑庐与迁居",
  "paragraphs": [
   "先走到候选格，再点「洞府 → 在此筑庐」。可定居的地形包括旧营坪、草坡、林地、石岗、花田；水域、矿洞、首领、祭坛、界碑、固定奇遇点不能覆盖。面板会显示已到访的合适地点，以及附近水源、林地、矿材的提示。邻近标签帮助选路，不代表自动产出加成。",
   "筑庐消耗随身灵木4、青藤2、低阶灵石2，耗时120游戏分钟。确认成功后才有一阶草庐，可休息、补给、吐纳和安全试剑；仓房、炼器室、丹房仍要各自修建。每个区域最多一座洞府，全图最多五座。",
   "迁居前在原仓取好材料，走到新的合适格，点洞府中的「迁居到此」。确认消耗随身灵木3、青藤2、灵石2和180分钟；原有建筑、仓物与灵田计时完整转移，旧地点恢复原标记，不产生第二座洞府或第二份物资。取消确认不扣料。",
   "选址失败、材料不足、战斗中或地点受保护时不会扣除建造材料和时间。正常建造会推进游戏时间并消耗生存状态，开工前先吃喝，避免工作期间负伤。"
  ]
 },
 {
  "id": "build",
  "title": "洞府与七类设施",
  "paragraphs": [
   "洞府入口把住所、仓房、炼器室、丹房、静室、灵田、山门集中在一个面板。每张建筑卡分别写清当前等级、下一级材料、前置要求和建成后的效果；点建造或升级后立即结算游戏时间，不要求在现实中等进度条。",
   "住所一阶为草庐，二阶为石筑洞府，三阶为灵脉道院。二、三阶住所分别开放对应等级的高级设施。升级住所不会免费升级其他房间；不同区域的建筑等级也不互相共享。",
   "二阶住所需木8、石5、玄铁矿2；三阶需木10、石8、赤铜晶3、阵纹1。仓房共有三阶，炼器室三阶，丹房三阶，静室三阶，灵田两阶，青岚山门一阶。所有等级材料与完整效果可在建筑卡和图鉴的建筑分类中查询。",
   "第一座府建议先仓房，再炼器室和丹房；升级住所、静室、灵田按资源安排，不必为了过第一境立即造满。后续可以把青岚发展为主要生产基地，也可以在新境建设当地工坊，减少搬运与折返。"
  ]
 },
 {
  "id": "storage",
  "title": "本地仓库与地上遗物",
  "paragraphs": [
   "仓房容量按物品重量计算，一至三阶分别为80、180、360。必须亲自在这一境的自建洞府，且建有仓房，才可存取。每境仓库独立：在碧溪不能用青岚仓里的矿，野外也不能隔空取料。",
   "府内营建、炼制等耗材行动自动合计随身和当前可用本仓，优先扣随身。物品留在仓中不必先拿出再造物；但伐木斧、石镐、钓竿必须随身，仓里的工具不能远程生效。没有仓房时只计算随身。",
   "「材料存仓」只批量存材料，保留食物和工具；单项按钮可存其他物品。仓容量不足会只存能容纳的部分，余物仍在身上。取1、取5同样受行囊负重约束，不会把物品吞掉。",
   "普通采集超重会整次拒绝，不消耗资源。战斗、奇遇、图鉴、灵田等奖励超重时，余物留在当前格，显示「原地待拾」。腾出空间后回到原地点点「拾遗」，或背包内拾取，不会自动飞到仓房。",
   "装备独立占用器囊36格，不计材料重量。器囊满的战利品进入带发现坐标的待领取列表，需要回原地点且腾位才能领取；最多64件待领取，继续溢出的装备转成灵尘。物资不会因为切地图而自动消失或复制。"
  ]
 },
 {
  "id": "gather",
  "title": "采集条件与资源刷新",
  "paragraphs": [
   "草得青藤，枝得灵木，石得低阶灵石；木一次得灵木2，须有粗木斧。矿、灵、铜、火、星使用石镐。鱼需要竹钓竿，药字对应当地药草，具体产物在图鉴查看。",
   "阵纹需炼气二层与12灵力；焰心砂需四层、石镐、10灵力；幽魂砂需五层与12灵力；毒草需五层；雷霆髓需六层与16灵力；残卷需六层与14灵力。特殊地形可能再增加环境耗灵，条件不足会明确提示。",
   "字格下的×N是当天可采次数。采尽保留格位、显示「—」，跨过游戏午夜恢复。每境、坐标和槽位独立保存；切境、建房、迁居不会把已经消耗的节点直接刷满。点自己所在的「我」不是采集。",
   "工具不消耗耐久，不需要装备到武器槽，只需在随身。工具、修为、灵力、负重不达标时，失败不扣时间、物资或节点次数。资源要求与建筑等级是两种不同门槛，不能用高级炼器室代替采矿工具。"
  ]
 },
 {
  "id": "survival",
  "title": "吃喝、休息与时间",
  "paragraphs": [
   "移动一格耗30分钟、饱腹2、饮水3、灵力3。采集通常耗饱腹2、饮水2、至少3灵力，特殊资源按各自设定。赤岭每30分钟额外耗水1；幽沼和天阙额外耗灵1。昼夜与资源成长按行动推进，关闭网页不会自动生长。",
   "灵果补22饱腹，水补30饮水，回春散补32气血；辟谷丸补42饱腹和8饮水；灵鱼补28饱腹和6饮水；灵鱼干补45饱腹和12饮水；回灵丹补40灵力。满值时无效消耗会拦截。",
   "野外调息恢复28灵力，耗50分钟、5饱腹、6饮水。自建洞府休息耗3小时，一至三阶住所分别恢复48/60/72气血与78/90/102灵力；每境每天前两次普通休息附送25饱腹和30饮水。旧营坪没有这些服务。",
   "在自己的洞府可花灵石1补35饱腹和40饮水；或花灵石1休至18点夜间、次日7点，恢复全部气血灵力并把饱腹饮水置85。材料可以用本仓支付。长休是消耗游戏时间，不是现实挂机。",
   "饱腹或饮水为零，每次耗时行动扣6气血；灵力为零另扣2。行动中的环境消耗也要预留。生命危险先用回春散，吃喝补足再回府；没有住所时先用野外调息与随身补给，不要盲目反复采集。"
  ]
 },
 {
  "id": "forge",
  "title": "炼器室与高级法器",
  "paragraphs": [
   "粗木斧、石镐、竹钓竿和便携回春散、灵鱼干不需要房间；其他剑、衣、探灵符要在自己的炼器室生产。配方所需房间等级与区域开放条件同时成立才可炼制。缺设施或缺材料时不会扣料。",
   "炼器室一阶：桃木灵剑、青藤道袍、妖皮护甲、探灵符，允许精炼+1。二阶：玄铁法剑、碧溪与赤铜武器防具，允许精炼+2。三阶：玄阴与天阙武器防具，允许精炼+3。造二、三阶炼器室还需先升级住所。",
   "合适设施只约束生产和精炼；在野外拾到的高级法器可以直接穿戴，不要求先建同阶房间。装备不是消耗一次的配方标记，每次炼器会生成独立实例，可比较、穿戴与分解。",
   "把高级材料运回低阶区域生产是可行的，只要房间和配方条件已满足；品质概率仍取决于你生产时所在区域。想在更高品质概率的区域持续刷器，可建设那一境的炼器室，而不是五境共享一个虚拟工坊。"
  ]
 },
 {
  "id": "alchemy",
  "title": "丹房与服丹次数",
  "paragraphs": [
   "丹房一阶制作辟谷丸、回灵丹、凝元丹；二阶制作避火丹、清瘴丹；三阶制作培元丹。部分丹方须先开放相应区域并取得材料。便携回春散不受丹房限制，新人受伤仍有补救途径。",
   "凝元丹配方为止血草3、灵石1，服用增加18修为与20灵力。培元丹配方为玄阴苔2、上古残卷1、碧灵露1，服用增加36修为与30灵力。两种修为丹合计每天最多服2次，跨区域或迁居不能重置次数。达到18层后不再消耗修为丹。",
   "避火丹持续240游戏分钟，免赤岭额外耗水并抵御遗匣灼伤；清瘴丹持续240分钟，减免幽沼额外耗灵。清瘴不能免除天阙的耗灵。重复服用不会变成永久增益。",
   "丹药从炼制面板选择丹药分类，材料不足可在图鉴查来源。原地点击房间入口只切换同一个固定浮层，不会打开新网页。本版炼丹不另设随机失败与品质，配方条件达到后稳定产出。"
  ]
 },
 {
  "id": "quiet",
  "title": "静室、灵田与修为",
  "paragraphs": [
   "采集和实战得修为，达到10＋当前层数×5后自动突破。每层基础攻击+1、气血上限+9、灵力上限+2、负重上限+3，最高18层。基础行囊负重46。",
   "未建静室时，在自己的草庐也能吐纳，每次花灵石1和60分钟，得8修为、12灵力。静室一至三阶分别提升为12/16/22修为与24/28/36灵力。所有洞府共用每日3次吐纳，不因换地图重置。",
   "一阶灵田在建成24游戏小时后可收止血草2、灵果2；二阶收止血草3、灵果3、水灵草1。必须回到自己的田收获，满包部分落在当前府格。只积累一批，不会离线刷出多批。",
   "灵田收获后重新计时，升级后从升级完成时重新计时，迁居保留原有计时。新建灵田不能立即领取，反复点击、存读档和重进地图也不能提前领取。静室与灵田是便利选项，不是第一境必造前置。"
  ]
 },
 {
  "id": "quest",
  "title": "山门、祭坛与五境",
  "paragraphs": [
   "原来开局赠送的青岚山门已经移除。第一境要在你自己选址的洞府中，消耗灵木4、灵石3、阵纹2修建山门与护山阵，才开放噬灵妖魇的妖窟。山门是实际建筑，不要求回原始旧营坪。",
   "第二至第五境保留地图上的固定祭坛：碧溪净泉需碧灵露3、碧灵花3、止血草2；赤岭镇火需赤铜晶4、焰心砂2、玄铁矿2；幽沼镇魂需玄阴苔4、幽魂砂2、止血草2；天阙启门需星髓矿4、雷霆髓2、阵纹2。祭坛不能建府，任务材料必须随身带到现场。",
   "主线顺序为青岚山麓、碧溪灵谷、赤砂火岭、玄阴幽沼、天阙遗境。每境先仪式后首领，击败后开放下一境，五境各有64格。已开放区域可往返，最终通关仍能探索和营建。",
   "不必在每境把全部建筑造满才能打首领。已解锁配方可在具备等级的旧府制作，然后携装备前往新境；新境定居的价值在于休整、补给、独立仓储与更少折返。顶部任务可展开查看材料缺口与首领地点。"
  ]
 },
 {
  "id": "combat",
  "title": "斗法、试剑与负伤",
  "paragraphs": [
   "剑击不额外消耗技能灵力；剑诀需9灵力，基础倍率1.7。真实战斗每回合推进15分钟，并消耗饱腹1、饮水1、灵力2，还会受到地形额外消耗。战斗过程中不能建房、搬仓或跨境。",
   "敌方下次行动提前显示。重击约1.65倍攻击，防守把受击降至25%，回复10灵力并蓄势给下次攻击+4。敌人调息时适合出手。回春散占一个战斗回合；普通敌人撤离有80%成功率，首领不可撤离。",
   "气血为零返回本境自建洞府；尚未定居则退回旧营坪，不因此白送住所。损失一半随身普通材料，保留境界、工具、食物、装备、建筑、仓物、图鉴和进度，不删档。",
   "「修炼 → 试剑」仅在自己的洞府可用。练剑木傀不掉战利品，不得修为，不损失真实食物和药物；结束后还原训练前状态。教程会用这场练习教你识别重击，不能靠它刷宝。"
  ]
 },
 {
  "id": "gear",
  "title": "品质、词条与精炼",
  "paragraphs": [
   "装备品质依次为普通、精良、灵器、法宝、仙器，基础倍率为1、1.12、1.30、1.55、1.85。精良、灵器带1条词条，法宝、仙器带2条不同词条。自动穿戴评分更高的同部位装备，旧装备保留在器囊。",
   "武器词条包括破甲、会心、吸血、术威和焰伤；防具包括护元、回灵和回春。这些词条分别参与破防、暴击、伤害恢复、剑诀倍率、附加伤害、防伤和防守恢复，不是只显示文字。",
   "精炼+1/+2/+3需炼器室至少1/2/3阶，分别花4/8/12灵尘；每一级增加品质折算后基础属性的8%，保留品质与词条。只能在自己的足级炼器室精炼，未穿戴装备可分解，穿戴中的装备不能直接分解。",
   "普通/精良/灵器/法宝/仙器概率按所在境分别为：青岚70/25/5/0/0；碧溪60/30/9/1/0；赤岭50/33/15/2/0；幽沼42/35/19/3.8/0.2；天阙32/36/25/6/1，单位为百分比。首领掉装至少精良，部分遗迹另有保底。"
  ]
 },
 {
  "id": "events",
  "title": "奇遇、遗器与再战",
  "paragraphs": [
   "五境各有两处可重复奇遇，包括隐居石窟、旧匣、灵泉、鱼群、残炉、熔岩遗匣、古冢夜语、阴河渡口、残卷石台与宝库。到达点探查，两项选择只能完成其一；关闭不扣次数，完成后当天不能重复领奖。",
   "古冢夜间18点至次日6点开放，其他需要工具、材料或防护的选择会给出提示。固定奇遇地块禁止筑庐，避免把探索内容覆盖掉。奇遇奖励超重留在原处，回来拾取。",
   "普通野怪有22%机会掉装备，首领必掉一件；通关后可隔日在首领格再战，生命与攻击提高25%，仍有修为和保底精良装备。重复击败不重复解锁或反复弹最终通关窗。",
   "每天资源与奇遇刷新、灵田可产出、装备可重复炼制，但不要求现实等待。本版没有离线收益、抽卡、广告、付费建筑、联网排行榜或宗门弟子管理。"
  ]
 },
 {
  "id": "book",
  "title": "图鉴与建筑记录",
  "paragraphs": [
   "灵物按真正获得或产生的可拾奖励登记，法器按获得记录，敌人遭遇后登记并记录击败次数。建筑按真正建成的类型登记，最高等级从现有洞府计算；同类房间造五次仍只算一个建筑条目。",
   "图鉴可按灵物、法器、妖兽、建筑筛选，并搜索名称。灵物显示实际来源、用途和配方；建筑显示各阶材料与效果。未知物品只给区域线索，不需手动点亮。木傀训练不计妖兽图鉴。",
   "发现不同条目达到10、25、45可各领一次奖励。领取记录跟随存档，刷新页面、重播教程或跨境不能重复领取。满包奖励留在领取时所在格，不会越过仓房规则自动入仓。"
  ]
 },
 {
  "id": "save",
  "title": "保存、旧档与更新",
  "paragraphs": [
   "每次有效操作后尝试本地自动保存，设置中显示状态。换文件、浏览器、网址或设备前，先导出JSON；不同文件路径不一定共用存储空间，不能指望新HTML自动读到旧HTML里的数据。",
   "V9使用独立存档键。能读取到同一来源的V8/V7/V5等旧键时，复制迁移而不是修改旧档；已解锁区域的旧营地转换为可用洞府，并按进度给予相应设施，避免老角色突然失去制作能力。旧共享仓只迁入青岚洞府一次，其余新仓为空。旧仓超容量物资保留，但先整理到容量内才能继续存。",
   "旧版装备、词条、地图、任务、图鉴等保留；旧教程改为暂停，可从教程重新体验营建流程，已有奖励不重复发放。想体验从零找营地，请先导出旧档，再在设置选择重新开始；不要直接覆盖唯一进度。",
   "导入JSON经过格式校验和确认，导入前进度留一份备份。备份只保留上一份且会随后续操作更新，长期备份请自己保留导出文件。浏览器拒绝存储时明确提示未能落盘，此时仍可导出，但不能把内存进度当作已保存。"
  ]
 },
 {
  "id": "faq",
  "title": "常见卡点",
  "paragraphs": [
   "有木石却不能造剑：先定居，建炼器室，并亲自回到它所在的洞府。玄铁剑需二阶炼器室，不能把高阶材料放在一级房间里直接绕过限制。丹药同样检查丹房等级。",
   "背包里似乎材料齐了却造不了：检查是否在本府，或材料实际上在另一境仓库。野外只能花随身材料。仓库是各地独立的，跨境前取出计划用的材料、食物和工具。",
   "教程缺材料反复来回：优先跟高亮去合适资源点，注意草、枝、木产物不同；看到饥渴提示先吃喝，已有住所时可休息补给。采尽等待游戏跨日或换一个节点，不需要刷新网页。",
   "新营坪不能休息或存仓：它还不是你的房子。点洞府先筑庐，再建仓房。无法选址时换草坡、林地、石岗、花田或旧营坪，避免水域、矿洞和奇遇点。",
   "列表没显示完：在固定浮层内用手指或滚轮滑动；关闭按钮始终在顶部。主屏与完整地图不需要下拉。可用高度低于500像素时请转回竖屏或增大窗口；全屏地图收起后继续九宫格移动。"
  ]
 }
];
// V9 settlements: old map camps are now unowned, buildable clearings.
ZONES[0].map[5][1]='campsite';
for(let z=1;z<5;z++)ZONES[z].map[5][0]='campsite';
LAND.campsite={name:'废弃营坪',mark:'坪',risk:'低'};
RESOURCE_LAYOUT.campsite=RESOURCE_LAYOUT.sect.slice();
NAMED['0:1,5']=['青岚旧营坪','坪'];
for(let z=1;z<5;z++)NAMED[z+':0,5']=[ZONES[z].short+'旧营坪','坪'];
ZONES[0].altar='自建山门';ZONES[0].verb='立山门';
const CAMP_LANDS=['plain','forest','ridge','flowerfield','campsite'];
const SETTLE_COST={wood:4,fiber:2,stone:2};
const MOVE_CAMP_COST={wood:3,fiber:2,stone:2};
const BUILDINGS={
 residence:{name:'洞府',mark:'居',levels:[
  {name:'草庐',cost:SETTLE_COST,minutes:120,effect:'定居；休整、简餐与安全试剑'},
  {name:'石筑洞府',cost:{wood:8,stone:5,ore:2},minutes:180,effect:'开放二阶设施；休息恢复60气血、90灵力'},
  {name:'灵脉道院',cost:{wood:10,stone:8,copper:3,rune:1},minutes:240,effect:'开放三阶设施；休息恢复72气血、102灵力'}]},
 warehouse:{name:'仓房',mark:'仓',levels:[
  {cost:{wood:3,fiber:2},minutes:60,home:1,effect:'本地仓库容量80；府内炼制自动取料'},
  {cost:{wood:5,stone:3},minutes:90,home:1,effect:'本地仓库容量180'},
  {cost:{wood:8,ore:3},minutes:120,home:2,effect:'本地仓库容量360'}]},
 forge:{name:'炼器室',mark:'器',levels:[
  {cost:{wood:4,stone:3,fiber:1},minutes:90,home:1,effect:'桃木剑、青藤袍、妖皮甲、探灵符；精炼+1'},
  {cost:{wood:5,ore:4,stone:4},minutes:120,home:2,effect:'玄铁、碧溪、赤铜法器；精炼+2'},
  {cost:{copper:4,ore:4,cinder:2,rune:1},minutes:180,home:3,effect:'玄阴与天阙法器；精炼+3'}]},
 alchemy:{name:'丹房',mark:'丹',levels:[
  {cost:{wood:3,stone:2,herb:2},minutes:90,home:1,effect:'辟谷丸、回灵丹、凝元丹'},
  {cost:{blossom:2,dew:2,ore:2},minutes:120,home:2,effect:'避火丹、清瘴丹'},
  {cost:{moss:2,soul:1,star:1},minutes:180,home:3,effect:'培元丹；与凝元丹共用每日服用次数'}]},
 quiet:{name:'静室',mark:'静',levels:[
  {cost:{wood:3,fiber:2,stone:2},minutes:60,home:1,effect:'每次吐纳修为12、灵力24'},
  {cost:{rune:2,wood:4,dew:2},minutes:90,home:2,effect:'每次吐纳修为16、灵力28'},
  {cost:{soul:2,rune:2,star:2},minutes:120,home:3,effect:'每次吐纳修为22、灵力36'}]},
 farm:{name:'灵田',mark:'田',levels:[
  {cost:{wood:3,fiber:3,water:2},minutes:60,home:1,effect:'24游戏小时后收止血草2、灵果2'},
  {cost:{dew:2,waterherb:2,wood:4},minutes:90,home:2,effect:'24游戏小时后收止血草3、灵果3、水灵草1'}]},
 gate:{name:'山门',mark:'门',zone:0,levels:[
  {cost:{wood:4,stone:3,rune:2},minutes:70,home:1,effect:'立青岚山门、稳固护山阵，开放本境妖窟'}]}
};
const ROOM_REQUIREMENTS={
 woodSword:['forge',1],robe:['forge',1],hideRobe:['forge',1],talisman:['forge',1],
 ironSword:['forge',2],springSword:['forge',2],springRobe:['forge',2],emberSword:['forge',2],emberRobe:['forge',2],
 yinSword:['forge',3],yinRobe:['forge',3],skySword:['forge',3],skyRobe:['forge',3],
 pill:['alchemy',1],mana:['alchemy',1],fireward:['alchemy',2],detox:['alchemy',2]
};
for(const r of RECIPES){const rule=ROOM_REQUIREMENTS[r.id];if(rule){r.room=rule[0];r.tier=rule[1];r.home=true;}}
ITEMS.focus={name:'凝元丹',wt:1,type:'food',effect:'修为+18、灵力+20；修为丹每日共2次'};
ITEMS.elixir={name:'培元丹',wt:1,type:'food',effect:'修为+36、灵力+30；修为丹每日共2次'};
RECIPES.push(
 {id:'focus',name:'凝元丹',type:'丹药',cost:{herb:3,stone:1},item:'focus',home:true,room:'alchemy',tier:1},
 {id:'elixir',name:'培元丹',type:'丹药',cost:{moss:2,ancient:1,dew:1},item:'elixir',home:true,room:'alchemy',tier:3,zone:3}
);
const FARM_LOOT=[{}, {herb:2,berry:2}, {herb:3,berry:3,waterherb:1}];
// A calendar day ages the player by a quarter year. Defeat is a much bigger irreversible loss.
const LIFE={yearMinutes:5760,initialYears:56,defeatYears:16,elixirYears:8,elixirLimit:2,breakthroughYears:{3:3,6:4,9:4,12:5,15:6,18:8}};
ITEMS.lifespanPill={name:'延寿丹',wt:1,type:'food',effect:'寿元+8年，整局最多服用2次'};
RECIPES.push({id:'lifespanPill',name:'延寿丹',type:'丹药',cost:{star:2,thunder:1,soul:2,ancient:1},item:'lifespanPill',home:true,room:'alchemy',tier:3,zone:4});
HELP.push({id:'lifespan',title:'寿元与轮回（重要）',paragraphs:[
 '新角色剩余寿元56年。每经过4个游戏日，寿元减少1年。所有会推进游戏时间的行动都算在内，包括长休。关闭网页并不会推动游戏时间。',
 '每次战败或因饥渴倒下额外折寿16年，回营疗伤另需半个游戏日。突破到炼气三、六、九层及筑基初中后期等指定等级，会获得一次寿元增长。',
 '三阶丹房可炼延寿丹，首次服用增加8年寿元；整局至多2次。游戏内“设置”和顶部状态可以查看寿元剩余。',
 '寿元降为0后本轮永久结束：当前V10存档、V10自动备份以及同来源旧版本的继承存档会被清除；点击“重新轮回”才能新开。提前备份或外部导入属于离线游戏无法完全阻止的手动回档，不等于游戏内自动复活。'
]});

const D={VERSION:10,SAVE:'qinglan-wendao-v10',DEATH_KEY:'qinglan-wendao-v10-permadeath',LIFE,LEGACY:['qinglan-wendao-v9','qinglan-wendao-v8','qinglan-wendao-v7','qinglan-cultivation-five-v5','qinglan-cultivation-demo-v2','qinglan-cultivation-demo-v1'],ZONES,LAND,ITEMS,RECIPES,ENEMIES,NAMED,EVENTS,RES,RESOURCE_LAYOUT,SITES,QUALITIES,QUALITY_WEIGHTS,AFFIXES,BOOK_REWARDS,GUIDE,HELP,BUILDINGS,CAMP_LANDS,SETTLE_COST,MOVE_CAMP_COST,FARM_LOOT};
root.QData=D;
if(typeof module!=='undefined'&&module.exports)module.exports=D;
})(globalThis);
