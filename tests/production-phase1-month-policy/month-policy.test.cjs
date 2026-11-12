'use strict';
const assert=require('node:assert/strict');
const {propose,compareModes,previous}=require('../../js/services/deterministicMonthPolicyLab.js');
const {balances}=require('../../js/services/reversibleFinanceMigrationLab.js');
function base(){return {selectedMonth:'2026-10',months:{'2026-10':{
 salary:4000,budgetLimit:5000,expenses:[
 {id:'rent',title:'Aluguel',type:'fixed',category:'moradia',amount:800,date:'2026-10-01',paid:true},
 {id:'invest',title:'FII',type:'one-time',category:'investimentos',amount:300,date:'2026-10-02',paid:true}],
 cardExpenses:[{id:'card1',title:'Notebook',isInstallment:true,installmentOriginId:'origin',installments:3,currentInstallment:1,installmentValue:100,totalAmount:300,date:'2026-10-03',paid:true}],
 extraIncomes:[{id:'extra',description:'Freelance',amount:150}],deletedInstallmentOrigins:[]}}};}
function existing(){const s=base();s.months['2026-11']={
 salary:4200,budgetLimit:5000,expenses:[
 {id:'rent-new',title:'Aluguel',type:'fixed',category:'moradia',amount:900,date:'2026-11-02',paid:false},
 {id:'invest-new',title:'FII',type:'one-time',category:'investimentos',amount:300,date:'2026-11-03',paid:true}],
 cardExpenses:[{id:'card-new',title:'Notebook',isInstallment:true,installmentOriginId:'origin',installments:3,currentInstallment:2,installmentValue:100,totalAmount:300,date:'2026-11-03',paid:false}],
 extraIncomes:[{id:'extra-new',amount:50}],deletedInstallmentOrigins:[]};return s;}
