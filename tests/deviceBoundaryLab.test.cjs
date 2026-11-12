'use strict';
const assert=require('node:assert/strict');
const {extract,assemble,local,audit}=require('../js/services/deviceBoundaryLab.js');
let passed=0;
function check(name,fn){fn();passed++;console.log('APROVADO:',name);}
const original={selectedMonth:'2026-11',months:{
 '2026-10':{salary:5000,expenses:[{id:'a',title:'Luz',amount:100,paid:true}],
  cardExpenses:[],extraIncomes:[]},
 '2026-11':{salary:5200,deletedInstallmentOrigins:['orig:2'],expenses:[],
  cardExpenses:[{id:'b',title:'Compra',installmentValue:200,totalAmount:1200,
   currentInstallment:2,installments:6,installmentOriginId:'orig'}],
  extraIncomes:[{id:'c',description:'Extra',amount:250}]}}};
check('mes selecionado nao sai no payload compartilhado',()=>{
 const x=extract(original);assert.equal(Object.hasOwn(x,'selectedMonth'),false);
});
check('metadados financeiros mensais preservados',()=>{
 assert.deepStrictEqual(extract(original).months,original.months);
});
check('dois dispositivos escolhem meses independentes',()=>{
 const shared=extract(original);
 assert.equal(assemble(shared,{selectedMonth:'2026-10'}).snapshot.selectedMonth,'2026-10');
 assert.equal(assemble(shared,{selectedMonth:'2026-11'}).snapshot.selectedMonth,'2026-11');
});
check('preferencia de visualizacao nao entra no financeiro',()=>{
 const shared=extract(original);
 const r=assemble(shared,{selectedMonth:'2026-10',viewPreferences:{compact:true,theme:'dark'}});
 assert.deepStrictEqual(r.viewPreferences,{compact:true,theme:'dark'});
 assert.equal(JSON.stringify(shared).includes('compact'),false);
});
check('chave Gemini nao pode entrar no payload',()=>{
 const x=structuredClone(original);x.months['2026-10'].expenses[0].gemini_user_api_key='segredo';
 assert.throws(()=>extract(x),/sensivel/);
});
check('PIN nao pode entrar no payload',()=>{
 const x=structuredClone(original);x.months['2026-10'].pinHash='abc';
 assert.throws(()=>extract(x),/sensivel/);
});
check('campos globais desconhecidos sao bloqueados',()=>{
 const x={...original,interfacePreference:{compact:true}};
 assert.throws(()=>extract(x),/nao classificados/);
});
check('chave e PIN nunca sao aceitos em preferencias de montagem',()=>{
 assert.throws(()=>local({selectedMonth:'2026-11',gemini_user_api_key:'x'}),/desconhecidas/);
 assert.throws(()=>local({selectedMonth:'2026-11',controle_gastos_pin_lock:'1234'}),/desconhecidas/);
});
check('mes local ausente no remoto usa fallback deterministico',()=>{
 const x=assemble(extract(original),{selectedMonth:'2026-12'});
 assert.equal(x.snapshot.selectedMonth,'2026-11');assert.equal(x.usedFallback,true);
});
check('mes existente nao aciona fallback',()=>{
 assert.equal(assemble(extract(original),{selectedMonth:'2026-10'}).usedFallback,false);
});
check('valor e parcelas preservados integralmente',()=>{
 const x=assemble(extract(original),{selectedMonth:'2026-11'});
 assert.deepStrictEqual(x.snapshot.months['2026-11'],original.months['2026-11']);
});
check('origem nao sofre mutacao',()=>{
 const before=structuredClone(original);
 audit(original,{selectedMonth:'2026-10'});
 assert.deepStrictEqual(original,before);
});
check('payload com selectedMonth injetado e rejeitado',()=>{
 const x={...extract(original),selectedMonth:'2026-10'};
 assert.throws(()=>assemble(x,{selectedMonth:'2026-11'}),/extra/);
});
check('payload com PIN dentro de registro e rejeitado',()=>{
 const x=extract(original);x.months['2026-10'].expenses[0].pin='1234';
 assert.throws(()=>assemble(x,{selectedMonth:'2026-11'}),/sensivel/);
});
check('preferencias invalidas sao rejeitadas',()=>{
 assert.throws(()=>local({selectedMonth:'2026-13'}),/invalido/);
 assert.throws(()=>local({selectedMonth:'2026-11',viewPreferences:[]}),/invalida/);
});
check('mes sem dados nao e criado silenciosamente',()=>{
 assert.throws(()=>assemble({schema:1,months:{}},{selectedMonth:'2026-11'}),/Sem mes/);
});
console.log('RESULTADO: '+passed+'/16 TESTES APROVADOS');
