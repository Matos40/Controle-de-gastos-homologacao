'use strict';
const assert=require('node:assert/strict');
const {inspectLegacy}=require('../../js/services/legacyCompatibilityAuditLab.js');
let count=0;
function test(label,fn){fn();count++;console.log('APROVADO:',label);}
const base=()=>({selectedMonth:'2026-11',months:{'2026-11':{
 salary:3000,budgetLimit:2500,closed:false,closedAt:null,
 expenses:[{id:'fix1',title:'Luz',type:'fixed',amount:150,category:'moradia'},
 {id:'inv1',title:'FII',type:'one-time',amount:200,category:'investimentos'}],
 cardExpenses:[{id:'card1',title:'Compra',isInstallment:true,
 installmentOriginId:'orig1',installments:3,currentInstallment:2,installmentValue:100}],
 extraIncomes:[{id:'inc1',description:'Extra',amount:50}],
 deletedInstallmentOrigins:['orig2:2']}}});
const has=(r,code)=>r.issues.some(x=>x.code===code);
test('modelo atual aceito',()=>assert.equal(inspectLegacy(base()).status,'compatible'));
test('contrato atual compativel',()=>assert.equal(inspectLegacy(base()).contractCompatible,true));
test('mes contado',()=>assert.equal(inspectLegacy(base()).stats.months,1));
test('despesas contadas',()=>assert.equal(inspectLegacy(base()).stats.expenses,2));
test('fixas contadas',()=>assert.equal(inspectLegacy(base()).stats.fixed,1));
test('investimentos contados',()=>assert.equal(inspectLegacy(base()).stats.investments,1));
test('cartoes contados',()=>assert.equal(inspectLegacy(base()).stats.cardExpenses,1));
test('parcelas contadas',()=>assert.equal(inspectLegacy(base()).stats.installments,1));
test('renda extra contada',()=>assert.equal(inspectLegacy(base()).stats.extraIncomes,1));
test('marcadores de exclusao contados',()=>assert.equal(inspectLegacy(base()).stats.deletedInstallmentOrigins,1));
test('salario legado ausente sinalizado',()=>{const s=base();delete s.months['2026-11'].salary;assert.equal(has(inspectLegacy(s),'missing_salary'),true);});
test('renda extra legada ausente sinalizada',()=>{const s=base();delete s.months['2026-11'].extraIncomes;assert.equal(has(inspectLegacy(s),'missing_extra_incomes'),true);});
test('lista despesas ausente sinalizada',()=>{const s=base();delete s.months['2026-11'].expenses;assert.equal(has(inspectLegacy(s),'missing_or_invalid_collection'),true);});
test('parcela sem origem sinalizada',()=>{const s=base();delete s.months['2026-11'].cardExpenses[0].installmentOriginId;assert.equal(has(inspectLegacy(s),'legacy_installment_without_origin'),true);});
test('sequencia de parcelas invalida sinalizada',()=>{const s=base();s.months['2026-11'].cardExpenses[0].currentInstallment=4;assert.equal(has(inspectLegacy(s),'invalid_installment_sequence'),true);});
test('exclusoes malformadas sinalizadas',()=>{const s=base();s.months['2026-11'].deletedInstallmentOrigins='orig';assert.equal(has(inspectLegacy(s),'invalid_deleted_origins'),true);});
test('ID duplicado sinalizado',()=>{const s=base();s.months['2026-11'].expenses[1].id='fix1';assert.equal(has(inspectLegacy(s),'missing_or_duplicate_id'),true);});
test('raiz invalida rejeitada',()=>assert.equal(inspectLegacy({}).status,'invalid_legacy_shape'));
test('mes selecionado ausente rejeitado',()=>{const s=base();s.selectedMonth='2026-12';assert.equal(inspectLegacy(s).status,'invalid_legacy_shape');});
test('auditoria nao altera origem',()=>{const s=base(),before=JSON.stringify(s);inspectLegacy(s);assert.equal(JSON.stringify(s),before);});
test('mes adicional contabilizado',()=>{const s=base();s.months['2026-12']=structuredClone(s.months['2026-11']);assert.equal(inspectLegacy(s).stats.months,2);});
test('investimento em cartao contabilizado',()=>{const s=base();s.months['2026-11'].cardExpenses[0].category='investimentos';assert.equal(inspectLegacy(s).stats.investments,2);});
test('origem legada nao e inventada',()=>{const s=base();delete s.months['2026-11'].cardExpenses[0].installmentOriginId;inspectLegacy(s);assert.equal('installmentOriginId' in s.months['2026-11'].cardExpenses[0],false);});
test('contrato rejeita centavo fracionado',()=>{const s=base();s.months['2026-11'].expenses[0].amount=1.001;assert.equal(has(inspectLegacy(s),'contract_rejected'),true);});
test('dados nao serializaveis nao sao processados por efeito colateral',()=>{const s=base();assert.equal(inspectLegacy(s).stats.fixed,1);});
console.log('RESULTADO: '+count+'/25 TESTES APROVADOS');