const target=s=>propose(s,'2026-11').proposed.months['2026-11'];
const reject=(fn,code)=>assert.throws(fn,e=>e.code===code);
let passed=0;const test=(name,fn)=>{fn();passed++;console.log('APROVADO:',name);};
test("mes anterior normal",()=>{assert.equal(previous('2026-11'),'2026-10');});
test("virada do ano",()=>{assert.equal(previous('2027-01'),'2026-12');});
test("mes invalido",()=>{reject(()=>previous('2026-13'),'invalid_month');});
test("modos equivalentes criacao",()=>{assert.equal(compareModes(base(),'2026-11').equivalent,true);});
test("modos equivalentes sincronizacao",()=>{assert.equal(compareModes(existing(),'2026-11').equivalent,true);});
test("cria mes ausente",()=>{assert.equal(propose(base(),'2026-11').status,'READY_IN_LAB');});
test("herda salario",()=>{assert.equal(target(base()).salary,4000);});
test("herda orcamento",()=>{assert.equal(target(base()).budgetLimit,5000);});
test("herda fixo",()=>{assert.equal(target(base()).expenses.length,1);});
test("herda parcela",()=>{assert.equal(target(base()).cardExpenses.length,1);});
test("avanca parcela",()=>{assert.equal(target(base()).cardExpenses[0].currentInstallment,2);});
test("preserva origem",()=>{assert.equal(target(base()).cardExpenses[0].installmentOriginId,'origin');});
test("reinicia pagamento fixo",()=>{assert.equal(target(base()).expenses[0].paid,false);});
test("reinicia pagamento parcela",()=>{assert.equal(target(base()).cardExpenses[0].paid,false);});
test("nao herda investimento",()=>{assert.equal(target(base()).expenses.some(x=>x.category==='investimentos'),false);});
test("nao herda extra",()=>{assert.equal(target(base()).extraIncomes.length,0);});
test("nao altera origem",()=>{const s=base(),b=JSON.stringify(s);propose(s,'2026-11');assert.equal(JSON.stringify(s),b);});
test("ids deterministicas",()=>{assert.deepEqual(target(base()),target(base()));});
test("ids novas",()=>{assert.notEqual(target(base()).expenses[0].id,'rent');});
test("mes criado inicialmente aberto",()=>{assert.equal(target(base()).closed,false);});
test("data fixo no destino",()=>{assert.equal(target(base()).expenses[0].date,'2026-11-01');});
test("data parcela no destino",()=>{assert.equal(target(base()).cardExpenses[0].date,'2026-11-01');});
test("mes existente nao duplica fixo",()=>{assert.equal(propose(existing(),'2026-11').proposed.months['2026-11'].expenses.length,2);});
test("mes existente nao duplica parcela",()=>{assert.equal(propose(existing(),'2026-11').proposed.months['2026-11'].cardExpenses.length,1);});
test("preserva fixo editado",()=>{assert.equal(propose(existing(),'2026-11').proposed.months['2026-11'].expenses[0].amount,900);});
test("preserva investimento existente",()=>{assert.equal(propose(existing(),'2026-11').proposed.months['2026-11'].expenses[1].amount,300);});
test("preserva salario existente",()=>{assert.equal(propose(existing(),'2026-11').proposed.months['2026-11'].salary,4200);});
test("idempotencia",()=>{const s=propose(base(),'2026-11').proposed;assert.equal(propose(s,'2026-11').changed,false);});
test("marcador futuro bloqueia parcela",()=>{const s=base();assert.equal(propose(s,'2026-11',{futureDeletions:{'2026-11':['origin:2']}}).proposed.months['2026-11'].cardExpenses.length,0);});
test("marcador futuro preservado",()=>{assert.deepEqual(propose(base(),'2026-11',{futureDeletions:{'2026-11':['origin:2']}}).proposed.months['2026-11'].deletedInstallmentOrigins,['origin:2']);});
test("marcador destino bloqueia",()=>{const s=existing();s.months['2026-11'].cardExpenses=[];s.months['2026-11'].deletedInstallmentOrigins=['origin:2'];assert.equal(propose(s,'2026-11').proposed.months['2026-11'].cardExpenses.length,0);});
test("parcela concluida nao avanca",()=>{const s=base();s.months['2026-10'].cardExpenses[0].currentInstallment=3;assert.equal(target(s).cardExpenses.length,0);});
test("legado sem origem exige revisao",()=>{const s=base();delete s.months['2026-10'].cardExpenses[0].installmentOriginId;assert.equal(propose(s,'2026-11').status,'MANUAL_REVIEW_REQUIRED');});
test("legado nao propaga automaticamente",()=>{const s=base();delete s.months['2026-10'].cardExpenses[0].installmentOriginId;assert.equal(propose(s,'2026-11').proposed,null);});
test("origem duplicada exige revisao",()=>{const s=base();s.months['2026-10'].cardExpenses.push({...s.months['2026-10'].cardExpenses[0],id:'card2'});assert.equal(propose(s,'2026-11').status,'MANUAL_REVIEW_REQUIRED');});
test("destino ambiguo exige revisao",()=>{const s=existing();delete s.months['2026-11'].cardExpenses[0].installmentOriginId;assert.equal(propose(s,'2026-11').status,'MANUAL_REVIEW_REQUIRED');});
test("mes fechado bloqueia",()=>{const s=existing();s.months['2026-11'].closed=true;reject(()=>propose(s,'2026-11'),'closed_month_requires_review');});
test("origem inexistente bloqueia",()=>{reject(()=>propose(base(),'2026-12'),'missing_previous_month');});
test("modo invalido bloqueia",()=>{reject(()=>propose(base(),'2026-11',{mode:'other'}),'invalid_mode');});
test("exclusao futura invalida bloqueia",()=>{reject(()=>propose(base(),'2026-11',{futureDeletions:{'2026-11':['invalid']}}),'invalid_markers');});
test("exclusao futura em mes existente bloqueia",()=>{reject(()=>propose(existing(),'2026-11',{futureDeletions:{'2026-11':['origin:2']}}),'invalid_future_month');});
test("fixos homonimos exigem revisao",()=>{const s=base();s.months['2026-10'].expenses.push({...s.months['2026-10'].expenses[0],id:'rent2'});assert.equal(propose(s,'2026-11').status,'MANUAL_REVIEW_REQUIRED');});
test("mes existente preserva extra",()=>{const s=existing();assert.equal(propose(s,'2026-11').proposed.months['2026-11'].extraIncomes.length,1);});
test("modos equivalentes com exclusao",()=>{assert.equal(compareModes(base(),'2026-11',{futureDeletions:{'2026-11':['origin:2']}}).equivalent,true);});
test("modos equivalentes com legado",()=>{const s=base();delete s.months['2026-10'].cardExpenses[0].installmentOriginId;assert.equal(compareModes(s,'2026-11').status,'MANUAL_REVIEW_REQUIRED');});
test("cria fixo ausente no existente",()=>{const s=existing();s.months['2026-11'].expenses=s.months['2026-11'].expenses.filter(x=>x.type!=='fixed');assert.equal(propose(s,'2026-11').proposed.months['2026-11'].expenses.filter(x=>x.type==='fixed').length,1);});
test("cria parcela ausente no existente",()=>{const s=existing();s.months['2026-11'].cardExpenses=[];assert.equal(propose(s,'2026-11').proposed.months['2026-11'].cardExpenses.length,1);});
test("saldo fonte preservado",()=>{const s=base(),b=balances(s)['2026-10'];assert.equal(balances(propose(s,'2026-11').proposed)['2026-10'],b);});
console.log('RESULTADO: '+passed+'/48 TESTES APROVADOS');
