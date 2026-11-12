'use strict';
const assert=require('node:assert/strict');
const {toQueue,fromQueue,enqueue}=require('../js/services/financeQueueAdapterLab.js');
const {createQueue,LAB_KEY}=require('../js/services/operationQueueLab.js');
const {normalizeSnapshot}=require('../js/services/preMigrationLab.js');
const {encode,decode}=require('../js/services/financeConverterLab.js');
const samples=[
  ['expenses',{id:'exp_1',title:'Energia',amount:152.35,category:'Casa',paid:true,
    fixed:true,notes:'valor historico',extra:{origin:'manual'}}],
  ['cardExpenses',{id:'card_1',title:'Notebook',amount:1999.98,
    installmentValue:333.33,installments:6,currentInstallment:2,
    installmentOriginId:'orig_1',category:'Tecnologia',paid:false}],
  ['extraIncomes',{id:'extra_1',description:'Freelance',amount:420.45,
    category:'Trabalho',source:'externa'}]
];
let passed=0;
function test(name,fn){fn();passed++;console.log('APROVADO:',name);}
function roundtrip(type,record){
  const v=toQueue('2026-11',type,record);
  assert.deepStrictEqual(fromQueue(v.month,v.type,v.id,v.data),
    {ym:'2026-11',collection:type,record});
  return v;
}
test('despesa preserva todos os campos e centavos',()=>{
  const v=roundtrip(...samples[0]);assert.equal(v.data.amountCents,15235);
});
test('cartao preserva total e parcela sem arredondamento',()=>{
  const v=roundtrip(...samples[1]);assert.equal(v.data.amountCents,33333);
  assert.equal(v.data.financeRecord.amount,1999.98);
});
test('receita extra sem titulo e preservada',()=>{
  const v=roundtrip(...samples[2]);assert.equal(v.data.amountCents,42045);
});
test('categorias, flags e campos extras sobrevivem',()=>{
  for(const [type,record] of samples) assert.deepStrictEqual(roundtrip(type,record).data.financeRecord,record);
});
test('o adaptador nao altera o objeto original',()=>{
  const r=structuredClone(samples[0][1]);const v=toQueue('2026-11','expenses',r);
  v.data.financeRecord.category='ALTERADA';
  assert.deepStrictEqual(r,samples[0][1]);
});
test('valores com mais de duas casas sao rejeitados',()=>{
  assert.throws(()=>toQueue('2026-11','expenses',{id:'x',amount:1.234}),/duas casas/);
});
test('valores negativos sao rejeitados sem perda silenciosa',()=>{
  assert.throws(()=>toQueue('2026-11','expenses',{id:'x',amount:-1}),/invalido/);
});
test('valores acima do limite da fila sao rejeitados',()=>{
  assert.throws(()=>toQueue('2026-11','expenses',{id:'x',amount:10000000}),/limite/);
});
test('IDs nao aceitos pela fila exigem mapeamento explicito',()=>{
  assert.throws(()=>toQueue('2026-11','expenses',{id:'abc.def',amount:1}),/ID incompat/);
});
test('colecao e mes invalidos sao rejeitados',()=>{
  assert.throws(()=>toQueue('2026-13','expenses',samples[0][1]),/Identidade/);
  assert.throws(()=>toQueue('2026-11','investments',samples[0][1]),/Identidade/);
});
test('alteracao de valor de transporte e detectada',()=>{
  const v=roundtrip(...samples[0]);v.data.amountCents++;
  assert.throws(()=>fromQueue(v.month,v.type,v.id,v.data),/divergente/);
});
test('troca de tipo e identidade e detectada',()=>{
  const v=roundtrip(...samples[1]);
  assert.throws(()=>fromQueue(v.month,'expense',v.id,v.data),/incompativel/);
  assert.throws(()=>fromQueue(v.month,v.type,'outro',v.data),/incompativel/);
});
test('fila recebe e devolve payload financeiro integral',()=>{
  const data=new Map();
  const storage={getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,String(v))};
  let n=0;const q=createQueue(storage,{idFactory:()=> 'op_'+(++n)});
  for(const [type,record] of samples) enqueue(q,'2026-11',type,record);
  assert.equal(q.pending().length,3);
  for(const op of q.pending()){
    const restored=fromQueue(op.month,op.type,op.id,op.payload);
    assert.deepStrictEqual(restored.record,samples.find(x=>x[0]===restored.collection)[1]);
  }
  assert.deepStrictEqual([...data.keys()],[LAB_KEY]);
});
test('conversor e pre-migracao compativeis com adaptador',()=>{
  const source={selectedMonth:'2026-11',months:{'2026-11':{
    salary:5000,expenses:[samples[0][1]],cardExpenses:[samples[1][1]],
    extraIncomes:[samples[2][1]]}}};
  const plan=normalizeSnapshot(source,'adapter');
  assert.deepStrictEqual(decode(encode(plan.snapshot)),plan.snapshot);
  for(const item of plan.envelope.records){
    const v=roundtrip(item.type,item.value);
    assert.equal(v.data.financeId,item.id);
  }
});
test('snapshot financeiro permanece intacto',()=>{
  const original=structuredClone(samples);
  for(const [type,record] of samples) roundtrip(type,record);
  assert.deepStrictEqual(samples,original);
});
console.log('RESULTADO: '+passed+'/15 TESTES APROVADOS');
