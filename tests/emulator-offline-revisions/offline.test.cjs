'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {initializeTestEnvironment}=require('@firebase/rules-unit-testing');
const rev=require('../../js/services/financialRevisionLab.js');
const queue=require('../../js/services/offlineRevisionQueueLab.js');
const rules=fs.readFileSync(path.join(__dirname,'firestore.rules'),'utf8');
let passed=0;
async function check(name,fn){await fn();passed++;console.log('APROVADO:',name);}
const initial={selectedMonth:'2026-11',months:{'2026-11':{
 salary:5000,expenses:[{id:'a',title:'Luz',amount:100},{id:'b',title:'Agua',amount:60}],
 cardExpenses:[],extraIncomes:[]}}};
const prefs={selectedMonth:'2026-11'};
async function main(){
 const env=await initializeTestEnvironment({projectId:'demo-raytech-cg-offline',
 firestore:{host:'127.0.0.1',port:8088,rules}});
 try{
  await env.clearFirestore();
  const a=env.authenticatedContext('usuarioA').firestore();
  const b=env.authenticatedContext('usuarioB').firestore();
  await check('revisao inicial',async()=>assert.equal((await rev.publish(a,'usuarioA',initial,{number:0,checksum:null})).status,'published'));
  const base=await rev.current(a,'usuarioA',prefs);
  let state=queue.create(base.snapshot,base);
  await check('fila inicialmente vazia',async()=>assert.equal(state.pending.length,0));
  await check('enfileirar offline sem alterar Firestore',async()=>{
   const result=queue.enqueue(state,{key:'offline-1',ym:'2026-11',type:'expenses',id:'a',
    expected:{id:'a',title:'Luz',amount:100},value:{id:'a',title:'Luz',amount:125}});
   state=result.state;assert.equal(result.status,'queued');
   assert.equal((await rev.current(a,'usuarioA',prefs)).snapshot.months['2026-11'].expenses[0].amount,100);
  });
  await check('fila sobrevive serializacao e recarga',async()=>{
   state=queue.load(JSON.stringify(state));assert.equal(state.pending.length,1);
  });
  await check('chave duplicada nao gera operacao',async()=>{
   const r=queue.enqueue(state,{key:'offline-1',ym:'2026-11',type:'expenses',id:'a',
    expected:{id:'a',title:'Luz',amount:100},value:{id:'a',title:'Luz',amount:125}});
   assert.equal(r.status,'duplicate');assert.equal(r.state.pending.length,1);
  });
  await check('outro dispositivo altera registro independente',async()=>{
   const current=await rev.current(a,'usuarioA',prefs);
   const next=structuredClone(current.snapshot);
   next.months['2026-11'].expenses[1].amount=70;
   assert.equal((await rev.publish(a,'usuarioA',next,current)).status,'published');
  });
  await check('reconexao concilia registros independentes',async()=>{
   const r=await queue.flush(a,'usuarioA',state,prefs);
   assert.equal(r.status,'synced');assert.equal(r.applied,1);state=r.state;
   const current=await rev.current(a,'usuarioA',prefs);
   assert.deepStrictEqual(current.snapshot.months['2026-11'].expenses.map(x=>x.amount),[125,70]);
  });
  await check('fila esvaziada e operacao marcada concluida',async()=>{
   assert.equal(state.pending.length,0);assert.deepStrictEqual(state.completed,['offline-1']);
  });
  await check('reenvio apos confirmacao nao duplica',async()=>{
   const r=queue.enqueue(state,{key:'offline-1',ym:'2026-11',type:'expenses',id:'a',
    expected:{id:'a',title:'Luz',amount:100},value:{id:'a',title:'Luz',amount:125}});
   assert.equal(r.status,'duplicate');
  });
  await check('flush repetido nao cria revisao',async()=>{
   const before=await rev.current(a,'usuarioA',prefs);
   const r=await queue.flush(a,'usuarioA',state,prefs);
   const after=await rev.current(a,'usuarioA',prefs);
   assert.equal(r.applied,0);assert.equal(after.number,before.number);
  });
  await check('alteracao concorrente no mesmo registro bloqueada',async()=>{
   const current=await rev.current(a,'usuarioA',prefs);
   const local=queue.enqueue(queue.create(current.snapshot,current),{
    key:'offline-2',ym:'2026-11',type:'expenses',id:'a',
    expected:{id:'a',title:'Luz',amount:125},value:{id:'a',title:'Luz',amount:140}}).state;
   const remote=structuredClone(current.snapshot);
   remote.months['2026-11'].expenses[0].amount=150;
   await rev.publish(a,'usuarioA',remote,current);
   const result=await queue.flush(a,'usuarioA',local,prefs);
   assert.equal(result.status,'conflict');assert.equal(result.state.pending.length,1);
   assert.equal((await rev.current(a,'usuarioA',prefs)).snapshot.months['2026-11'].expenses[0].amount,150);
  });
  await check('fila com conflito permanece serializavel',async()=>{
   const current=await rev.current(a,'usuarioA',prefs);
   const local=queue.enqueue(queue.create(current.snapshot,current),{
    key:'offline-3',ym:'2026-11',type:'salary',expected:5000,value:5100}).state;
   const remote=structuredClone(current.snapshot);remote.months['2026-11'].salary=5200;
   await rev.publish(a,'usuarioA',remote,current);
   const result=await queue.flush(a,'usuarioA',local,prefs);
   assert.equal(result.status,'conflict');
   assert.equal(queue.load(JSON.stringify(result.state)).pending.length,1);
  });
  await check('outro usuario nao acessa revisoes',async()=>await assert.rejects(
   rev.refs(b,'usuarioA').head.get(),e=>e.code==='permission-denied'));
  await check('outro usuario tem fila independente',async()=>{
   await rev.publish(b,'usuarioB',initial,{number:0,checksum:null});
   assert.equal((await rev.current(b,'usuarioB',prefs)).snapshot.months['2026-11'].salary,5000);
  });
  await check('operacao sem precondicao e rejeitada',async()=>assert.throws(()=>
   queue.enqueue(state,{key:'bad',ym:'2026-11',type:'salary',value:9000}),/Precondicao/));
  await check('origem financeira intacta',async()=>assert.equal(initial.months['2026-11'].salary,5000));
  console.log('RESULTADO: '+passed+'/16 TESTES APROVADOS');
 }finally{await env.cleanup();}
}
main().catch(e=>{console.error('FALHA:',e);process.exitCode=1;});
