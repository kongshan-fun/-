from pathlib import Path

root=Path('.')
p=root/'tools/build_v977_from_main.py'
s=p.read_text()
anchor='    # Isolate local speedrun scores: changed nutrition makes older records unfair'
insert='''    # Use the post-breakthrough HP ceiling for the successful-result preview.
    # The damage threshold still uses current HP; only the forecast is corrected.
    patch('const dmg=game.tribDamage,maxHp=s.maxHp,left=Math.max(0,maxHp-dmg),pct=Math.round(left/maxHp*100);',
          'const dmg=game.tribDamage,maxHp=s.maxHp,nextMaxHp=D.applyPills(D.statsForLevel(s.level+1),s).hp,left=Math.max(1,nextMaxHp-dmg),pct=Math.round(left/nextMaxHp*100);')
    patch('渡劫后剩余 ${pct}%', '成功后约 ${pct}% 气血')

'''
if insert not in s:
    assert s.count(anchor)==1
    p.write_text(s.replace(anchor,insert+anchor),encoding='utf-8')

p=root/'tests/v977_browser.py';s=p.read_text()
a="  p.locator('[data-a=\"breakthrough\"]').click();ck(state(p)['level']==19,'actual breakthrough reaches seventh realm')"
b="""  predicted=p.locator('.trib-hero-top').inner_text()
  p.locator('[data-a="breakthrough"]').click();ck(state(p)['level']==19,'actual breakthrough reaches seventh realm')
  actual=state(p);actual_pct=int(actual['hp']/actual['maxHp']*100+0.5)
  ck('成功后约 '+str(actual_pct)+'% 气血' in predicted,'breakthrough HP forecast matches new realm result',dict(predicted=predicted,hp=actual['hp'],maxHp=actual['maxHp']))"""
if b not in s:
    assert s.count(a)==1
    p.write_text(s.replace(a,b),encoding='utf-8')

p=root/'docs/v977/功能与上线边界.md'
s=p.read_text()
note='\n## 截图续接复核\n- 复核突破前后截图时发现旧渡劫页按旧气血上限计算成功后剩余百分比，与突破后的新气血上限不一致。已改为使用下一境的属性表及现有属性丹加成预估，且保留当前气血的伤害门槛检查。\n- 浏览器专项新增一次真实突破前后的预估百分比对照；这项仅更正展示，不调整渡劫伤害或属性数值。\n'
if '## 截图续接复核' not in s:p.write_text(s+note,encoding='utf-8')
print('Applied reviewed screenshot-to-outcome alignment patch')
