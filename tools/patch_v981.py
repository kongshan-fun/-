from pathlib import Path
import hashlib
src=Path("releases/山野修仙记_V90.80_TapTap适配版.html")
s=src.read_text(encoding="utf-8")
def rep(old,new,label,count=1):
 global s
 n=s.count(old)
 assert n==count, label+" expected "+str(count)+" got "+str(n)
 s=s.replace(old,new,count)
rep("""        if (isGameKey(k)) {
          var v = ls.getItem(k);
          if (v !== null) { keys[k] = v; n++; }
        }""","""        if (isGameKey(k) && !/-(?:presync-backup|restore-stage|restore-rollback)$/.test(k)) {
          var v = ls.getItem(k);
          if (v !== null) { keys[k] = v; n++; }
        }""","exclude snapshots")
rep("""  function hasLocalMainSave() {
    try {
      var ls = globalThis.localStorage;
      for (var i = 0; i < ls.length; i++) {
        var k = ls.key(i);
        if (k && k.indexOf('qinglan-wendao-v14-') === 0) return true;
      }
    } catch (e) {}
    return false;
  }""","""  function hasLocalMainSave() {
    try {
      var ls = globalThis.localStorage;
      for (var i = 0; i < ls.length; i++) {
        var k = ls.key(i);
        if (!k || !/^qinglan-wendao-v14-(?:(?:easy|standard|challenge)-)?(?:sword|herb)-slot-\\\\d{3}$/.test(k)) continue;
        var raw = ls.getItem(k);
        if (!raw) continue;
        try {
          var state = JSON.parse(raw);
          if (state && state.version === 14 && state.rebuilt === 1 &&
              (state.race === 'sword' || state.race === 'herb') &&
              Number.isInteger(state.level) && state.level >= 1) return true;
        } catch (e) {}
      }
    } catch (e) { log('local save probe failed', e); }
    return false;
  }""","valid local save")
a=s.index("  function applyPayload(payload) {"); b=s.index("\n  function restoreCloud(uuid) {",a)
s=s[:a]+"""  function applyPayload(payload) {
    var incoming=payload&&payload.keys;
    if(!incoming||typeof incoming!=='object'||Array.isArray(incoming))throw Error('云存档内容无法识别');
    var ls=globalThis.localStorage,clean={};
    Object.keys(incoming).forEach(function(k){
      if(!isGameKey(k)||k===UUID_KEY||/-(?:presync-backup|restore-stage|restore-rollback)$/.test(k))throw Error('云存档包含不允许恢复的键：'+k);
      if(typeof incoming[k]!=='string')throw Error('云存档键值格式错误：'+k);
      clean[k]=incoming[k];
    });
    if(!Object.keys(clean).length)throw Error('云存档没有可恢复的角色数据');
    var before={};
    for(var i=0;i<ls.length;i++){var k=ls.key(i);if(isGameKey(k)&&k!==UUID_KEY&&!/-(?:presync-backup|restore-stage|restore-rollback)$/.test(k)){var v=ls.getItem(k);if(v!==null)before[k]=v;}}
    var backupKey='__qtap_presync_backup_v1__',stageKey='__qtap_restore_stage_v1__';
    var backup=JSON.stringify({v:1,reason:'before-cloud-restore',ts:Date.now(),keys:before});
    var stage=JSON.stringify({v:1,ts:Date.now(),keys:clean});
    try{ls.setItem(backupKey,backup);if(ls.getItem(backupKey)!==backup)throw Error('恢复前备份校验失败');ls.setItem(stageKey,stage);if(ls.getItem(stageKey)!==stage)throw Error('临时云档校验失败');}
    catch(e){try{ls.removeItem(stageKey)}catch(_){}throw Error('无法建立可靠的恢复保护，未改动本地存档：'+(e.message||e));}
    try{
      Object.keys(clean).forEach(function(k){ls.setItem(k,clean[k]);if(ls.getItem(k)!==clean[k])throw Error('写入后校验不一致：'+k);});
      Object.keys(clean).forEach(function(k){if(ls.getItem(k)!==clean[k])throw Error('恢复复核失败：'+k);});
      Object.keys(before).forEach(function(k){if(!Object.prototype.hasOwnProperty.call(clean,k))ls.removeItem(k);});
      Object.keys(clean).forEach(function(k){if(ls.getItem(k)!==clean[k])throw Error('最终复核失败：'+k);});
      try{ls.removeItem(stageKey)}catch(_){}
      log('cloud restore committed ('+Object.keys(clean).length+' keys)');
      return Object.keys(clean).length;
    }catch(err){
      var rollbackError=null;
      try{
        var current=[];for(var j=0;j<ls.length;j++){var ck=ls.key(j);if(isGameKey(ck)&&ck!==UUID_KEY&&!/-(?:presync-backup|restore-stage|restore-rollback)$/.test(ck))current.push(ck);}
        current.forEach(function(k){ls.removeItem(k);});
        Object.keys(before).forEach(function(k){ls.setItem(k,before[k]);});
        Object.keys(before).forEach(function(k){if(ls.getItem(k)!==before[k])throw Error('回滚校验失败：'+k);});
      }catch(rb){rollbackError=rb;}
      try{ls.removeItem(stageKey)}catch(_){}
      if(rollbackError)throw Error('云存档恢复失败，自动回滚未能完成；保护快照保留在本机：'+(rollbackError.message||rollbackError));
      throw Error('云存档恢复失败，已完整恢复原本地存档：'+(err.message||err));
    }
  }"""+s[b:]
