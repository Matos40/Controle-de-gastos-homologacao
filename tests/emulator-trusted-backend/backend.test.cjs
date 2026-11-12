'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {initializeApp}=require('firebase-admin/app');
const {getFirestore}=require('firebase-admin/firestore');
const {initializeTestEnvironment}=require('@firebase/rules-unit-testing');
const {verifyFactory,paths}=require('../../js/services/trustedFinanceBackendLab.js');
const rules=fs.readFileSync(path.join(__dirname,'firestore.rules'),'utf8');
let passed=0;
async function test(name,fn){await fn();passed++;console.log('APROVADO:',name);}
const initial={selectedMonth:'2026-11',months:{'2026-11':{
 salary:5000,expenses:[{id:'a',title:'Luz',amount:100},{id:'b',title:'Agua',amount:60}],
 cardExpenses:[],extraIncomes:[]}}};
const op=(key,id,expected,value)=>({key,ym:'2026-11',type:'expenses',id,expected,value});
async function main(){
 const env=await initializeTestEnvironment({projectId:'demo-raytech-cg-trusted',
  firestore:{host:'127.0.0.1',port:8091,rules}});
 const app=initializeApp({projectId:'demo-raytech-cg-trusted'},'trusted-lab');
 const db=getFirestore(app);
 const service=verifyFactory(db,async token=>{
  if(token==='tokenA')return {uid:'usuarioA'};
  if(token==='tokenB')return {uid:'usuarioB'};
  throw Error('Token invalido.');
 });
 try{
  await env.clearFirestore();
  const client=env.authenticatedContext('usuarioA').firestore();
  const other=env.authenticatedContext('usuarioB').firestore();
  const p=paths(db,'usuarioA');
  const first=op('op1','a',{id:'a',title:'Luz',amount:100},{id:'a',title:'Luz',amount:120});
  await test('cliente nao cria head falso',async()=>await assert.rejects(
   client.doc(p.head.path).set({version:2}),e=>e.code==='permission-denied'));
  await test('cliente nao cria recibo falso',async()=>await assert.rejects(
   client.doc(p.receipts.doc('forged').path).set({version:1}),e=>e.code==='permission-denied'));
  await test('cliente nao le dados do backend',async()=>await assert.rejects(
   client.doc(p.head.path).get(),e=>e.code==='permission-denied'));
  await test('token invalido rejeitado',async()=>await assert.rejects(service.initialize('bad',initial),/Token invalido/));
  await test('backend inicializa revisao',async()=>assert.equal((await service.initialize('tokenA',initial)).status,'initialized'));
  await test('inicializacao repetida nao duplica',async()=>assert.equal((await service.initialize('tokenA',initial)).status,'already_initialized'));
  await test('backend audita cadeia inicial',async()=>assert.deepStrictEqual(
   await service.audit('tokenA'),{status:'audited',revisions:1,receipts:0}));
  await test('backend confirma operacao e recibo',async()=>assert.equal((await service.submit('tokenA',first)).status,'committed'));
  await test('recibo e revisao persistidos juntos',async()=>{
   assert.equal((await p.receipts.doc('op1').get()).exists,true);
   assert.equal((await p.revisions.doc('2').get()).exists,true);
  });
  await test('reenvio idempotente',async()=>assert.equal((await service.submit('tokenA',first)).status,'duplicate'));
  await test('mesma chave com conteudo diferente rejeitada',async()=>assert.equal(
   (await service.submit('tokenA',{...first,value:{id:'a',title:'Luz',amount:999}})).status,'key_conflict'));
  await test('conflito no mesmo registro preserva revisao',async()=>{
   const bad=op('bad','a',{id:'a',title:'Luz',amount:100},{id:'a',title:'Luz',amount:140});
   assert.equal((await service.submit('tokenA',bad)).status,'conflict');
   assert.equal((await p.receipts.doc('bad').get()).exists,false);
  });
  await test('alteracao independente aceita',async()=>assert.equal((await service.submit('tokenA',
   op('op2','b',{id:'b',title:'Agua',amount:60},{id:'b',title:'Agua',amount:70}))).status,'committed'));
  await test('auditoria de revisoes e recibos',async()=>assert.deepStrictEqual(
   await service.audit('tokenA'),{status:'audited',revisions:3,receipts:2}));
  await test('usuario B nao le usuario A',async()=>await assert.rejects(
   other.doc(p.head.path).get(),e=>e.code==='permission-denied'));
  await test('usuario B inicializa espaco independente',async()=>assert.equal(
   (await service.initialize('tokenB',initial)).status,'initialized'));
  await test('backend bloqueia token nao autorizado',async()=>await assert.rejects(
   service.submit('tokenInvalido',first),/Token invalido/));
  await test('checksum de revisao adulterado e detectado',async()=>{
   const target=p.revisions.doc('2'),before=(await target.get()).data();
   await target.update({checksum:'0'.repeat(64)});
   await assert.rejects(service.audit('tokenA'),/Cadeia adulterada/);
   await assert.rejects(service.submit('tokenA',op('new','a',{id:'a',title:'Luz',amount:120},{id:'a',title:'Luz',amount:130})),/Cadeia adulterada/);
   await target.set(before);
  });
  await test('elo parent adulterado e detectado',async()=>{
   const target=p.revisions.doc('3'),before=(await target.get()).data();
   await target.update({parent:'0'.repeat(64)});
   await assert.rejects(service.audit('tokenA'),/Cadeia adulterada/);
   await target.set(before);
  });
  await test('recibo adulterado e detectado',async()=>{
   const target=p.receipts.doc('op1'),before=(await target.get()).data();
   await target.update({checksum:'0'.repeat(64)});
   await assert.rejects(service.audit('tokenA'),/Recibo adulterado/);
   await target.set(before);
  });
  await test('auditoria final restaurada',async()=>assert.equal((await service.audit('tokenA')).status,'audited'));
  await test('origem permanece intacta',async()=>assert.equal(initial.months['2026-11'].expenses[0].amount,100));
  console.log('RESULTADO: '+passed+'/22 TESTES APROVADOS');
 }finally{await app.delete();await env.cleanup();}
}
main().catch(e=>{console.error('FALHA:',e);process.exitCode=1;});
