'use strict';
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const tests=[
 'v907-ascension-lifecycle.test.cjs',
 'v907-storage-regression.test.cjs',
 'v907-quest-regression.test.cjs',
 'v907-100-slots-regression.test.cjs',
 'v907-interrupted-settlement.test.cjs',
 'v908-building-progression.test.cjs'
];
for(const test of tests){
 console.log('\n=== '+test+' ===');
 const r=spawnSync(process.execPath,[path.join(__dirname,test)],{stdio:'inherit'});
 if(r.error){console.error(r.error);process.exit(1);}
 if(r.status!==0){console.error('FAILED: '+test);process.exit(r.status||1);}
}
console.log('\nV90.8 FULL REGRESSION PASS ('+tests.length+' suites)');
