'use strict';
// Executa funcoes REAIS do app em vm isolada, sem browser, storage ou rede.
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {balances}=require('../../js/services/reversibleFinanceMigrationLab.js');
const root=path.resolve(__dirname,'../..');
const state=fs.readFileSync(path.join(root,'js/state.js'),'utf8');
const storage=fs.readFileSync(path.join(root,'js/services/storageService.js'),'utf8');
let passed=0;
function test(label,fn){fn();passed++;console.log('APROVADO:',label);}
function extract(src,name,next){
 const start=src.indexOf('function '+name+'(');
 if(start<0)throw Error('Funcao real nao encontrada: '+name);
 const brace=src.indexOf('{',start);let depth=0,end=-1;
 for(let i=brace;i<src.length;i++){
  if(src[i]==='{')depth++;
  if(src[i]==='}'&&!--depth){end=i+1;break;}
 }
 if(end<0)throw Error('Funcao incompleta: '+name);
 return src.slice(start,end);
}
function harness(snapshot){
 const db=JSON.parse(JSON.stringify(snapshot)),ctx={
  db,console:{log(){},error(){}},Date,Math,Number,String,Object,Array,Set,
  document:{getElementById(){return null;}},setTimeout(){},
  showToast(){},renderAll(){},saveDatabase(){},formatMonthYear(x){return x;},
  inferCategoryFromTitle(){return 'outros';},getTodayYM(){return '2026-11';}
 };
 vm.createContext(ctx);
 const script=[
  extract(state,'getPreviousMonthYM'),
  extract(state,'calculateMonthNetBalance'),
  extract(storage,'ensureMonthExists'),
  extract(storage,'syncFromPreviousMonth'),
  'function getCurrentMonthData(){return db.months[db.selectedMonth];}',
  'var appDb=db;'
 ].join('\n');
 vm.runInContext(script,ctx,{timeout:1500});
 return {db,ctx,run:(expression)=>vm.runInContext(expression,ctx,{timeout:1500})};
}
function base(){
 return {selectedMonth:'2026-11',months:{
 '2026-10':{salary:4000,budgetLimit:5000,extraIncomes:[{id:'i',amount:100}],
 expenses:[{id:'fixed-old',title:'Aluguel',type:'fixed',category:'moradia',amount:800,paid:true},
 {id:'invest-old',title:'FII',type:'one-time',category:'investimentos',amount:300}],
 cardExpenses:[{id:'card-old',title:'Notebook',isInstallment:true,installments:3,currentInstallment:1,installmentValue:200,installmentOriginId:'orig',paid:true}],
 deletedInstallmentOrigins:[]},
 '2026-11':{salary:4200,budgetLimit:5000,extraIncomes:[{id:'i2',amount:150}],
 expenses:[{id:'fixed-new',title:'Aluguel',type:'fixed',category:'moradia',amount:850,paid:false},
 {id:'invest-new',title:'FII',type:'one-time',category:'investimentos',amount:350}],
 cardExpenses:[{id:'card-new',title:'Notebook',isInstallment:true,installments:3,currentInstallment:2,installmentValue:200,installmentOriginId:'orig',paid:false}],
 deletedInstallmentOrigins:[]}
 }};
}
const json=x=>JSON.parse(JSON.stringify(x));
test('funcoes reais encontradas',()=>assert.ok(extract(storage,'ensureMonthExists').includes('inheritedFixedExpenses')));
test('formula real encontra mes ausente',()=>assert.equal(harness(base()).run("calculateMonthNetBalance('2026-09')"),0));
test('saldo outubro coincide com modelo',()=>{const h=harness(base());assert.equal(h.run("calculateMonthNetBalance('2026-10')"),balances(h.db)['2026-10']);});
test('saldo novembro coincide com modelo',()=>{const h=harness(base());assert.equal(h.run("calculateMonthNetBalance('2026-11')"),balances(h.db)['2026-11']);});
test('saldo inclui aporte como despesa',()=>{const h=harness(base()),before=h.run("calculateMonthNetBalance('2026-11')");h.db.months['2026-11'].expenses[1].amount+=100;assert.equal(h.run("calculateMonthNetBalance('2026-11')"),before-100);});
test('saldo inclui renda extra',()=>{const h=harness(base()),before=h.run("calculateMonthNetBalance('2026-11')");h.db.months['2026-11'].extraIncomes[0].amount+=50;assert.equal(h.run("calculateMonthNetBalance('2026-11')"),before+50);});
test('saldo inclui parcela cartao',()=>{const h=harness(base()),before=h.run("calculateMonthNetBalance('2026-11')");h.db.months['2026-11'].cardExpenses[0].installmentValue+=50;assert.equal(h.run("calculateMonthNetBalance('2026-11')"),before-50);});
test('mes anterior calculado corretamente',()=>assert.equal(harness(base()).run("getPreviousMonthYM('2026-01')"),'2025-12'));
test('edicao de fixo existente nao sobrescrita em sincronizacao',()=>{const h=harness(base());h.run('syncFromPreviousMonth(false)');assert.equal(h.db.months['2026-11'].expenses[0].amount,850);});
test('sincronizacao nao duplica fixo existente',()=>{const h=harness(base());h.run('syncFromPreviousMonth(false)');assert.equal(h.db.months['2026-11'].expenses.filter(x=>x.type==='fixed').length,1);});
test('sincronizacao nao duplica parcela existente',()=>{const h=harness(base());h.run('syncFromPreviousMonth(false)');assert.equal(h.db.months['2026-11'].cardExpenses.length,1);});
test('sincronizacao nao altera investimento existente',()=>{const h=harness(base());h.run('syncFromPreviousMonth(false)');assert.equal(h.db.months['2026-11'].expenses[1].amount,350);});
test('sincronizacao respeita exclusao de parcela',()=>{const s=base();s.months['2026-11'].cardExpenses=[];s.months['2026-11'].deletedInstallmentOrigins=['orig:2'];const h=harness(s);h.run('syncFromPreviousMonth(false)');assert.equal(h.db.months['2026-11'].cardExpenses.length,0);});
test('sincronizacao adiciona parcela nao excluida',()=>{const s=base();s.months['2026-11'].cardExpenses=[];const h=harness(s);h.run('syncFromPreviousMonth(false)');assert.equal(h.db.months['2026-11'].cardExpenses[0].currentInstallment,2);});
test('sincronizacao usa nova ID',()=>{const s=base();s.months['2026-11'].cardExpenses=[];const h=harness(s);h.run('syncFromPreviousMonth(false)');assert.notEqual(h.db.months['2026-11'].cardExpenses[0].id,'card-old');});
test('sincronizacao preserva origem',()=>{const s=base();s.months['2026-11'].cardExpenses=[];const h=harness(s);h.run('syncFromPreviousMonth(false)');assert.equal(h.db.months['2026-11'].cardExpenses[0].installmentOriginId,'orig');});
test('sincronizacao nao duplica em segunda execucao',()=>{const s=base();s.months['2026-11'].cardExpenses=[];const h=harness(s);h.run('syncFromPreviousMonth(false)');h.run('syncFromPreviousMonth(false)');assert.equal(h.db.months['2026-11'].cardExpenses.length,1);});
test('criacao herda salario',()=>{const s=base();delete s.months['2026-11'];const h=harness(s);h.run("ensureMonthExists('2026-11')");assert.equal(h.db.months['2026-11'].salary,4000);});
test('criacao herda orcamento',()=>{const s=base();delete s.months['2026-11'];const h=harness(s);h.run("ensureMonthExists('2026-11')");assert.equal(h.db.months['2026-11'].budgetLimit,5000);});
test('criacao herda apenas fixos',()=>{const s=base();delete s.months['2026-11'];const h=harness(s);h.run("ensureMonthExists('2026-11')");assert.equal(h.db.months['2026-11'].expenses.length,1);});
test('criacao gera nova ID fixa',()=>{const s=base();delete s.months['2026-11'];const h=harness(s);h.run("ensureMonthExists('2026-11')");assert.notEqual(h.db.months['2026-11'].expenses[0].id,'fixed-old');});
test('criacao reinicia status pago',()=>{const s=base();delete s.months['2026-11'];const h=harness(s);h.run("ensureMonthExists('2026-11')");assert.equal(h.db.months['2026-11'].expenses[0].paid,false);});
test('criacao avanca parcela',()=>{const s=base();delete s.months['2026-11'];const h=harness(s);h.run("ensureMonthExists('2026-11')");assert.equal(h.db.months['2026-11'].cardExpenses[0].currentInstallment,2);});
test('criacao preserva origem da parcela',()=>{const s=base();delete s.months['2026-11'];const h=harness(s);h.run("ensureMonthExists('2026-11')");assert.equal(h.db.months['2026-11'].cardExpenses[0].installmentOriginId,'orig');});
test('criacao nao duplica ao repetir',()=>{const s=base();delete s.months['2026-11'];const h=harness(s);h.run("ensureMonthExists('2026-11')");h.run("ensureMonthExists('2026-11')");assert.equal(h.db.months['2026-11'].cardExpenses.length,1);});
test('criacao nao replica investimento',()=>{const s=base();delete s.months['2026-11'];const h=harness(s);h.run("ensureMonthExists('2026-11')");assert.equal(h.db.months['2026-11'].expenses.some(x=>x.category==='investimentos'),false);});
test('criacao zera renda extra',()=>{const s=base();delete s.months['2026-11'];const h=harness(s);h.run("ensureMonthExists('2026-11')");assert.equal(h.db.months['2026-11'].extraIncomes.length,0);});
test('criacao inicializa exclusoes vazias',()=>{const s=base();delete s.months['2026-11'];const h=harness(s);h.run("ensureMonthExists('2026-11')");assert.equal(h.db.months['2026-11'].deletedInstallmentOrigins.length,0);});
test('criacao nao reabre mes existente',()=>{const h=harness(base());h.db.months['2026-11'].closed=true;h.run("ensureMonthExists('2026-11')");assert.equal(h.db.months['2026-11'].closed,true);});
test('criacao nao avanca parcela concluida',()=>{const s=base();delete s.months['2026-11'];s.months['2026-10'].cardExpenses[0].currentInstallment=3;const h=harness(s);h.run("ensureMonthExists('2026-11')");assert.equal(h.db.months['2026-11'].cardExpenses.length,0);});
test('criacao preserva mes anterior',()=>{const s=base();delete s.months['2026-11'];const previous=json(s.months['2026-10']);const h=harness(s);h.run("ensureMonthExists('2026-11')");assert.deepEqual(h.db.months['2026-10'],previous);});
test('criacao registra divergencia conhecida de exclusao',()=>{const s=base();delete s.months['2026-11'];s.months['2026-10'].deletedInstallmentOrigins=['orig:2'];const h=harness(s);h.run("ensureMonthExists('2026-11')");assert.equal(h.db.months['2026-11'].cardExpenses.length,1);});
test('modelo de migracao nao altera saldos de origem',()=>{const s=base();const h=harness(s);assert.deepEqual(balances(s),balances(h.db));});
console.log('RESULTADO: '+passed+'/33 TESTES APROVADOS');
