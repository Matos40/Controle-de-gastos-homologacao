'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {initializeTestEnvironment}=require('@firebase/rules-unit-testing');
const {normalizeSnapshot}=require('../../js/services/preMigrationLab.js');
const {state,run,finalize,finalRef,finalValue}=require('../../js/services/migrationCompletionLab.js');
const {entries,ref}=require('../../js/services/monthMigrationLab.js');
const rules=fs.readFileSync(path.join(__dirname,'firestore.rules'),'utf8');
const source={selectedMonth:'2026-11',months:{
 '2026-10':{salary:5000,closed:true,deletedInstallmentOrigins:['orig:2'],
  expenses:[{id:'exp1',title:'Luz',amount:150}],cardExpenses:[],extraIncomes:[]},
 '2026-11':{salary:5100,closed:false,expenses:[],cardExpenses:[
  {id:'card1',title:'Compra',installmentValue:250,totalAmount:1500,
   installments:6,currentInstallment:2,installmentOriginId:'orig'}],extraIncomes:[]}
}};
let passed=0;
async function check(name,fn){await fn();passed++;console.log('APROVADO:',name);}
async function main(){
 const env=await initializeTestEnvironment({projectId:'demo-raytech-cg-protocol',
  firestore:{host:'127.0.0.1',port:8085,rules}});
 try{
  await env.clearFirestore();
  const a=env.authenticatedContext('usuarioA').firestore();
  const b=env.authenticatedContext('usuarioB').firestore();
  const plan=normalizeSnapshot(source,'protocol');
  const original=structuredClone(source);
  await check('estado inicial nao iniciado',async()=>assert.equal((await state(plan,a,'usuarioA')).status,'not_started'));
  await check('primeiro lote nao finaliza',async()=>{
   assert.equal((await run(plan,a,'usuarioA',1)).status,'in_progress');
   assert.equal((await finalRef(a,'usuarioA',plan).get()).exists,false);
  });
  await check('manifesto sozinho nao autoriza conclusao',async()=>{
   await assert.rejects(finalize(plan,a,'usuarioA'),/incompleta/);
  });
  await check('retomada de lote parcial',async()=>{
   const r=await run(plan,a,'usuarioA',2);
   assert.equal(r.status,'in_progress');assert.equal(r.written,2);
  });
  await check('retomada conclui e audita',async()=>{
   const r=await run(plan,a,'usuarioA',30);
   assert.equal(r.status,'audited');assert.equal(r.created,true);
  });
  await check('marcador final corresponde ao plano',async()=>{
   assert.deepStrictEqual((await finalRef(a,'usuarioA',plan).get()).data(),finalValue(plan));
  });
  await check('reenvio apos conclusao e idempotente',async()=>{
   assert.deepStrictEqual(await run(plan,a,'usuarioA',30),{status:'audited',written:0});
  });
  await check('finalizacao repetida nao duplica marcador',async()=>{
   assert.deepStrictEqual(await finalize(plan,a,'usuarioA'),{status:'audited',created:false});
  });
  await check('alteracao de salario no outro dispositivo bloqueada',async()=>{
   const changed=structuredClone(source);changed.months['2026-10'].salary=999;
   assert.equal((await run(normalizeSnapshot(changed,'protocol'),a,'usuarioA',30)).status,'conflict');
  });
  await check('alteracao de exclusao de parcela bloqueada',async()=>{
   const changed=structuredClone(source);changed.months['2026-10'].deletedInstallmentOrigins=[];
   assert.equal((await run(normalizeSnapshot(changed,'protocol'),a,'usuarioA',30)).status,'conflict');
  });
  await check('outro usuario nao pode ler marcador',async()=>{
   await assert.rejects(finalRef(b,'usuarioA',plan).get(),e=>e.code==='permission-denied');
  });
  await check('outro usuario nao pode criar marcador',async()=>{
   await assert.rejects(finalRef(b,'usuarioA',plan).set(finalValue(plan)),
    e=>e.code==='permission-denied');
  });
  await check('marcador nao pode ser editado',async()=>{
   await assert.rejects(finalRef(a,'usuarioA',plan).update({status:'in_progress'}),
    e=>e.code==='permission-denied');
  });
  await check('marcador nao pode ser excluido',async()=>{
   await assert.rejects(finalRef(a,'usuarioA',plan).delete(),
    e=>e.code==='permission-denied');
  });
  await check('versao de marcador invalida e rejeitada',async()=>{
   const fake=normalizeSnapshot({selectedMonth:'2026-12',months:{
    '2026-12':{expenses:[],cardExpenses:[],extraIncomes:[]}}},'fake');
   await assert.rejects(finalRef(a,'usuarioA',fake).set({...finalValue(fake),version:2}),
    e=>e.code==='permission-denied');
  });
  await check('outro usuario tem progresso independente',async()=>{
   assert.equal((await state(plan,b,'usuarioB')).status,'not_started');
   assert.equal((await run(plan,b,'usuarioB',30)).status,'audited');
  });
  await check('concorrencia no reenvio nao cria duplicatas',async()=>{
   const results=await Promise.all([run(plan,b,'usuarioB',30),run(plan,b,'usuarioB',30)]);
   assert.equal(results.every(x=>x.status==='audited'),true);
  });
  await check('erro de rede simulado retorna interrompido',async()=>{
   const bad={doc(){throw Error('Offline simulado');}};
   await assert.rejects(state(plan,bad,'usuarioC'),/Offline simulado/);
  });
  await check('origem financeira ficticia permanece intacta',async()=>assert.deepStrictEqual(source,original));
  console.log('RESULTADO: '+passed+'/19 TESTES APROVADOS');
 }finally{await env.cleanup();}
}
main().catch(err=>{console.error('FALHA:',err);process.exitCode=1;});
