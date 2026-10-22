#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""V90.62 deterministic reconstruction from pinned V90.61, with validated ordered changes.
Rebuilds both index.html and the standalone V90.62 release file byte-for-byte.
Do not edit generated HTML directly without regenerating this manifest.
"""
from pathlib import Path
import hashlib

ROOT=Path(__file__).resolve().parents[1]
RELEASES=ROOT/"releases"
BASE=RELEASES/"山野修仙记_V90.61_存档沿用.html"
OUT_NAME="山野修仙记_V90.62_存档可靠性收口.html"
BASE_SHA="71A90E808BF721834129D27DA61AB4836F514FC3555CABE4610409F5DE017CA7"
TARGET_SHA="6244EEBF80E7BADA7E1D0628318BCE0B46137EBEFF7E714A11C616EBFEA9E657"
# (start line, end line, SHA256 of replaced text, replacement lines)
EDITS=[[7,8,"FFC2C19C3DFC1A1B41B7A4F4B5F31FEA2CF942F8F143405321F7EA2BBF51F260",["<title>山野修仙记 V90.62 · 存档可靠性收口</title>"]],[3355,3356,"6C38D00747D3D772A11BCC41373F5AE060F8BC747F9578E65BEFCAFF967FA14F",[" n.xp=integer(o.xp,0,2147483647); // V90.62: preserve earned overflow across saves and reloads"]],[3718,3720,"BC7BC3E9A06F657C43D052215364A8A4F9CBFAA0432DB5BA06D211B2CC09678C",["  if(this.s.level>=36){this.s.xp=Math.min(2147483647,this.s.xp+gain);this.s.daoXp=0;return;}","  this.s.xp=Math.min(2147483647,this.s.xp+gain);"]],[4432,4433,"AFA373B8310EF3C7A1EA5345E3D2DF76992ADB9546FB3F8F05429643F99006C9",["  if(this.stageIndex===3&&this.s.xp>=this.required)this.s.pendingTribulation=this.s.level;"]],[5594,5594,"E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855",[" /* Idempotent, race+slot-specific compensation with no delete-before-write.","    The credit and receipt live in the SAME ledger JSON value. If creating the","    new character fails, the original saves remain and retry cannot pay twice. */"," resetRebuilt(id,n=1){","  this.check(id);this.slot(n);","  const found=this.read(id,n);","  if(!found||!found.reset)throw Error('只允许确认重置旧版存档');","  const receipt=this.legacy(id,n),priorMarker=this.readKey(this.key(id,n)+'-rebuild-compensated');","  const already=receipt.rebuildCompensation||!!priorMarker;","  const tier=found.reset.tier;","  if(!already){","   receipt.balance+=tier;","   receipt.total+=tier;","   receipt.rebuildCompensation={tier,source:found.reset.source,at:new Date().toISOString()};","   this.putLegacy(id,n,receipt);","  }","  const updated=this.legacy(id,n);","  if(!updated.rebuildCompensation){","   // Honor receipts from V90.58~V90.61 without granting any additional credit.","   if(!priorMarker)throw Error('补偿记录未落盘，旧档保持不变');","   updated.rebuildCompensation={tier:0,source:'legacy-marker',at:new Date().toISOString()};","   this.putLegacy(id,n,updated);","  }","  const g=new Game(null,261014,id),up=updated.upgrades||{};","  g.s.maxHp+=4*(up.vigor||0);g.s.hp+=4*(up.vigor||0);","  g.s.maxSpirit+=4*(up.spirit||0);g.s.spirit+=4*(up.spirit||0);g.s.attack+=up.attack||0;","  const raw=JSON.stringify(g.state()),key=this.key(id,n);","  // Only now replace the current slot. Failed writes leave old main and backup intact.","  this.storage.setItem(key,raw);","  // Cleanup is best-effort: any failure after committing new game is not a rollback.","  try{this.storage.removeItem(this.backupKey(id,n));this.storage.removeItem(this.deathKey(id,n));}catch{}","  return {game:g,paid:already?0:tier,total:updated.rebuildCompensation.tier};"," }"]],[5650,5651,"15E6BF20EED880E6965F625F9E7F162F71AD0ADACB4DCEA57EE1A090DAD5B156",["function header(step,back='',subtitle='人妖异途 · V90.62'){return `<header class=\"entry-header\">${back?`<button class=\"entry-back\" data-a=\"${back}\" aria-label=\"返回\">←</button>`:''}<div class=\"entry-brand\"><strong>山野修仙记</strong><small>${subtitle}</small></div><span class=\"entry-step\">${step} / 03</span></header>`;}"]],[5787,5803,"C180AC48B4592E4C907C3FE6B6E30089194C2B95040FEB919240317D9504ED09",["  const id=m.race,n=m.slot,result=slots.resetRebuilt(id,n);","  game=result.game;activeRole=id;activeSlot=n;saveAvailable=true;","  saveStatus='旧档已重置 · 本次补偿 '+result.paid+' 轮回玉';deathBoot=false;panel=null;modal=null;frontPage=null;","  render();notify('旧档已重置，本次轮回玉 +'+result.paid,'ok');"," }catch(e){notify('重置未完成：'+e.message+'；旧档仍可导出，请检查存储空间','warn');}"]],[7260,7260,"E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855",["function rebuildResetBody(m){"," let claimed=false,blocked=false;"," try{claimed=!!(slots.readKey(slots.key(m.race,m.slot)+'-rebuild-compensated')||slots.legacy(m.race,m.slot).rebuildCompensation);}catch{blocked=true;}"," const notice=blocked?'<p class=\"danger-text\">轮回账本读取异常，暂不能重置。请先导出旧档 JSON 并检查存储状态。</p>':claimed?'<p>本档旧版补偿已领取，重新开始不会重复发放轮回玉；已经使用的补偿也不会补回。</p>':`<p>首次重置将补偿 <strong>${m.tier} 轮回玉</strong>，直接记入本档账本，本世可用于开局加点。</p>`;"," const action=claimed?'从零开始 · 不重复领取轮回玉':`从零开始 · 领 ${m.tier} 轮回玉`;"," return `<div class='kicker'>境界与修为体系重构</div><h2>旧存档无法沿用</h2><p>本次重构改变境界、修为与渡劫，旧档进度无法直接换算。涉及档位：${m.race==='human'?'人族':'妖族'}第 ${String(m.slot).padStart(3,'0')} 档。</p>${notice}<p class='micro'>从零开始会用新档替换本档主存档并清除自动备份；其他档位、另一种族与本机资质榜不受影响。建议先导出旧档 JSON。</p><div class='inline-buttons'><button class='btn primary' data-a='reset-confirm'${blocked?' disabled':''}>${blocked?'暂不可重置':action}</button><button class='btn' data-a='reset-export'>导出旧档 JSON</button><button class='btn' data-a='modal-close'>暂时不玩</button></div>`;","}"]],[7275,7276,"1EE2B800220B4ED9DEE474426569EBD6D912A8B12EF20C78BD265A9961FC78AC",[" else if(modal.kind==='life-rescue')body=`<div class=\"kicker\">${game.character.name} · 寿元耗尽</div><h2>还有一线生机</h2><p>本世已到尽头（第 ${game.day} 日 · ${esc(game.realm)}）。完整看完激励视频可逆命续年：寿元 +15 年，本世进度全部保留，每世只有一次这样的机会。</p><p class=\"micro\">选择「接受轮回」才会结算本世并领取轮回玉；结算后本档主存档与自动备份会被清除。</p><div class=\"inline-buttons\"><button class=\"btn primary\" data-a=\"ad-life-rescue\">看广告续命 · 寿元+15年</button><button class=\"btn\" data-a=\"life-giveup\">接受轮回</button></div>`; else if(modal.kind==='rebuild-reset')body=rebuildResetBody(modal); else if(modal.kind==='permadeath')body=`<div class=\"kicker\">${game.character.name} · 寿元终结</div><h2>本世结算 · 一世修行，皆有所获</h2><div class=\"rebirth-results\">${(()=>{try{const l=slots.legacy(activeRole,activeSlot),r=l.last;return r?`<p>最高境域 ${r.zone}/12 · ${esc(r.realm)} · 第 ${r.day} 日</p><p>最高战力 ${r.bestPower.toLocaleString('zh-CN')} · 通过首领 ${r.cleared}/12</p><h3>本世获得轮回玉 +${r.reward}</h3><p>本档余额 ${l.balance} · 已历 ${l.generation} 世</p>`:'<p>未记录有效结算</p>';}catch{return '<p>结算存储异常，勿重复清理档案</p>';}})()}</div><p>${saveStatus==='存储受限 · 无法保证删档'?'浏览器拒绝删除本地存储，请手动清理该角色数据。':'仅'+game.character.short+'档的主存档与自动备份已清除。其他档位与另一种族进度不受影响。'}</p><div class=\"inline-buttons\"><button class=\"btn primary\" data-a=\"rebirth\">本档重新轮回</button><button class=\"btn\" data-a=\"characters\">选择其他档案</button></div>`;"]]]

def digest(x:bytes)->str:
    return hashlib.sha256(x).hexdigest().upper()

def main():
    original=BASE.read_bytes().replace(b"\r\n",b"\n")
    canonical=original.replace(b"\n",b"\r\n")
    if digest(canonical)!=BASE_SHA:
        raise SystemExit("BASE SHA mismatch: "+digest(canonical))
    lines=original.decode("utf-8").split("\n")
    for start,end,expected,replacement in reversed(EDITS):
        if digest("\n".join(lines[start:end]).encode("utf-8"))!=expected:
            raise SystemExit("Patch hunk mismatch at source line "+str(start+1))
        lines[start:end]=replacement
    result="\n".join(lines).encode("utf-8")
    if digest(result)!=TARGET_SHA:
        raise SystemExit("TARGET SHA mismatch: "+digest(result))
    (RELEASES/OUT_NAME).write_bytes(result)
    (ROOT/"index.html").write_bytes(result)
    print("V90.62 deterministic rebuild PASS | "+str(len(result))+" bytes | SHA256 "+TARGET_SHA)

if __name__=="__main__":
    main()
