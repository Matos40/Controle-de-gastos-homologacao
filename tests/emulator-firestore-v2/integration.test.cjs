'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {initializeTestEnvironment}=require('@firebase/rules-unit-testing');
const {normalizeSnapshot}=require('../../js/services/preMigrationLab.js');
const lab=require('../../js/services/firestoreV2IntegrationLab.js');
const rules=fs.readFileSync(path.join(__dirname,'firestore.rules'),'utf8');
const source={selectedMonth:'2026-11',months:{
 '2026-10':{salary:5000,expenses:[{id:'e1',title:'Luz',amount:120}],cardExpenses:[],extraIncomes:[]},
 '2026-11':{salary:5300,expenses:[],cardExpenses:[{id:'c1',installmentValue:250,totalAmount:1500,installments:6,currentInstallment:2}],extraIncomes:[]}
}};
const prefA={selectedMonth:'2026-10',viewPreferences:{compact:true}};
const prefB={selectedMonth:'2026-11',viewPreferences:{compact:false}};
let passed=0;
async function check(name,fn){await fn();passed++;console.log('APROVADO:',name);}
async function main(){
 const env=await initializeTestEnvironment({projectId:'demo-raytech-cg-v2',
  firestore:{host:'127.0.0.1',port:8086,rules}});
 try{
  await env.clearFirestore();
  const a=env.authenticatedContext('usuarioA').firestore();
  const b=env.authenticatedContext('usuarioB').firestore();
  const plan=lab.prepare(source);
  const original=structuredClone(source);
  await check('plano v2 sem selectedMonth',async()=>assert.equal(JSON.stringify(plan.docs).includes('selectedMonth'),false));
  await check('plano v2 sem chave Gemini e PIN',async()=>assert.equal(/gemini_user_api_key|controle_gastos_pin_lock/.test(JSON.stringify(plan.docs)),false));
  await check('plano possui manifesto e dois meses',async()=>assert.equal(plan.docs.length,3));
  await check('inicio sem documentos remotos',async()=>assert.equal((await lab.inspect(plan,a,'usuarioA')).missing.length,3));
  await check('lote parcial nao cria marcador',async()=>{
   assert.equal((await lab.run(plan,a,'usuarioA',prefA,1)).status,'in_progress');
   assert.equal((await lab.marker(a,'usuarioA',plan).get()).exists,false);
  });
  await check('leitura parcial nao e permitida',async()=>await assert.rejects(lab.read(plan,a,'usuarioA',prefA),/incompleto/));
  await check('retomada conclui com auditoria',async()=>assert.equal((await lab.run(plan,a,'usuarioA',prefA,5)).status,'audited'));
  await check('marcador final criado',async()=>assert.equal((await lab.marker(a,'usuarioA',plan).get()).data().status,'audited'));
  await check('PC usa mes de outubro',async()=>assert.equal((await lab.read(plan,a,'usuarioA',prefA)).snapshot.selectedMonth,'2026-10'));
  await check('celular usa mes de novembro',async()=>assert.equal((await lab.read(plan,a,'usuarioA',prefB)).snapshot.selectedMonth,'2026-11'));
  await check('preferencias nao persistem no Firestore',async()=>{
   const docs=await lab.root(a,'usuarioA',plan).get();
   assert.equal(docs.docs.some(x=>/selectedMonth|compact|gemini_user_api_key|controle_gastos_pin_lock/.test(JSON.stringify(x.data()))),false);
  });
  await check('reenvio nao duplica documentos',async()=>{
   const r=await lab.run(plan,a,'usuarioA',prefA,10);
   assert.equal(r.status,'audited');assert.equal(r.created,false);assert.equal(r.written,0);
  });
  await check('legado v1 convertido para v2 preserva dados',async()=>{
   const legacy=normalizeSnapshot(source,'v2-demo');
   const converted=lab.prepare({version:1,plan:legacy});
   assert.deepStrictEqual(converted.envelope.shared.months,source.months);
   assert.equal(JSON.stringify(converted.docs).includes('selectedMonth'),false);
  });
  await check('alteracao financeira em outro dispositivo gera conflito',async()=>{
   const changed=structuredClone(source);changed.months['2026-10'].salary=999;
   const altered=lab.prepare(changed);
   assert.notEqual(altered.planId,plan.planId);
   // Planos de checksum diferente ficam isolados, sem sobrescrita.
   assert.equal((await lab.inspect(altered,a,'usuarioA')).missing.length,3);
   assert.equal((await lab.inspect(plan,a,'usuarioA')).missing.length,0);
  });
  await check('usuario B nao le usuario A',async()=>await assert.rejects(
   lab.root(b,'usuarioA',plan).get(),e=>e.code==='permission-denied'));
  await check('usuario B nao grava usuario A',async()=>await assert.rejects(
   lab.root(b,'usuarioA',plan).doc('manifest').set(plan.docs[0].value),
   e=>e.code==='permission-denied'));
  await check('usuario B possui migracao independente',async()=>assert.equal(
   (await lab.run(plan,b,'usuarioB',prefB,10)).status,'audited'));
  await check('marcador imutavel',async()=>await assert.rejects(
   lab.marker(a,'usuarioA',plan).delete(),e=>e.code==='permission-denied'));
  await check('documentos imutaveis',async()=>await assert.rejects(
   lab.root(a,'usuarioA',plan).doc('manifest').update({monthCount:100}),
   e=>e.code==='permission-denied'));
  await check('regras rejeitam chave Gemini no mes',async()=>{
   const newPlan=lab.prepare({selectedMonth:'2026-12',months:{
    '2026-12':{expenses:[],cardExpenses:[],extraIncomes:[]}}});
   const doc=newPlan.docs[1];
   await assert.rejects(lab.root(a,'usuarioA',newPlan).doc(doc.id).set({
    ...doc.value,data:{...doc.value.data,gemini_user_api_key:'segredo'}
   }),e=>e.code==='permission-denied');
  });
  await check('origem permanece intacta',async()=>assert.deepStrictEqual(source,original));
  console.log('RESULTADO: '+passed+'/21 TESTES APROVADOS');
 }finally{await env.cleanup();}
}
main().catch(e=>{console.error('FALHA:',e);process.exitCode=1;});
