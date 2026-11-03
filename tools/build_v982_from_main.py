#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Deterministic V90.82 patch chain from frozen V90.80."""
from pathlib import Path
import hashlib
import json
import build_v981_from_main as previous
ROOT=Path(__file__).resolve().parents[1]
RELEASES=ROOT/"releases"
BASE=RELEASES / "山野修仙记_V90.80_方正纸墨.html"
BASE_SHA="3351E8A8509C60A4506BBA1DEC954DAE5C96B2ABCC1B36AD530C33BBEEC057D6"
OUT_NAME="山野修仙记_V90.82_P0P1稳定性修复.html"
EDITS=json.loads(r'''[["if(old.race!==id||old.difficulty!==this.difficulty)throw Error('旧灵田归档身份不符');","if(old.race!==id||old.character!==id||(old.difficulty===undefined?'challenge':old.difficulty)!==this.difficulty)throw Error('旧灵田归档身份不符');",1],["saved.version!==14||saved.race!==id||saved.character!==id||saved.difficulty!==this.difficulty||","saved.version!==14||saved.race!==id||saved.character!==id||(saved.difficulty===undefined?'challenge':saved.difficulty)!==this.difficulty||",1],["previous.race!==id||previous.character!==id||previous.difficulty!==this.difficulty||","previous.race!==id||previous.character!==id||(previous.difficulty===undefined?'challenge':previous.difficulty)!==this.difficulty||",1],["if(options.requireBackup&&this.readKey(this.backupKey(id,n))!==prior)throw Error('备份写入校验失败');","if(this.readKey(this.backupKey(id,n))!==prior)throw Error('备份写入校验失败');",1],["if(options.requireBackup)throw Error('原档备份失败，已取消覆盖：'+e.message);\n     // Normal autosave retains its historical best-effort backup behavior.","throw Error('原档备份失败，已取消覆盖：'+e.message);",1],["  this.storage.setItem(key,raw);return true;","  try{\n   this.storage.setItem(key,raw);\n   if(this.readKey(key)!==raw)throw Error('主档写入读回校验失败');\n  }catch(e){\n   let recovered=false;\n   try{\n    if(prior===null){this.storage.removeItem(key);recovered=this.readKey(key)===null;}\n    else{this.storage.setItem(key,prior);recovered=this.readKey(key)===prior;}\n   }catch{}\n   throw Error('保存失败：'+e.message+(recovered?'；原档已恢复':'；请从自动备份恢复并导出'));\n  }\n  return true;",1],["case 'core-trial-start':case 'tribulation-start':result=this.coreTrialStart();break;case 'core-trial-act':case 'tribulation-act':result=this.coreTrialAct(args.mode);break;case 'heart-trial-start':case 'heart-start':result=this.heartTrialStart();break;case 'heart-trial-act':case 'heart-act':result=this.heartTrialAct(args.mode);break;","case 'core-trial-start':case 'tribulation-start':case 'core-trial-act':case 'tribulation-act':case 'heart-trial-start':case 'heart-start':case 'heart-trial-act':case 'heart-act':result=this.fail('旧试炼已退役，请在修炼界面使用境界突破');break;",1],["const e=D.ENEMIES[type];if(!e)return this.fail('未知对手');const training=!!e.training,scale=this.difficulty.scale","const sourceEnemy=D.ENEMIES[type];if(!sourceEnemy)return this.fail('未知对手');\n  // Smooth only two high-realm transitions; keep the source bestiary and save model unchanged.\n  const bridge=(this.s.zone===5&&(type==='realm5'||type==='boss5'))?.52:(this.s.zone===6&&(type==='realm6'||type==='boss6'))?.78:1;\n  const e=bridge===1?sourceEnemy:{...sourceEnemy,hp:Math.max(1,Math.round(sourceEnemy.hp*bridge)),atk:Math.max(1,Math.round(sourceEnemy.atk*bridge)),armor:Math.max(0,Math.round(sourceEnemy.armor*bridge))};\n  const training=!!e.training,scale=this.difficulty.scale",1],["'shanye-v978-local-ascension-board-v1'","'shanye-v982-local-ascension-board-v1'",1],["a.ruleset!=='garden-v978'","a.ruleset!=='balance-v982'",1],["V90.78 灵田规则","V90.82 修为与斗法规则",1],["'山野修仙记_V90.78_'","'山野修仙记_V90.82_'",1],["Game.normalize=normalize;Game.fresh=fresh;Game.copy=copy;root.QGame=Game;","/* V90.82: quiet-room cultivation now respects building tier; leaderboards isolate rulesets. */\nconst meditateBefore982=Game.prototype.meditate;\nGame.prototype.meditate=function(...args){\n if(this.workshop&&!this.s.combat&&!this.s.ascended){\n  const quiet=this.roomLevel('quiet'),maxRealm=Math.min(12,Math.max(2,quiet+2));\n  if(this.realmIndex>maxRealm)return this.fail('当前静室最多支持第'+maxRealm+'境吐纳，请升级静室或前往高阶地图修行');\n }\n return meditateBefore982.apply(this,args);\n};\nconst ascendBefore982=Game.prototype.ascend;\nGame.prototype.ascend=function(...args){const done=this.s.ascended,r=ascendBefore982.apply(this,args);if(!done&&this.s.ascended&&this.s.ascensionRecord)this.s.ascensionRecord.ruleset='balance-v982';return r;};\nconst normalizeBefore982=normalize;\nnormalize=function(raw,...args){const state=normalizeBefore982(raw,...args);if(state.ascensionRecord&&raw?.ascensionRecord?.ruleset==='balance-v982')state.ascensionRecord.ruleset='balance-v982';return state;};\nGame.normalize=normalize;Game.fresh=fresh;Game.copy=copy;root.QGame=Game;",1],["V90.81","V90.82",7]]''')
def main():
    raw=BASE.read_bytes()
    norm=raw.replace(b"\r\n",b"\n").replace(b"\n",b"\r\n")
    if hashlib.sha256(norm).hexdigest().upper()!=BASE_SHA: raise RuntimeError("Frozen base SHA mismatch")
    endings="\r\n" if b"\r\n" in raw else "\n"
    text=raw.decode("utf-8").replace("\r\n","\n")
    for old,new,count in [*previous.EDITS,*EDITS]:
        if text.count(old)!=count: raise RuntimeError("Patch count mismatch: "+old[:70])
        text=text.replace(old,new)
    out=text.replace("\n",endings).encode("utf-8")
    (ROOT/"index.html").write_bytes(out)
    (RELEASES/OUT_NAME).write_bytes(out)
    print("V90.82 deterministic release built",len(out),hashlib.sha256(out).hexdigest())
if __name__=="__main__": main()
