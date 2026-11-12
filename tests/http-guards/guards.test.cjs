'use strict';
const assert=require('node:assert/strict');
const {createHttpGuards}=require('../../js/services/httpGuardsLab.js');
const {createHttpLab,assertLab}=require('../../js/services/httpFinanceLab.js');
let passed=0;
function test(name,fn){fn();passed++;console.log('APROVADO:',name);}
let time=1000;
const guards=createHttpGuards({maxConcurrent:2,maxPerWindow:3,windowMs:100,now:()=>time});
test('primeira requisicao admitida',()=>{const a=guards.acquire('a');assert(a.ok);a.release();});
test('segunda requisicao admitida',()=>{const a=guards.acquire('a');assert(a.ok);a.release();});
test('terceira requisicao admitida',()=>{const a=guards.acquire('a');assert(a.ok);a.release();});
test('quarta requisicao bloqueada 429',()=>assert.equal(guards.acquire('a').status,429));
test('erro rate_limited padronizado',()=>assert.equal(guards.acquire('a').error,'rate_limited'));
test('usuario B tem cota independente',()=>{const b=guards.acquire('b');assert(b.ok);b.release();});
test('janela ainda vigente',()=>{time+=99;assert.equal(guards.acquire('a').status,429);});
test('janela expira',()=>{time++;const a=guards.acquire('a');assert(a.ok);a.release();});
test('buckets expirados descartados',()=>assert.equal(guards.stats().buckets,1));
const limited=createHttpGuards({maxConcurrent:2,maxPerWindow:10});
const a=limited.acquire('a'),b=limited.acquire('b');
test('duas concorrencias admitidas',()=>assert(a.ok&&b.ok));
test('terceira concorrencia bloqueada 503',()=>assert.equal(limited.acquire('c').status,503));
test('erro server_busy padronizado',()=>assert.equal(limited.acquire('c').error,'server_busy'));
test('limite concorrente nao consome cota',()=>{a.release();const c=limited.acquire('c');assert(c.ok);c.release();});
test('release idempotente',()=>{a.release();assert.equal(limited.stats().active,1);});
test('release final zera ativos',()=>{b.release();assert.equal(limited.stats().active,0);});
test('identidade vazia bloqueada',()=>assert.throws(()=>limited.acquire('')));
test('maxConcurrent invalido bloqueado',()=>assert.throws(()=>createHttpGuards({maxConcurrent:0})));
test('maxPerWindow invalido bloqueado',()=>assert.throws(()=>createHttpGuards({maxPerWindow:0})));
test('windowMs invalido bloqueado',()=>assert.throws(()=>createHttpGuards({windowMs:0})));
test('sem emuladores HTTP nao inicializa',()=>{
 const oldF=process.env.FIRESTORE_EMULATOR_HOST,oldA=process.env.FIREBASE_AUTH_EMULATOR_HOST;
 try{delete process.env.FIRESTORE_EMULATOR_HOST;delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
  assert.throws(()=>assertLab());}
 finally{
  if(oldF===undefined)delete process.env.FIRESTORE_EMULATOR_HOST;
  else process.env.FIRESTORE_EMULATOR_HOST=oldF;
  if(oldA===undefined)delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
  else process.env.FIREBASE_AUTH_EMULATOR_HOST=oldA;
 }
});
console.log('RESULTADO: '+passed+'/20 TESTES APROVADOS');