a=s.index("  function restoreCloud(uuid) {");b=s.index("\n  /* ==========================================================================",a);c=s[a:b]
c=c.replace("      var uuid = uuid || archiveUuid();\n      if (!uuid)","      var archiveId = uuid || archiveUuid();\n      if (!archiveId)")
c=c.replace("list[i].uuid === uuid","list[i].uuid === archiveId").replace("archiveUUID: uuid","archiveUUID: archiveId")
assert "var uuid = uuid ||" not in c
s=s[:a]+c+s[b:]
rep("summary: '山野修仙记 V56 · '","summary: '山野修仙记 V90.81 · '","cloud version")
# Tutorial step 7 points at the actual forge entrance when the camp panel is open.
rep("if(step===6)return recipeGuide('woodSword');","if(step===6){if(panel==='camp')return {selector:'[data-a=\"facility-open\"][data-name=\"facility-forge\"]',tip:'点击洞府中的炼器室，进入后制作桃木灵剑。'};return recipeGuide('woodSword');}","forge tutorial")
# Replace hunger branch by source offsets; never suggest resting to replenish food.
a=s.index(" if(s.hunger<30){");b=s.index("\n if(step===0)",a)
s=s[:a]+""" if(s.hunger<30){
  const food=['berry','pill','meal','fish'].find(id=>s.inv[id]>0);
  if(food)return {selector:food==='berry'?'#food-button':'#pack-button',tip:'先使用行囊中的食物恢复饱腹；休息不会代替进食。'};
  return resourceGuide('berry');
 }"""+s[b:]
rep("材料已备齐！返回洞府建造，或前往炼制完成制作。","材料已备齐！返回洞府进入对应建筑完成制作。","goal footer")
rep("{id:'sword',title:'炼制第一把法剑',text:'打开「炼制」，备好桃木灵剑所需材料，在炼器室打造你的第一把武器。完成后留意综合战力的变化。'},","{id:'sword',title:'炼制第一把法剑',text:'在洞府点击「炼器室」，找到桃木灵剑配方并制作。完成后会自动装备，留意综合战力的变化。'},","guide copy")
rep("每次行动原有的饱腹、饮水消耗保持不变。","饱腹与饮水的基础消耗会随境界提升而降低；第七境领悟灵息辟谷后，可自行开启真元/妖元抵扣普通饥渴消耗，能量储备不足或处于战斗、回灵修行时会暂停。炎热等环境额外消耗仍需补给。","hunger help")
rep("不承诺200份满进度都装得下","两族各有简单、标准、挑战三种难度，每种难度各100个独立档位，共600个逻辑档位；浏览器本地存储仍受设备配额限制，建议定期导出JSON备份","slot help",2)
rep("this.note('入门完成 · 回春散2、辟谷丸1','ok','guide-complete');","this.note('基础入门完成 · 回春散2、辟谷丸1。接下来从青岚山麓开始主线：修复山门封印、击败本境首领，再回洞府满足破境条件。','ok','guide-complete');","onboarding completion")
assert "山野修仙记 V56 · " not in s
out=Path("releases/山野修仙记_V90.81_TapTap修复版.html");out.parent.mkdir(parents=True,exist_ok=True);out.write_text(s,encoding="utf-8")
Path("index.html").write_text(s,encoding="utf-8")
print("V90.81 bytes",len(s.encode()),"SHA256",hashlib.sha256(s.encode()).hexdigest().upper())
