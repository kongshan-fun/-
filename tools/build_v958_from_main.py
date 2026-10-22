#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
V90.57 -> V90.58：修复「渡劫成功后无法立即解锁下一境」

根因：unlocked 只在 normalized（载入存档）时按 cleared+major 重算，
      渡劫成功后没有同步重算，所以必须刷新页面才生效。
      人族/妖族 × 境7..11 共 10 组可复现。

修复：抽出 recalcUnlocked()（与载入时同一套规则），渡劫成功、破境后立即调用。
"""
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RELEASES = ROOT / "releases"
BASE = RELEASES / "山野修仙记_V90.57_属性丹.html"
OUT_NAME = "山野修仙记_V90.58_跨境解锁.html"
BASE_SHA = "6A40B2D4101E0A208B704023086C5A6E385F6907DDC53EB0AC229AED49FE6585"

METHOD = ''' /* V90.58 与载入时同一套规则重算「已解锁地图数」，只增不减。
    docs：zone i 的开图条件 = cleared[i] 且 major ≥ i-3（i≥5 起需要境界） */
 recalcUnlocked(){
  let u=1;
  for(let i=0;i<D.ZONES.length;i++){
   if(!this.s.cleared[i])break;
   if(i>=5&&this.s.major<i-3)break;
   u=Math.min(D.ZONES.length,i+2);
  }
  this.s.unlocked=Math.max(this.s.unlocked||1,u);
  return this.s.unlocked;
 }
'''


def sha(b):
    return hashlib.sha256(b).hexdigest().upper()


def ok(l, d=""):
    print(f"  [OK] {l}" + (f"  {d}" if d else ""))


def rep(t, old, new, label, expect=1):
    n = t.count(old)
    if n != expect:
        raise SystemExit(f"[ABORT] {label}: 命中 {n} 次（期望 {expect}）")
    ok(label)
    return t.replace(old, new, expect)


def main():
    raw = BASE.read_bytes()
    norm = raw.replace(b"\r\n", b"\n").replace(b"\n", b"\r\n")
    if sha(norm) != BASE_SHA:
        raise SystemExit(f"[ABORT] 基线哈希不符：{sha(norm)}")
    ok("基线校验", f"{len(raw):,} B")
    text = raw.decode("utf-8").replace("\r\n", "\n")

    text = rep(text, "<title>山野修仙记 V90.57 · 属性丹</title>",
               "<title>山野修仙记 V90.58 · 跨境解锁</title>", "标题版本号")
    text = rep(text, "subtitle='人妖异途 · V90.57'", "subtitle='人妖异途 · V90.58'", "副标题版本号")

    # 1) 插入 recalcUnlocked（放在 syncMajor 之后）
    text = rep(text, " syncMajor(){this.s.major=majorOfLevel(this.s.level);return this.s.major;}",
               " syncMajor(){this.s.major=majorOfLevel(this.s.level);return this.s.major;}\n" + METHOD,
               "插入 recalcUnlocked")


    EXPORT_OLD = (
    "/* V90.58 旧档导出：重置前把原始 JSON 交还给玩家，避免「必须删」 */\n"
    "function exportOldSlot(){const m=modal;if(!m||m.kind!=='rebuild-reset')return;\n"
    " try{\n"
    "  const id=m.race,n=m.slot;\n"
    "  const raw=slots.readKey(slots.key(id,n))||slots.readKey(slots.backupKey(id,n));\n"
    "  if(!raw){notify('该档已无原始数据可导出','warn');return;}\n"
    "  const envelope={format:'QinglanWendaoLegacy',schemaVersion:1,reason:'pre-rebuild-backup',character:id,slot:n,exportedAt:new Date().toISOString(),raw:JSON.parse(raw)};\n"
    "  const blob=new Blob([JSON.stringify(envelope,null,2)],{type:'application/json'});\n"
    "  const u=URL.createObjectURL(blob),a=document.createElement('a');\n"
    "  a.href=u;a.download='山野修仙记_旧档备份_'+id+'_'+String(n).padStart(3,'0')+'.json';a.click();\n"
    "  setTimeout(()=>URL.revokeObjectURL(u),3000);\n"
    "  notify('旧档 JSON 已导出，可留存备查','ok');\n"
    " }catch(e){notify('旧档导出失败：'+e.message,'warn');}\n"
    "}\n"
    )

    OLD_MODAL = '<div class="inline-buttons"><button class="btn primary" data-a="reset-confirm">从零开始 · 领 ${modal.tier} 轮回玉</button><button class="btn" data-a="modal-close">暂时不玩</button></div>'
    NEW_MODAL = '<div class="inline-buttons"><button class="btn primary" data-a="reset-confirm">从零开始 · 领 ${modal.tier} 轮回玉</button><button class="btn" data-a="reset-export">导出旧档 JSON</button><button class="btn" data-a="modal-close">暂时不玩</button></div>'

    GUARD_OLD = "  const before=slots.legacy(id,n);before.balance=(before.balance||0)+m.tier;slots.putLegacy(id,n,before);"
    GUARD_NEW = ("  const doneKey=slots.key(id,n)+'-rebuild-compensated';\n"
             "  const already=!!slots.readKey(doneKey);\n"
             "  if(!already){const before=slots.legacy(id,n);before.balance=(before.balance||0)+m.tier;slots.putLegacy(id,n,before);}\n"
             "  try{slots.storage.setItem(doneKey,'1');}catch(e){}\n"
             "  m.compensated=!already;\n"
             "  if(already)saveStatus='旧档已重置 · 本档补偿此前已发放';\n")

    # 2) 渡劫成功后立即重算
    text = rep(text, "  this.s.level++;this.syncMajor();this.s.xp=0;this.s.pendingTribulation=0;",
               "  this.s.level++;this.syncMajor();this.recalcUnlocked();this.s.xp=0;this.s.pendingTribulation=0;",
               "渡劫成功即刷新解锁")

    # 2b) 旧档导出按钮 + 一次性补偿保护
    text = rep(text, OLD_MODAL, NEW_MODAL, "重构弹窗增加导出按钮")
    text = rep(text, " if(a==='reset-confirm'&&modal?.kind==='rebuild-reset'){resetOldSlot();return;}",
               " if(a==='reset-export'&&modal?.kind==='rebuild-reset'){exportOldSlot();return;}\n"
               " if(a==='reset-confirm'&&modal?.kind==='rebuild-reset'){resetOldSlot();return;}",
               "reset-export 动作")
    text = rep(text, "function resetOldSlot(){", EXPORT_OLD + "function resetOldSlot(){", "插入 exportOldSlot")
    text = rep(text, GUARD_OLD, GUARD_NEW, "一次性补偿保护")

    for needle in ("recalcUnlocked(){", "this.syncMajor();this.recalcUnlocked();",
                   "function exportOldSlot(){", 'data-a="reset-export"', "rebuild-compensated"):
        if needle not in text:
            raise SystemExit(f"[ABORT] 产物缺少 {needle}")
    ok("产物标记", "解锁修复 + 旧档导出 + 补偿保护 齐全")

    out = text.replace("\n", "\r\n").encode("utf-8")
    (RELEASES / OUT_NAME).write_bytes(out)
    (ROOT / "index.html").write_bytes(out)
    ok("产物一致性", "index.html == release")
    print(f"\n  releases/{OUT_NAME}\n  字节数 : {len(out):,}\n  SHA256 : {sha(out)}")


if __name__ == "__main__":
    main()
