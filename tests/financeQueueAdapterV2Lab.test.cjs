'use strict';
const assert=require('node:assert/strict');
const {toQueue,fromQueue,enqueue,queueId,auditSnapshot,money}=
  require('../js/services/financeQueueAdapterV2Lab.js');
const {createQueue,LAB_KEY}=require('../js/services/operationQueueLab.js');
const {normalizeSnapshot}=require('../js/services/preMigrationLab.js');
let count=0;
function test(name,fn){fn();count++;console.log('APROVADO:',name);}
const cases=[
 ['expenses',{id:'legado.com/ponto',title:'Estorno',amount:-45.67,category:'Casa',paid:true}],
 ['cardExpenses',{id:'cartao:2026/11',title:'Notebook',installmentValue:333.33,
   totalAmount:1999.98,installments:6,currentInstallment:2,
   installmentOriginId:'origem/1',category:'Tecnologia',paid:false}],
 ['extraIncomes',{id:'extra id com espaço',description:'Ajuste',amount:15000000.99,source:'externa'}],
 ['expenses',{id:'sem_valor',title:'Lancamento sem valor',category:'Outros'}]
];
function round(collection,record){
 const q=toQueue('2026-11',collection,record);
 assert.deepStrictEqual(fromQueue(q.month,q.type,q.id,q.data),
   {ym:'2026-11',collection,record});
 return q;
}
test('ID legado com pontuacao preservado',()=>{const q=round(...cases[0]);assert.match(q.id,/^fq_[a-f0-9]{64}$/);});
test('ID legado de cartao e parcela preservados',()=>round(...cases[1]));
test('ID com espacos preservado sem mudar origem',()=>round(...cases[2]));
test('IDs de fila sao deterministas',()=>assert.equal(
 queueId('2026-11','expenses','x/y'),queueId('2026-11','expenses','x/y')));
test('mes e colecao compoem identidade distinta',()=>{
 assert.notEqual(queueId('2026-11','expenses','x'),queueId('2026-10','expenses','x'));
 assert.notEqual(queueId('2026-11','expenses','x'),queueId('2026-11','cardExpenses','x'));
});
test('estorno negativo preservado sem valor negativo na fila',()=>{
 const q=round(...cases[0]);assert.equal(q.data.amountCents,0);
 assert.equal(q.data.financeSignedCents,-4567);
});
test('valor acima do teto preservado em registro original',()=>{
 const q=round(...cases[2]);assert.equal(q.data.amountCents,0);
 assert.equal(q.data.financeSignedCents,1500000099);
});
test('valor de parcela normal preservado em centavos',()=>{
 const q=round(...cases[1]);assert.equal(q.data.amountCents,33333);
});
test('registro sem campo monetario permanece intacto',()=>{
 const q=round(...cases[3]);assert.equal(q.data.financeMoneyField,null);
});
test('centavos exatos em valor decimal',()=>assert.equal(money(0.29),29));
test('mais de duas casas decimais sao bloqueadas',()=>
 assert.throws(()=>round('expenses',{id:'x',amount:1.234}),/Precisao/));
test('NaN e infinito sao bloqueados',()=>{
 assert.throws(()=>round('expenses',{id:'x',amount:Infinity}),/nao finito/);
 assert.throws(()=>round('expenses',{id:'x',amount:NaN}),/nao finito/);
});
test('valores acima do inteiro seguro sao bloqueados',()=>
 assert.throws(()=>round('expenses',{id:'x',amount:1e15}),/Precisao/));
test('adulteracao de estorno e detectada',()=>{
 const q=round(...cases[0]);q.data.financeSignedCents=0;
 assert.throws(()=>fromQueue(q.month,q.type,q.id,q.data),/divergente/);
});
test('adulteracao de registro financeiro e detectada',()=>{
 const q=round(...cases[1]);q.data.financeRecord.category='Outra';
 assert.throws(()=>fromQueue(q.month,q.type,q.id,q.data),/divergente/);
});
test('adulteracao de indice de transporte e detectada',()=>{
 const q=round(...cases[1]);q.data.amountCents++;
 assert.throws(()=>fromQueue(q.month,q.type,q.id,q.data),/divergente/);
});
test('identidade trocada e detectada',()=>{
 const q=round(...cases[0]);
 assert.throws(()=>fromQueue(q.month,q.type,'outro',q.data),/incompativel/);
});
test('fila v1 recebe os envelopes v2 sem alterar contrato legado',()=>{
 const values=new Map();const storage={
  getItem:k=>values.has(k)?values.get(k):null,
  setItem:(k,v)=>values.set(k,String(v))};
 let n=0;const q=createQueue(storage,{idFactory:()=> 'op_'+(++n)});
 for(const [c,r] of cases) enqueue(q,'2026-11',c,r);
 assert.equal(q.pending().length,4);
 for(const op of q.pending()) fromQueue(op.month,op.type,op.id,op.payload);
 assert.deepStrictEqual([...values.keys()],[LAB_KEY]);
});
test('auditoria de formatos preserva categorias e parcelas',()=>{
 const snapshot={selectedMonth:'2026-11',months:{'2026-11':{
  salary:5000,expenses:[cases[0][1],cases[3][1]],
  cardExpenses:[cases[1][1]],extraIncomes:[cases[2][1]]}}};
 const audit=auditSnapshot(snapshot);
 assert.equal(audit.total,4);assert.equal(audit.compatible,4);
 assert.equal(audit.ok,true);
});
test('auditoria sinaliza formato monetario incompativel',()=>{
 const snapshot={selectedMonth:'2026-11',months:{'2026-11':{
  expenses:[{id:'x',amount:1.234}],cardExpenses:[],extraIncomes:[]}}};
 const audit=auditSnapshot(snapshot);
 assert.equal(audit.ok,false);assert.equal(audit.errors.length,1);
});
test('normalizacao de IDs ausentes pode ser auditada sem alterar fonte',()=>{
 const snapshot={selectedMonth:'2026-11',months:{'2026-11':{
  expenses:[{title:'Sem id',amount:10}],cardExpenses:[],extraIncomes:[]}}};
 const original=structuredClone(snapshot);
 const plan=normalizeSnapshot(snapshot,'v2-lab');
 assert.equal(auditSnapshot(plan.snapshot).ok,true);
 assert.deepStrictEqual(snapshot,original);
});
test('originais permanecem intactos apos conversao',()=>{
 const before=structuredClone(cases);
 for(const [c,r] of cases) round(c,r);
 assert.deepStrictEqual(cases,before);
});
console.log('RESULTADO: '+count+'/22 TESTES APROVADOS');
