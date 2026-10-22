#!/usr/bin/env python3
"""Reproducible V90.58 self-contained verification; legacy 37-layer fixtures are excluded explicitly."""
from pathlib import Path
import argparse,hashlib,subprocess,json,sys,time
root=Path(__file__).resolve().parents[1]
log=root/'evidence'/'verification'
log.mkdir(parents=True,exist_ok=True)
legacy=root/'releases'/'山野修仙记_V90.56_渡劫改制.html'
release=root/'releases'/'山野修仙记_V90.58_跨境与旧档补偿闭环版.html'
main=root/'index.html'
assert hashlib.sha256(legacy.read_bytes()).hexdigest().upper()=='A17BDDF3C3E05FBAF279733628FA2C7B88AF290DAD8745472E4F0057E2952C49'
assert main.read_bytes()==release.read_bytes()
assert b'V90.58' in main.read_bytes()
checks=[
 ('Javascript语法、自包含', ['node','tests/syntax_check.cjs']),
 ('原飞升结算与百档生命周期（新境界真实属性夹具）',['node','tests/v907-ascension-lifecycle.test.cjs']),
 ('V90.23 装备掉落', ['node','tests/v923_gear_drop.cjs']),
 ('V90.27 装备经济', ['node','tests/v927_gear_economy.cjs']),
 ('十二境映射表',['node','tests/v943b_realm_table.cjs']),
 ('境界显示',['node','tests/v945_realm_display.cjs']),
 ('渡劫固定伤害',['node','tests/v946_trib_damage.cjs']),
 ('护劫丹消耗及新 UI 契约',['node','tests/v947_guard_pill.cjs']),
 ('高境属性成长',['node','tests/v948_realm_stats.cjs']),
 ('怪物属性',['node','tests/v949_monsters.cjs']),
 ('前六境属性',['node','tests/v950_early_stats.cjs']),
 ('越级压制',['node','tests/v951_zone_gap.cjs']),
 ('锻造熟练度',['node','tests/v952_forge_prof.cjs']),
 ('精炼经济',['node','tests/v953_refine_rating.cjs']),
 ('赋灵词条与熟练',['node','tests/v954_spirit_affix.cjs']),
 ('36段修为轴',['node','tests/v955_realm_axis.cjs']),
 ('V90.58 真实渡劫与最终飞升全境界',['node','tests/v958_tribulation_regression.cjs']),
]
checks.extend([
 ('V90.58 跨境及一次性旧档补偿',['node','tests/v958_p0_closure.cjs']),
 ('V90.58 双族十二境真实动作加速链',['node','tests/v958_dual_race_12zones.cjs']),
])
parser=argparse.ArgumentParser();parser.add_argument('--skip-browser',action='store_true');args=parser.parse_args()
if not args.skip_browser:checks.extend([
 ('Chromium 4视口',['python','tests/v958_browser_smoke.py']),
 ('Chromium 旧档导出／取消／补偿',['python','tests/v958_legacy_ui_browser.py'])
])
results=[]
for name,command in checks:
 start=time.time()
 try:
  p=subprocess.run(command,cwd=root,capture_output=True,text=True,timeout=60)
  rc=p.returncode
  out=(p.stdout or '')+'\n'+(p.stderr or '')
 except subprocess.TimeoutExpired:
  rc=124;out='TEST TIMEOUT 60s'
 result={'test':name,'command':command,'status':'PASS' if rc==0 else 'FAIL','exit_code':rc,'seconds':round(time.time()-start,3),'last_output':out.strip()[-1700:]}
 results.append(result)
 print(result['status'],name,'(',result['seconds'],'sec )',flush=True)
(log/'results.json').write_text(json.dumps({'passed':sum(x['status']=='PASS' for x in results),'total':len(results),'tests':results},ensure_ascii=False,indent=2),encoding='utf8')
(log/'summary.txt').write_text('\n'.join(f"{x['status']} {x['test']}: {x['last_output'].splitlines()[-1] if x['last_output'] else ''}" for x in results),encoding='utf8')
passed=sum(x['status']=='PASS' for x in results)
print(f'V90.58 OFFLINE VERIFICATION {passed}/{len(results)} PASS')
raise SystemExit(0 if passed==len(results) else 1)
