'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const r=path.resolve(__dirname,'..'),before=fs.readFileSync(path.join(r,'releases/山野修仙记_V90.79_纸墨精修.html'),'utf8'),after=fs.readFileSync(path.join(r,'index.html'),'utf8');
const blocks=s=>[...s.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]);const a=blocks(before),b=blocks(after);let n=0;
assert.equal(a.length,b.length);n++;
for(let i=0;i<6;i++){assert.equal(a[i],b[i].replaceAll("D.RELEASE='V90.80';","D.RELEASE='V90.79';"),'engine script '+i+' unchanged');n++;}
for(let i=8;i<10;i++){assert.equal(a[i],b[i],'theme and effects unchanged '+i);n++;}
const load=bs=>{const c=vm.createContext({console});c.globalThis=c;c.window=c;for(let i=0;i<6;i++)vm.runInContext(bs[i],c);return c;};const c1=load(a),c2=load(b);
for(const race of ['human','demon'])for(const difficulty of ['easy','standard','challenge'])for(const seed of [1,42,123456,665533]){
 const x=new c1.QGame(null,seed,race,null,difficulty),y=new c2.QGame(null,seed,race,null,difficulty);
 assert.equal(JSON.stringify(x.state()),JSON.stringify(y.state()),'same initial state '+race+difficulty+seed);n++;
 for(const [action,args]of [['move',{x:2,y:5}],['gather',{index:0}],['rest',{mode:'short'}],['home-enter',{}]]){
  const p=x.act(action,args),q=y.act(action,args);assert.equal(JSON.stringify(p),JSON.stringify(q));assert.equal(JSON.stringify(x.state()),JSON.stringify(y.state()));n+=2;
 }
}
console.log('PRESENTATION ISOLATION PASS',n,'assertions');
