'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {initializeTestEnvironment}=require('@firebase/rules-unit-testing');
const rev=require('../../js/services/financialRevisionLab.js');
const queue=require('../../js/services/offlineRevisionQueueLab.js');
const durable=require('../../js/services/durableOfflineLab.js');
const rules=fs.readFileSync(path.join(__dirname,'firestore.rules'),'utf8');
let passed=0;
async function check(name,fn){await fn();passed++;console.log('APROVADO:',name);}
const prefs={selectedMonth:'2026-11'};
const initial={selectedMonth:'2026-11',months:{'2026-11':{
 salary:5000,expenses:[{id:'a',title:'Luz',amount:100},{id:'b',title:'Agua',amount:60}],
 cardExpenses:[{id:'p1',title:'Parcela',amount:200,installments:4,currentInstallment:2}],
 extraIncomes:[]}}};
const op=(key,type,id,expected,value)=>({key,ym:'2026-11',type,id,expected,value});
async function main(){
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'raytech-durable-lab-'));
 const file=path.join(folder,'checkpoint.json');
 const env=await initializeTestEnvironment({projectId:'demo-raytech-cg-durable',
 firestore:{host:'127.0.0.1',port:8089,rules}});
 try{
  await env.clearFirestore();
  const db=env.authenticatedContext('usuarioA').firestore();
  const other=env.authenticatedContext('usuarioB').firestore();
  await check('primeira revisao ficticia',async()=>assert.equal((await rev.publish(db,'usuarioA',initial,{number:0,checksum:null})).status,'published'));
  const base=await rev.current(db,'usuarioA',prefs);
  await check('checkpoint inicial salvo',async()=>assert.equal(typeof durable.save(file,queue.create(base.snapshot,base)),'string'));
  await check('recuperacao de checkpoint',async()=>assert.equal(durable.read(file).pending.length,0));
  await check('inclusao offline persistida',async()=>{
   durable.enqueue(file,op('op1','expenses','a',{id:'a',title:'Luz',amount:100},{id:'a',title:'Luz',amount:120}));
   assert.equal(durable.read(file).pending.length,1);
  });
  await check('reinicio simulado preserva operacao',async()=>assert.equal(durable.read(file).pending[0].key,'op1'));
  await check('reenvio da chave nao duplica',async()=>assert.equal(
   durable.enqueue(file,op('op1','expenses','a',{id:'a',title:'Luz',amount:100},{id:'a',title:'Luz',amount:120})).status,'duplicate'));
  await check('auditoria informa pendencias',async()=>assert.equal(durable.audit(durable.read(file)).pending,1));
  await check('corrupcao de arquivo detectada',async()=>{
   const bytes=fs.readFileSync(file,'utf8');fs.writeFileSync(file,bytes.replace('"format":1','"format":9'));
   assert.throws(()=>durable.read(file),/corrompido/);
   fs.writeFileSync(file,bytes);
  });
  await check('queda apos commit remoto preserva pendencia',async()=>{
   await assert.rejects(durable.flush(file,db,'usuarioA',prefs,{afterRemote:()=>{throw Error('Queda simulada');}}),/Queda simulada/);
   assert.equal(durable.read(file).pending.length,1);
   assert.equal((await rev.current(db,'usuarioA',prefs)).snapshot.months['2026-11'].expenses[0].amount,120);
  });
  await check('retomada reconhece operacao ja aplicada',async()=>{
   const r=await durable.flush(file,db,'usuarioA',prefs);
   assert.equal(r.status,'synced');assert.equal(r.applied,1);
   assert.equal(durable.read(file).completed[0],'op1');
  });
  await check('retomada nao cria revisao extra',async()=>{
   const before=await rev.current(db,'usuarioA',prefs);
   await durable.flush(file,db,'usuarioA',prefs);
   assert.equal((await rev.current(db,'usuarioA',prefs)).number,before.number);
  });
  await check('exclusao offline conflitante nao apaga alteracao remota',async()=>{
   const current=await rev.current(db,'usuarioA',prefs);
   durable.save(file,queue.create(current.snapshot,current));
   durable.enqueue(file,op('del1','expenses','b',{id:'b',title:'Agua',amount:60},null));
   const remote=structuredClone(current.snapshot);remote.months['2026-11'].expenses[1].amount=75;
   await rev.publish(db,'usuarioA',remote,current);
   assert.equal((await durable.flush(file,db,'usuarioA',prefs)).status,'conflict');
   assert.equal(durable.read(file).pending.length,1);
   assert.equal((await rev.current(db,'usuarioA',prefs)).snapshot.months['2026-11'].expenses[1].amount,75);
  });
  await check('conflito de parcela preserva valor remoto',async()=>{
   const current=await rev.current(db,'usuarioA',prefs);
   durable.save(file,queue.create(current.snapshot,current));
   durable.enqueue(file,op('parcel1','cardExpenses','p1',
    {id:'p1',title:'Parcela',amount:200,installments:4,currentInstallment:2},
    {id:'p1',title:'Parcela',amount:210,installments:4,currentInstallment:2}));
   const remote=structuredClone(current.snapshot);remote.months['2026-11'].cardExpenses[0].amount=220;
   await rev.publish(db,'usuarioA',remote,current);
   assert.equal((await durable.flush(file,db,'usuarioA',prefs)).status,'conflict');
   assert.equal((await rev.current(db,'usuarioA',prefs)).snapshot.months['2026-11'].cardExpenses[0].amount,220);
  });
  await check('alteracoes independentes conciliadas apos reinicio',async()=>{
   const current=await rev.current(db,'usuarioA',prefs);
   durable.save(file,queue.create(current.snapshot,current));
   durable.enqueue(file,op('ind1','expenses','a',{id:'a',title:'Luz',amount:120},{id:'a',title:'Luz',amount:130}));
   const remote=structuredClone(current.snapshot);remote.months['2026-11'].expenses[1].amount=80;
   await rev.publish(db,'usuarioA',remote,current);
   assert.equal((await durable.flush(file,db,'usuarioA',prefs)).status,'synced');
   assert.deepStrictEqual((await rev.current(db,'usuarioA',prefs)).snapshot.months['2026-11'].expenses.map(x=>x.amount),[130,80]);
  });
  await check('usuario B nao acessa revisao de A',async()=>await assert.rejects(
   rev.refs(other,'usuarioA').head.get(),e=>e.code==='permission-denied'));
  await check('snapshot original permanece intacto',async()=>assert.equal(initial.months['2026-11'].salary,5000));
  console.log('RESULTADO: '+passed+'/16 TESTES APROVADOS');
 }finally{await env.cleanup();fs.rmSync(folder,{recursive:true,force:true});}
}
main().catch(e=>{console.error('FALHA:',e);process.exitCode=1;});
