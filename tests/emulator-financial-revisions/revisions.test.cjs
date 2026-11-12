'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {initializeTestEnvironment}=require('@firebase/rules-unit-testing');
const lab=require('../../js/services/financialRevisionLab.js');
const rules=fs.readFileSync(path.join(__dirname,'firestore.rules'),'utf8');
let passed=0;
async function check(name,fn){await fn();passed++;console.log('APROVADO:',name);}
const initial={selectedMonth:'2026-11',months:{
 '2026-10':{salary:5000,expenses:[{id:'a',title:'Luz',amount:100}],cardExpenses:[],extraIncomes:[]},
 '2026-11':{salary:5300,expenses:[],cardExpenses:[{id:'b',installments:6,currentInstallment:2,amount:250}],extraIncomes:[]}}};
const changed=structuredClone(initial);changed.months['2026-11'].salary=5500;
const alternate=structuredClone(initial);alternate.months['2026-11'].salary=5400;
const pA={selectedMonth:'2026-10',viewPreferences:{compact:true}};
const pB={selectedMonth:'2026-11',viewPreferences:{compact:false}};
async function main(){
 const env=await initializeTestEnvironment({projectId:'demo-raytech-cg-revisions',
 firestore:{host:'127.0.0.1',port:8087,rules}});
 try{
  await env.clearFirestore();
  const a=env.authenticatedContext('usuarioA').firestore();
  const b=env.authenticatedContext('usuarioB').firestore();
  const original=structuredClone(initial);
  await check('head inicial vazio',async()=>assert.equal((await lab.current(a,'usuarioA',pA)).status,'empty'));
  await check('primeira revisao criada',async()=>assert.equal((await lab.publish(a,'usuarioA',initial,{number:0,checksum:null})).number,1));
  const base=(await lab.current(a,'usuarioA',pA));
  await check('leitura de revisao preserva salario',async()=>assert.equal(base.snapshot.months['2026-11'].salary,5300));
  await check('PC seleciona outubro',async()=>assert.equal(base.snapshot.selectedMonth,'2026-10'));
  await check('celular seleciona novembro',async()=>assert.equal((await lab.current(a,'usuarioA',pB)).snapshot.selectedMonth,'2026-11'));
  await check('chave PIN e mes nao persistem',async()=>{
   const snap=await lab.refs(a,'usuarioA').revisions.doc('1').get();
   assert.equal(/selectedMonth|gemini_user_api_key|controle_gastos_pin_lock|compact/.test(JSON.stringify(snap.data())),false);
  });
  await check('reenvio identico e idempotente',async()=>assert.equal((await lab.publish(a,'usuarioA',initial,{number:0,checksum:null})).status,'unchanged'));
  await check('dispositivo A publica revisao 2',async()=>assert.equal((await lab.publish(a,'usuarioA',changed,{number:base.number,checksum:base.checksum})).number,2));
  await check('dispositivo B desatualizado recebe conflito',async()=>assert.equal((await lab.publish(a,'usuarioA',alternate,{number:base.number,checksum:base.checksum})).status,'conflict'));
  await check('conflito nao altera salario',async()=>assert.equal((await lab.current(a,'usuarioA',pB)).snapshot.months['2026-11'].salary,5500));
  await check('recuperacao traz ultima revisao',async()=>assert.equal((await lab.recover(a,'usuarioA',pA)).number,2));
  await check('historico encadeado valido',async()=>assert.deepStrictEqual((await lab.history(a,'usuarioA')).map(x=>x.number),[1,2]));
  await check('concorrencia nao sobrescreve silenciosamente',async()=>{
   const current=await lab.current(a,'usuarioA',pA);
   const one=structuredClone(changed);one.months['2026-11'].salary=5600;
   const two=structuredClone(changed);two.months['2026-11'].salary=5700;
   const results=await Promise.all([lab.publish(a,'usuarioA',one,current),lab.publish(a,'usuarioA',two,current)]);
   assert.deepStrictEqual(results.map(x=>x.status).sort(),['conflict','published']);
  });
  await check('apos corrida apenas uma revisao adicional',async()=>assert.equal((await lab.history(a,'usuarioA')).length,3));
  await check('usuario B nao le head de A',async()=>await assert.rejects(
   lab.refs(b,'usuarioA').head.get(),e=>e.code==='permission-denied'));
  await check('usuario B nao altera head de A',async()=>await assert.rejects(
   lab.refs(b,'usuarioA').head.set({version:2,number:4,checksum:'x',parent:'y'}),e=>e.code==='permission-denied'));
  await check('usuario B tem historico independente',async()=>{
   assert.equal((await lab.publish(b,'usuarioB',initial,{number:0,checksum:null})).status,'published');
   assert.equal((await lab.history(b,'usuarioB')).length,1);
  });
  await check('revisao imutavel',async()=>await assert.rejects(
   lab.refs(a,'usuarioA').revisions.doc('1').delete(),e=>e.code==='permission-denied'));
  await check('head nao pode retroceder',async()=>await assert.rejects(
   lab.refs(a,'usuarioA').head.update({number:1}),e=>e.code==='permission-denied'));
  await check('chave Gemini injetada e rejeitada',async()=>{
   const x=structuredClone(initial);x.months['2026-10'].gemini_user_api_key='segredo';
   assert.throws(()=>lab.prepare(x),/sensivel/);
  });
  await check('PIN injetado e rejeitado',async()=>{
   const x=structuredClone(initial);x.months['2026-10'].expenses[0].pinHash='1234';
   assert.throws(()=>lab.prepare(x),/sensivel/);
  });
  await check('origem nao sofre mutacao',async()=>assert.deepStrictEqual(initial,original));
  console.log('RESULTADO: '+passed+'/22 TESTES APROVADOS');
 }finally{await env.cleanup();}
}
main().catch(e=>{console.error('FALHA:',e);process.exitCode=1;});
