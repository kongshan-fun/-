'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,'artifacts/v979/regression');fs.mkdirSync(OUT,{recursive:true});
// Superseded assertions have separate files; historical tests remain preserved.
const tests=[
 'syntax_check.cjs','v907-ascension-lifecycle.test.cjs','v907-interrupted-settlement.test.cjs','v978_storage_bags.cjs',
 'v923_gear_drop.cjs','v927_gear_economy.cjs','v955_realm_axis.cjs','v952_forge_prof.cjs','v953_refine_rating.cjs','v954_spirit_affix.cjs','v957_attr_pills.cjs',
 'v958_dual_growth_chain.cjs','v958_cross_realm_unlock.cjs','v959_combat_save.cjs','v960_breakthrough_split.cjs',
 'v978_prior_p0.cjs','v962_p0_save_integrity.cjs','v962_200slots_faults.cjs','v978_prior_features.cjs','v975_100slots.cjs',
 'v978_rescue_and_guides.cjs','v977_bigu.cjs','v978_ruleset.cjs','v978_stations.cjs','v978_garden.cjs','v978_upgrade_safety.cjs','v979_presentation_isolation.cjs'
];
const results=[];
for(const name of tests){const start=Date.now(),r=spawnSync(process.execPath,[path.join(ROOT,'tests',name)],{cwd:ROOT,encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024});const text=(r.stdout||'')+'\n'+(r.stderr||'');fs.writeFileSync(path.join(OUT,name+'.log'),text);const row={test:name,status:r.status===0&&!r.error?'PASS':'FAIL',exit:r.status,seconds:(Date.now()-start)/1000};results.push(row);console.log(row.status,name,row.seconds+'s');if(row.status==='FAIL')console.log(text.slice(-3000));}
const pass=results.every(x=>x.status==='PASS'),report={version:'V90.79',source:'index.html',sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,'index.html'))).digest('hex').toUpperCase(),pass,passed:results.filter(x=>x.status==='PASS').length,total:results.length,suites:results};
fs.writeFileSync(path.join(ROOT,'artifacts/v979/acceptance.json'),JSON.stringify(report,null,2));console.log('V90.79 CURRENT ACCEPTANCE',pass?'PASS':'FAIL',report.passed+'/'+report.total);process.exitCode=pass?0:1;
