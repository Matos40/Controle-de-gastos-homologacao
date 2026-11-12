'use strict';
const assert=require('node:assert/strict');
const {ContractError,cents,validateSnapshot,userPath,assertOwner,sanitizeSyncPayload}=
 require('../../js/services/productionDataContractLab.js');
let n=0;
function test(name,fn){fn();n++;console.log('APROVADO:',name);}
const sample=()=>({selectedMonth:'2026-11',months:{'2026-11':{
 salary:3000,expenses:[{id:'a',amount:100.25}],
 cardExpenses:[{id:'c',installmentValue:25.5}],
 extraIncomes:[{id:'e',amount:50}]}}});
const fails=(fn,code)=>assert.throws(fn,e=>e instanceof ContractError&&e.code===code);
test('snapshot valido',()=>assert.deepEqual(validateSnapshot(sample()),{months:1,entries:3}));
test('centavos exatos',()=>assert.equal(cents(10.25),1025));
test('valor negativo representavel',()=>assert.equal(cents(-1.5),-150));
test('fração de centavo rejeitada',()=>fails(()=>cents(1.001),'invalid_money'));
test('NaN rejeitado',()=>fails(()=>cents(NaN),'invalid_money'));
test('infinito rejeitado',()=>fails(()=>cents(Infinity),'invalid_money'));
test('string monetaria rejeitada',()=>fails(()=>cents('1'),'invalid_money'));
test('salario ausente rejeitado',()=>{const s=sample();delete s.months['2026-11'].salary;fails(()=>validateSnapshot(s),'invalid_money');});
test('mes selecionado inexistente rejeitado',()=>{const s=sample();s.selectedMonth='2026-12';fails(()=>validateSnapshot(s),'invalid_snapshot');});
test('mes invalido rejeitado',()=>{const s=sample();s.months['2026-13']=s.months['2026-11'];fails(()=>validateSnapshot(s),'invalid_month');});
test('despesas sem lista rejeitadas',()=>{const s=sample();delete s.months['2026-11'].expenses;fails(()=>validateSnapshot(s),'invalid_collection');});
test('cartao sem valor rejeitado',()=>{const s=sample();delete s.months['2026-11'].cardExpenses[0].installmentValue;fails(()=>validateSnapshot(s),'invalid_money');});
test('ID duplicado na mesma colecao rejeitado',()=>{const s=sample();s.months['2026-11'].expenses.push({id:'a',amount:1});fails(()=>validateSnapshot(s),'invalid_entry');});
test('IDs entre colecoes independentes',()=>{const s=sample();s.months['2026-11'].cardExpenses[0].id='a';assert.equal(validateSnapshot(s).entries,3);});
test('ID de entrada invalido',()=>{const s=sample();s.months['2026-11'].expenses[0].id='../x';fails(()=>validateSnapshot(s),'invalid_entry');});
test('UID seguro vira path',()=>assert.equal(userPath('user_1'),'users/user_1'));
test('UID com barra rejeitado',()=>fails(()=>userPath('a/b'),'invalid_uid'));
test('UID vazio rejeitado',()=>fails(()=>userPath(''),'invalid_uid'));
test('usuario autenticado pode acessar proprio path',()=>assert.equal(assertOwner('a','a'),'users/a'));
test('usuario B nao acessa usuario A',()=>fails(()=>assertOwner('b','a'),'forbidden'));
test('UID ausente rejeitado',()=>fails(()=>assertOwner(null,'a'),'forbidden'));
test('payload de sincronizacao aceita somente campos financeiros',()=>assert.deepEqual(sanitizeSyncPayload(sample()),sample()));
test('chave API nunca aceita no payload',()=>fails(()=>sanitizeSyncPayload({...sample(),gemini_user_api_key:'secret'}),'unexpected_fields'));
test('PIN nunca aceito no payload',()=>fails(()=>sanitizeSyncPayload({...sample(),controle_gastos_pin_lock:'1234'}),'unexpected_fields'));
test('payload nao e referencia compartilhada',()=>{const s=sample(),copy=sanitizeSyncPayload(s);copy.months['2026-11'].salary=9;assert.equal(s.months['2026-11'].salary,3000);});
test('mes excessivo rejeitado',()=>{const s=sample();for(let i=0;i<241;i++){const y=2020+Math.floor(i/12),m=String(i%12+1).padStart(2,'0');s.months[y+'-'+m]=sample().months['2026-11'];}fails(()=>validateSnapshot(s),'too_many_months');});
console.log('RESULTADO: '+n+'/26 TESTES APROVADOS');
