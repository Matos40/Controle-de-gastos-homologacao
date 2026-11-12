'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {initializeTestEnvironment}=require('@firebase/rules-unit-testing');
const rev=require('../../js/services/financialRevisionLab.js');
const lab=require('../../js/services/remoteIdempotencyLab.js');
const rules=fs.readFileSync(path.join(__dirname,'firestore.rules'),'utf8');
let passed=0;
async function test(name,fn){await fn();passed++;console.log('APROVADO:',name);}
const prefs={selectedMonth:'2026-11'};
const source={selectedMonth:'2026-11',months:{'2026-11':{salary:5000,
 expenses:[{id:'a',title:'Luz',amount:100},{id:'b',title:'Agua',amount:60}],
 cardExpenses:[],extraIncomes:[]}}};
const op=(key,id,expected,value)=>({key,ym:'2026-11',type:'expenses',id,expected,value});
async function main(){
 const env=await initializeTestEnvironment({projectId:'demo-raytech-cg-receipts',
 firestore:{host:'127.0.0.1',port:8090,rules}});
 try{
  await env.clearFirestore();
  const db=env.authenticatedContext('usuarioA').firestore();
  const other=env.authenticatedContext('usuarioB').firestore();
  const first=op('unique1','a',{id:'a',title:'Luz',amount:100},{id:'a',title:'Luz',amount:120});
  await test('sem head nao cria recibo',async()=>assert.equal((await lab.submit(db,'usuarioA',first,prefs)).status,'missing_remote'));
  await test('revisao inicial',async()=>assert.equal((await rev.publish(db,'usuarioA',source,{number:0,checksum:null})).status,'published'));
  await test('commit atomico cria recibo',async()=>assert.equal((await lab.submit(db,'usuarioA',first,prefs)).status,'committed'));
  await test('recibo persistido',async()=>assert.equal((await lab.receiptRef(db,'usuarioA','unique1').get()).exists,true));
  await test('reenvio retorna duplicate',async()=>assert.equal((await lab.submit(db,'usuarioA',first,prefs)).status,'duplicate'));
  await test('reenvio nao incrementa revisao',async()=>assert.equal((await rev.current(db,'usuarioA',prefs)).number,2));
  await test('mesma chave conteudo diferente bloqueado',async()=>assert.equal((await lab.submit(db,'usuarioA',{...first,value:{id:'a',title:'Luz',amount:999}},prefs)).status,'key_conflict'));
  await test('operacao posterior altera mesmo registro',async()=>{
   const later=op('unique2','a',{id:'a',title:'Luz',amount:120},{id:'a',title:'Luz',amount:130});
   assert.equal((await lab.submit(db,'usuarioA',later,prefs)).status,'committed');
  });
  await test('reenvio antigo apos mudanca posterior continua duplicate',async()=>assert.equal((await lab.submit(db,'usuarioA',first,prefs)).status,'duplicate'));
  await test('valor posterior preservado',async()=>assert.equal((await rev.current(db,'usuarioA',prefs)).snapshot.months['2026-11'].expenses[0].amount,130));
  await test('conflito no mesmo registro nao gera recibo',async()=>{
   const bad=op('unique3','a',{id:'a',title:'Luz',amount:100},{id:'a',title:'Luz',amount:200});
   assert.equal((await lab.submit(db,'usuarioA',bad,prefs)).status,'conflict');
   assert.equal((await lab.receiptRef(db,'usuarioA','unique3').get()).exists,false);
  });
  await test('operacao independente aceita',async()=>{
   const next=op('unique4','b',{id:'b',title:'Agua',amount:60},{id:'b',title:'Agua',amount:70});
   assert.equal((await lab.submit(db,'usuarioA',next,prefs)).status,'committed');
  });
  await test('duplo envio simultaneo tem um unico recibo',async()=>{
   const next=op('unique5','b',{id:'b',title:'Agua',amount:70},{id:'b',title:'Agua',amount:75});
   const results=await Promise.all([lab.submit(db,'usuarioA',next,prefs),lab.submit(db,'usuarioA',next,prefs)]);
   assert.deepStrictEqual(results.map(x=>x.status).sort(),['committed','duplicate']);
  });
  await test('historico e recibos auditados',async()=>assert.deepStrictEqual(
   await lab.audit(db,'usuarioA'),{revisions:5,receipts:4,status:'audited'}));
  await test('outro usuario nao le recibo',async()=>await assert.rejects(
   lab.receiptRef(other,'usuarioA','unique1').get(),e=>e.code==='permission-denied'));
  await test('outro usuario nao cria recibo',async()=>await assert.rejects(
   lab.receiptRef(other,'usuarioA','intruso').set({version:1,key:'intruso',operationHash:'x',number:2,checksum:'x'}),
   e=>e.code==='permission-denied'));
  await test('recibo nao pode ser editado',async()=>await assert.rejects(
   lab.receiptRef(db,'usuarioA','unique1').update({number:99}),e=>e.code==='permission-denied'));
  await test('recibo nao pode ser apagado',async()=>await assert.rejects(
   lab.receiptRef(db,'usuarioA','unique1').delete(),e=>e.code==='permission-denied'));
  await test('dados de origem intactos',async()=>assert.equal(source.months['2026-11'].expenses[0].amount,100));
  console.log('RESULTADO: '+passed+'/19 TESTES APROVADOS');
 }finally{await env.cleanup();}
}
main().catch(e=>{console.error('FALHA:',e);process.exitCode=1;});
