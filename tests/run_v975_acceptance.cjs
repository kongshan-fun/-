'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,'artifacts/v975/current-regression');fs.mkdirSync(OUT,{recursive:true});
const tests=[
 'syntax_check.cjs','v907-ascension-lifecycle.test.cjs','v907-interrupted-settlement.test.cjs','v975_storage_bags.cjs',
 'v923_gear_drop.cjs','v927_gear_economy.cjs','v955_realm_axis.cjs','v952_forge_prof.cjs','v953_refine_rating.cjs','v954_spirit_affix.cjs','v957_attr_pills.cjs',
 'v958_dual_growth_chain.cjs','v958_cross_realm_unlock.cjs','v959_combat_save.cjs','v960_breakthrough_split.cjs',
 'v974_p0_faults.cjs','v962_p0_save_integrity.cjs','v962_200slots_faults.cjs','v975_features.cjs','v975_100slots.cjs'
];
const results=[];for(const name of tests){const start=Date.now(),r=spawnSync(process.execPath,[path.join(ROOT,'tests',name)],{cwd:ROOT,encoding:'utf8',timeout:180000});const text=(r.stdout||'')+'\n'+(r.stderr||'');fs.writeFileSync(path.join(OUT,name+'.log'),text);const row={test:name,status:r.status===0&&!r.error?'PASS':'FAIL',exit:r.status,seconds:(Date.now()-start)/1000};results.push(row);console.log(row.status,name,row.seconds+'s');if(row.status==='FAIL')console.log(text.slice(-2500));}
const ok=results.every(x=>x.status==='PASS');fs.writeFileSync(path.join(ROOT,'artifacts/v975/current-regression.json'),JSON.stringify({version:'V90.75',source:'index.html',pass:ok,suites:results},null,2));console.log('V90.75 CURRENT ACCEPTANCE',ok?'PASS':'FAIL',results.filter(x=>x.status==='PASS').length+'/'+tests.length);process.exitCode=ok?0:1;
