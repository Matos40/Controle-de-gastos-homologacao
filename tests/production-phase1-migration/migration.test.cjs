'use strict';
const assert=require('node:assert/strict');
const {migrate,verify,createSession,balances}=require('../../js/services/reversibleFinanceMigrationLab.js');
let passed=0;
function test(name,fn){fn();passed++;console.log('APROVADO:',name);}
const source=()=>({selectedMonth:'2026-11',months:{
 '2026-10':{salary:4000,expenses:[{id:'fix',title:'Aluguel',type:'fixed',amount:900,paid:true}],
 cardExpenses:[{id:'c1',title:'Notebook',isInstallment:true,installments:3,currentInstallment:1,installmentValue:200,installmentOriginId:'orig'}],
 extraIncomes:[{id:'i1',amount:50}],deletedInstallmentOrigins:[],closed:true,closedAt:'2026-10-31'},
 '2026-11':{expenses:[{id:'fix2',title:'Aluguel',type:'fixed',amount:950,paid:false},
 {id:'inv',title:'FII',category:'investimentos',type:'one-time',amount:250}],
 cardExpenses:[{id:'c2',title:'Notebook',isInstallment:true,installments:3,currentInstallment:2,installmentValue:200,installmentOriginId:'orig'}],
 deletedInstallmentOrigins:['other:3'],budgetLimit:2000,closed:false,closedAt:null}}});
const err=(fn,code)=>assert.throws(fn,e=>e.code===code);
test('gera plano',()=>assert.equal(migrate(source()).version,1));
test('preserva snapshot original',()=>assert.deepEqual(migrate(source()).original,source()));
test('nao altera origem',()=>{const s=source(),before=JSON.stringify(s);migrate(s);assert.equal(JSON.stringify(s),before);});
test('normaliza salario ausente',()=>assert.equal(migrate(source()).normalized.months['2026-11'].salary,0));
test('normaliza renda extra ausente',()=>assert.deepEqual(migrate(source()).normalized.months['2026-11'].extraIncomes,[]));
test('preserva salario existente',()=>assert.equal(migrate(source()).normalized.months['2026-10'].salary,4000));
test('preserva despesa fixa',()=>assert.equal(migrate(source()).normalized.months['2026-11'].expenses[0].amount,950));
test('preserva investimento',()=>assert.equal(migrate(source()).normalized.months['2026-11'].expenses[1].category,'investimentos'));
test('preserva IDs',()=>assert.equal(migrate(source()).normalized.months['2026-11'].cardExpenses[0].id,'c2'));
test('preserva origem de parcelas',()=>assert.equal(migrate(source()).normalized.months['2026-11'].cardExpenses[0].installmentOriginId,'orig'));
test('preserva sequencia de parcelas',()=>assert.equal(migrate(source()).normalized.months['2026-11'].cardExpenses[0].currentInstallment,2));
test('preserva exclusoes',()=>assert.deepEqual(migrate(source()).normalized.months['2026-11'].deletedInstallmentOrigins,['other:3']));
test('preserva status pago',()=>assert.equal(migrate(source()).normalized.months['2026-10'].expenses[0].paid,true));
test('preserva mes fechado',()=>assert.equal(migrate(source()).normalized.months['2026-10'].closed,true));
test('preserva orcamento',()=>assert.equal(migrate(source()).normalized.months['2026-11'].budgetLimit,2000));
test('preserva saldos',()=>assert.deepEqual(migrate(source()).beforeBalances,migrate(source()).afterBalances));
test('saldo mensal inclui mes anterior',()=>assert.equal(balances(source())['2026-11'],1550));
test('plano verifica',()=>assert.equal(verify(migrate(source())).version,1));
test('alteracao no original detectada',()=>{const p=migrate(source());p.original.months['2026-11'].expenses[0].amount=1;err(()=>verify(p),'tampered_plan');});
test('alteracao na normalizacao detectada',()=>{const p=migrate(source());p.normalized.months['2026-11'].expenses[0].amount=1;err(()=>verify(p),'tampered_plan');});
test('alteracao nos saldos detectada',()=>{const p=migrate(source());p.afterBalances['2026-11']=999;err(()=>verify(p),'tampered_plan');});
test('sessao inicia sem mutacao',()=>assert.deepEqual(createSession(source()).read(),source()));
test('aplica migracao',()=>{const s=createSession(source());assert.equal(s.apply(migrate(source()),0).status,'migrated');});
test('aplica com revisao incrementada',()=>{const s=createSession(source());s.apply(migrate(source()),0);assert.equal(s.revision(),1);});
test('rollback restaura original exato',()=>{const original=source(),s=createSession(original),p=migrate(original);s.apply(p,0);s.rollback(p,1);assert.deepEqual(s.read(),original);});
test('rollback incrementa revisao',()=>{const s=createSession(source()),p=migrate(source());s.apply(p,0);s.rollback(p,1);assert.equal(s.revision(),2);});
test('aplicacao com revisao antiga rejeitada',()=>{const s=createSession(source());err(()=>s.apply(migrate(source()),1),'revision_conflict');});
test('rollback com revisao antiga rejeitado',()=>{const s=createSession(source()),p=migrate(source());s.apply(p,0);err(()=>s.rollback(p,0),'revision_conflict');});
test('origem divergente impede aplicacao',()=>{const s=source(),other=source();other.months['2026-11'].expenses[0].amount=951;err(()=>createSession(other).apply(migrate(s),0),'source_conflict');});
test('rollback em estado nao migrado rejeitado',()=>{const s=createSession(source());err(()=>s.rollback(migrate(source()),0),'rollback_conflict');});
test('plano adulterado nao altera estado',()=>{const s=createSession(source()),p=migrate(source());p.normalized.months['2026-11'].salary=999;err(()=>s.apply(p,0),'tampered_plan');assert.deepEqual(s.read(),source());});
test('parcela sem origem preservada sem inventar',()=>{const s=source();delete s.months['2026-11'].cardExpenses[0].installmentOriginId;const p=migrate(s);assert.equal('installmentOriginId' in p.normalized.months['2026-11'].cardExpenses[0],false);});
test('centavos fracionados rejeitados',()=>{const s=source();s.months['2026-11'].expenses[0].amount=1.001;err(()=>migrate(s),'incompatible_contract');});
test('ID duplicado exige revisao',()=>{const s=source();s.months['2026-11'].expenses[1].id='fix2';err(()=>migrate(s),'invalid_legacy_snapshot');});
test('entrada nao serializavel rejeitada',()=>{const s=source();s.months['2026-11'].expenses[0].amount=Infinity;err(()=>migrate(s),'invalid_legacy_snapshot');});
console.log('RESULTADO: '+passed+'/35 TESTES APROVADOS');
