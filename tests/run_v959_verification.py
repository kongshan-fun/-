#!/usr/bin/env python3
"""V90.59 reproducible check: frozen V90.58 baseline, 200 accelerated slots, browser."""
from pathlib import Path
import argparse,hashlib,subprocess,json,sys,time
R=Path(__file__).resolve().parents[1]
E=R/'evidence'/'v959'/'verification';E.mkdir(parents=True,exist_ok=True)
base=R/'releases/山野修仙记_V90.58_跨境与旧档补偿闭环版.html'
released=R/'releases/山野修仙记_V90.59_存档晋升与修为继承版.html'
assert base.is_file() and released.is_file() and (R/'index.html').read_bytes()==released.read_bytes(), 'index and release mismatch'
assert hashlib.sha256(base.read_bytes()).hexdigest().upper()=='BD61E4275769CBFFE10E007DB9AD21C6425CB1E4B584F700F797E92ED99A89B3','baseline drift'
source=(R/'index.html').read_text('utf8')
assert 'V90.59 · 存档晋升与修为继承' in source
assert 'const zoneRealm=Math.min(12,Math.max(1,Number(this.s.zone)+2));' in source, 'zone-gap policy was touched'
modules=[
 'syntax_check.cjs','v907-ascension-lifecycle.test.cjs','v923_gear_drop.cjs','v927_gear_economy.cjs',
 'v943b_realm_table.cjs','v945_realm_display.cjs','v946_trib_damage.cjs','v947_guard_pill.cjs',
 'v948_realm_stats.cjs','v949_monsters.cjs','v950_early_stats.cjs','v951_zone_gap.cjs',
 'v952_forge_prof.cjs','v953_refine_rating.cjs','v954_spirit_affix.cjs','v955_realm_axis.cjs',
 'v958_tribulation_regression.cjs','v958_p0_closure.cjs','v958_dual_race_12zones.cjs',
 'v959_rules_regression.cjs','v959_200slots_integration.cjs']
checks=[(x,['node','tests/'+x]) for x in modules]
p=argparse.ArgumentParser();p.add_argument('--skip-browser',action='store_true');p.add_argument('--skip-batch',action='store_true');opt=p.parse_args()
if opt.skip_batch:checks=[x for x in checks if x[0]!='v959_200slots_integration.cjs']
if not opt.skip_browser:checks.append(('v959_browser_actions.py',['python','tests/v959_browser_actions.py']))
results=[]
for name,command in checks:
 t=time.time()
 try:
  log_file=E/(name.replace('/','_')+'.log')
  with log_file.open('w',encoding='utf8') as handle:
   r=subprocess.run(command,cwd=R,stdout=handle,stderr=subprocess.STDOUT,text=True,timeout=150)
  code=r.returncode;out=log_file.read_text('utf8').strip()
 except subprocess.TimeoutExpired as err:
  code=124;out='TIMEOUT 150 seconds'
 v={'name':name,'status':'PASS' if code==0 else 'FAIL','exit':code,'seconds':round(time.time()-t,3),'summary':out[-600:]}
 results.append(v);print(v['status'],name,'(',v['seconds'],'s )',flush=True)
record={'version':'V90.59','total':len(results),'passed':sum(x['status']=='PASS' for x in results),'tests':results,
        'note':'Accelerated 200 slots: resource/XP/combat boosts. NOT natural-play ascension probability.'}
(E/'results.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf8')
(E/'summary.txt').write_text('\n'.join(f"{x['status']}: {x['name']}: {x['summary'].splitlines()[-1]}" for x in results),encoding='utf8')
print('V90.59 VERIFICATION',record['passed'],'/',record['total'],'PASS')
raise SystemExit(0 if record['passed']==record['total'] else 1)
