#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""V90.83 TapTap candidate: exact source SHA, vendored SDK, fixed anchors, byte parity.
No TapTap upload, account operation or production deployment is performed here.
"""
from __future__ import annotations
import hashlib,json,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/"releases"/"山野修仙记_V90.82_P0P1稳定性修复.html"
ADAPTER=ROOT/"platform"/"taptap-adapter-v983.js"
OUT_NAME="山野修仙记_V90.83_TapTap候选版.html"
OUT=ROOT/"releases"/OUT_NAME
BASE_BLOB="49b2df4cda7e6e8166ff0c1b683dd246f07a8b61"
ADAPTER_BLOB="9f2ef6ab94744d009fd7b24dc0d46c7d59f0a17e"
BUILD_CODE="SHANYE-V983-TT-20261103"
PATCHES=json.loads(r'''[["<title>山野修仙记 V90.82 · 方正纸墨</title>","<title>山野修仙记 V90.83 · 方正纸墨</title>",1],["D.RELEASE='V90.82'","D.RELEASE='V90.83'",2],["content=\"山野修仙记，十二境文字修仙生存游戏。离线单机，完整入门引导。\"","content=\"山野修仙记，十二境文字修仙生存游戏。TapTap版支持激励视频、云存档与官方排行榜。\"",1],["function render(){\n if(game.s.combat)","function render(){\n try{window.__QTAP_STATE={role:activeRole,slot:activeSlot,game:game,power:QCombatRating.live(game).total||0};window.__QTAP_NOTIFY=notify;window.QTap?.rankDifficulty?.sync()}catch(__qtapRender){}\n if(game.s.combat)",1],["store.save(activeRole,game,activeSlot);saveAvailable=true;saveStatus='自动保存成功';return true;","store.save(activeRole,game,activeSlot);saveAvailable=true;saveStatus='自动保存成功';try{window.__QTAP_STATE={role:activeRole,slot:activeSlot,game:game,power:QCombatRating.live(game).total||0};window.__QTAP_SAVE_TICK=(window.__QTAP_SAVE_TICK||0)+1;window.QTap?.rankDifficulty?.sync()}catch(__qtapSave){}return true;",1],["this.s.stats.bossWins++;","this.s.stats.bossWins++;try{globalThis.QTap?.achievements?.unlockBoss?.(this.s.stats.bossWins)}catch(__qtapBoss){}",1],["if(effects.some(e=>e.kind==='victory'))showModal({kind:'victory'});","if(stored&&effects.some(e=>e.kind==='victory')&&game.s.ascensionRecord){try{const p=window.QTap?.leaderboard?.submitAscension?.(game.s.ascensionRecord);p?.catch?.(function(){})}catch(__qtapRank){}}\n if(effects.some(e=>e.kind==='victory'))showModal({kind:'victory'});",1],["if(step===6)return recipeGuide('woodSword');","if(step===6){if(panel==='camp')return {selector:'[data-a=\"facility-open\"][data-name=\"facility-forge\"]',tip:'进入洞府炼器室，制作桃木灵剑。'};return recipeGuide('woodSword');}",1],["材料已备齐！返回洞府建造，或前往炼制完成制作。","材料已备齐，回洞府进入对应建筑制作。",1],["this.note('入门完成 · 回春散2、辟谷丸1','ok','guide-complete');","this.note('基础入门完成 · 回春散2、辟谷丸1。接下来从青岚山麓开始主线：修复山门封印、击败本境首领，再回洞府突破。','ok','guide-complete');",1],["免费次数用完，可模拟观看广告领取3次","免费次数已用完，可观看激励视频增加3次抽取机会",1],["任何天赋都可以飞升；试玩领取不需要观看广告。","任何天赋都可以飞升；TapTap 额外抽取次数需观看激励视频（广告不可用时按离线兜底规则发放）。",1],["当前不含仙界内容、宗门弟子、多人联机、广告或付费抽卡。","当前不含仙界地图、宗门弟子、多人联机或付费抽卡；TapTap 容器内已接入激励广告与存档服务。",1],["本版没有离线收益、抽卡、广告、付费建筑、联网排行榜或宗门弟子管理。","本版没有离线收益、付费建筑或宗门弟子管理；TapTap 容器内支持激励视频、云存档和平台排行榜。",1],["飞升榜仅在本机保存、可导出 JSON，不是已接入云端的公开排行榜。","本机飞升榜按规则版本独立保存，可导出 JSON；TapTap 平台榜需要账号和 SDK 验证，旧赛季成绩不会混入新版本机榜。",1],["每次行动原有的饱腹、饮水消耗保持不变。","饱腹与饮水自然消耗随境界提高而降低；第七境后可自主启用灵息辟谷，以真元／妖元抵扣部分普通消耗。",2],["不承诺200份满进度都装得下","每种难度与种族各100档，共600个逻辑档位；设备配额有限，请定期导出JSON备份",2],[" if(s.hunger<30){\n  if(s.inv.berry)return {selector:'#food-button',tip:'先吃灵果，避免饥饿。'};\n  if(game.atCamp)return {selector:'#rest-button',tip:'先在洞府休息，利用每日简餐补给。'};\n  const food=['pill','meal','fish'].find(id=>s.inv[id]>0);\n  if(food)return {selector:panel==='pack'?`[data-a=\"consume\"][data-id=\"${food}\"]`:'#pack-button',tip:'行囊中有食物，先使用再继续。'};\n  return resourceGuide('berry');\n }"," if(s.hunger<30){\n  const food=['berry','pill','meal','fish'].find(id=>s.inv[id]>0);\n  if(food)return {selector:food==='berry'?'#food-button':panel==='pack'?'[data-a=\"consume\"][data-id=\"'+food+'\"]':'#pack-button',tip:'先用行囊里的食物补充饱腹，休息不能代替进食。'};\n  return resourceGuide('berry');\n }",1]]''')
def git_blob(b:bytes)->str:
    return hashlib.sha1(b"blob "+str(len(b)).encode()+b"\0"+b).hexdigest()
def source(path:Path,expected:str)->str:
    raw=path.read_bytes().replace(b"\r\n",b"\n")
    actual=git_blob(raw)
    if actual!=expected:
        raise RuntimeError(f"{path.name} source drift expected {expected}, got {actual}")
    return raw.decode("utf-8")
def apply(s:str,old:str,new:str,count:int)->str:
    found=s.count(old)
    if found!=count: raise RuntimeError(f"V90.83 unanchored patch: expected {count} got {found} for {old[:60]!r}")
    return s.replace(old,new)
def build()->bytes:
    s=source(BASE,BASE_BLOB)
    a=source(ADAPTER,ADAPTER_BLOB)
    insert='<script>window.__SHANYE_BUILD_CODE="'+BUILD_CODE+'";</script>\n<script>'+a+'</script>\n'
    s=apply(s,"<head>\n","<head>\n"+insert,1)
    for old,new,count in PATCHES:s=apply(s,old,new,count)
    if s.count("<script")!=12 or s.count("</script>")!=12:
        raise RuntimeError("Expected exactly twelve inline scripts")
    return s.encode("utf-8")
def main()->None:
    data=build()
    output_sha=hashlib.sha256(data).hexdigest().upper()
    if "--check" in sys.argv:
        if OUT.read_bytes()!=data:raise RuntimeError("Candidate differs from deterministic rebuild")
        print("V90.83 candidate byte parity PASS",len(data),output_sha)
    else:
        OUT.parent.mkdir(exist_ok=True,parents=True)
        OUT.write_bytes(data)
        print("V90.83 candidate created",len(data),output_sha)
if __name__=="__main__":main()
