'use strict';
const Slots=require('../src/slots.js');
class QuotaStore{
 constructor(){this.map=new Map();this.limit=Infinity}
 used(){return [...this.map].reduce((n,[k,v])=>n+2*(k.length+v.length),0)}
 getItem(k){return this.map.get(k)||null}
 setItem(k,v){v=String(v);const old=this.map.get(k);if(this.used()+2*(k.length+v.length)-(old?2*(k.length+old.length):0)>this.limit)throw Error('QuotaExceededError');this.map.set(k,v)}
 removeItem(k){this.map.delete(k)}
}
const db=new QuotaStore(),s=new Slots(db);
s.newGame('human',1,1);
db.limit=db.used()+16;
let err='';try{s.expire('human',1)}catch(e){err=e.message}
console.log(JSON.stringify({simulated_write_error:err,slot_status_after_expire:s.status('human',1).status,primary_still_exists:!!db.getItem(s.key('human',1)),death_marker_present:!!db.getItem(s.deathKey('human',1))},null,2));
console.log('NOTE: deterministic synthetic quota adapter, NOT real Chrome storage quota certification.');