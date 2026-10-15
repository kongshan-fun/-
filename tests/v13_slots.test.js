'use strict';
const A=require('node:assert/strict'),D=require('../src/data.js'),Slots=require('../src/slots.js');
class Memory{constructor(){this.m=new Map()}getItem(k){return this.m.get(k)||null}setItem(k,v){this.m.set(k,String(v))}removeItem(k){this.m.delete(k)}}
const s=new Slots(new Memory());
A.equal(s.listSlots('sword').length,100);A.equal(s.listSlots('herb').length,100);
A.throws(()=>s.slot(101),/1至100/);A.throws(()=>s.slot(0),/1至100/);
const a=s.newGame('sword',1,1),b=s.newGame('sword',2,2),c=s.newGame('herb',3,1);
a.s.inv.wood=51;b.s.inv.wood=9;c.s.inv.wood=3;
s.save('sword',a,1);s.save('sword',b,2);s.save('herb',c,1);
A.equal(s.read('sword',1).game.s.inv.wood,51);A.equal(s.read('sword',2).game.s.inv.wood,9);A.equal(s.read('herb',1).game.s.inv.wood,3);
A.throws(()=>s.newGame('sword',4,1),/禁止覆盖/);
s.expire('sword',2);A.equal(s.status('sword',2).status,'dead');A.equal(s.status('sword',1).status,'ready');A.equal(s.status('herb',1).status,'ready');
A.equal(s.newGame('sword',5,2).s.character,'sword');
A.equal(s.key('sword',1),D.SLOT_PREFIX+'sword');
console.log('V13 100-save-slot isolation PASS');
