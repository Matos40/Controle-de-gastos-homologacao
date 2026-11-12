'use strict';
// Auditoria ponta a ponta puramente em memoria, somente dados sinteticos.
const assert=require('node:assert/strict');
const {migrate,verify,createSession,balances}=require('./reversibleFinanceMigrationLab.js');
const {inspectLegacy}=require('./legacyCompatibilityAuditLab.js');
const clone=x=>JSON.parse(JSON.stringify(x));
const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
const sum=(items,key)=>(items||[]).reduce((n,x)=>n+x[key],0);
function syntheticHistory(){
 const months={};
 const data=[
  ['2026-09',4000,800,100,1,150,100],
  ['2026-10',4100,850,100,2,175,150],
  ['2026-11',4200,900,100,3,200,200],
  ['2026-12',4300,950,0,0,225,250]
 ];
 for(const [ym,salary,rent,card,installment,investment,extra] of data){
  months[ym]={
   salary,budgetLimit:5000,closed:ym!=='2026-12',closedAt:ym==='2026-12'?null:ym+'-28',
   expenses:[
    {id:'rent-'+ym,title:'Aluguel',type:'fixed',category:'moradia',amount:rent,date:ym+'-05',paid:ym!=='2026-12'},
    {id:'invest-'+ym,title:'Aporte FII',type:'one-time',category:'investimentos',amount:investment,date:ym+'-10',paid:true}
   ],
   cardExpenses:installment?[{id:'card-'+ym,title:'Notebook',category:'compras',
    isInstallment:true,installmentOriginId:'notebook-origin',installments:3,
    currentInstallment:installment,installmentValue:card,totalAmount:300,
    date:ym+'-12',paid:ym!=='2026-11'}]:[],
   extraIncomes:[{id:'extra-'+ym,description:'Extra',amount:extra,date:ym+'-15'}],
   deletedInstallmentOrigins:ym==='2026-12'?['old-origin:3']:[],
   auditNote:'synthetic-only'
  };
 }
 return {selectedMonth:'2026-12',months};
}
function fingerprint(s){
 const out={};
 for(const [ym,m] of Object.entries(s.months)){
  out[ym]={
   expenseIds:m.expenses.map(x=>x.id),
   cardIds:m.cardExpenses.map(x=>x.id),
   incomeIds:(m.extraIncomes||[]).map(x=>x.id),
   fixed:m.expenses.filter(x=>x.type==='fixed').map(x=>[x.id,x.amount,x.paid]),
   investments:m.expenses.filter(x=>x.category==='investimentos').map(x=>[x.id,x.amount]),
   installments:m.cardExpenses.filter(x=>x.isInstallment).map(x=>[x.id,x.installmentOriginId,x.currentInstallment,x.installments,x.installmentValue]),
   deleted:clone(m.deletedInstallmentOrigins||[]),
   closed:m.closed,closedAt:m.closedAt,budgetLimit:m.budgetLimit,
   salary:m.salary,extraTotal:sum(m.extraIncomes,'amount'),
   expenseTotal:sum(m.expenses,'amount'),cardTotal:sum(m.cardExpenses,'installmentValue')
  };
 }
 return out;
}
function auditRoundTrip(snapshot){
 const original=clone(snapshot),before=fingerprint(original),balanceBefore=balances(original);
 const plan=migrate(original),session=createSession(original);
 verify(plan);
 const applied=session.apply(plan,0);
 assert.deepStrictEqual(fingerprint(session.read()),before);
 assert.deepStrictEqual(balances(session.read()),balanceBefore);
 const rolledBack=session.rollback(plan,1);
 assert.deepStrictEqual(session.read(),original);
 assert.deepStrictEqual(snapshot,original);
 return {applied,rolledBack,months:Object.keys(original.months).length,
  before,balances:balanceBefore,issues:inspectLegacy(original).issues};
}
module.exports={syntheticHistory,fingerprint,auditRoundTrip};
