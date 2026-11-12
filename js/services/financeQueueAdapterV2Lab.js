'use strict';
/* Laboratorio Node-only: contrato reversivel v2. Sem acesso a storage/rede.
 * amountCents da fila e indice compatível; valor financeiro assinado permanece
 * integral em financeRecord. Nunca usar indice como valor contabil.
 */
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const TYPES=Object.freeze({expenses:'expense',cardExpenses:'cardExpense',extraIncomes:'extraIncome'});
const BACK=Object.freeze({expense:'expenses',cardExpense:'cardExpenses',extraIncome:'extraIncomes'});
const YM=/^\d{4}-(0[1-9]|1[0-2])$/;
const QID=/^[a-zA-Z0-9_-]{1,128}$/;
const MAX=999999999;
function clone(v){
  const raw=JSON.stringify(v);
  if(raw===undefined) throw Error('Registro nao serializavel.');
  const result=JSON.parse(raw);
  if(JSON.stringify(result)!==raw) throw Error('Registro JSON inconsistente.');
  return result;
}
function hash(v){return crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');}
function identity(ym,collection,id){
  if(!YM.test(ym)||!Object.hasOwn(TYPES,collection)||typeof id!=='string'||!id.trim())
    throw Error('Identidade financeira invalida.');
}
function queueId(ym,collection,id){
  identity(ym,collection,id);
  // Identidade sempre derivada da tupla completa: nao depende de ordem ou dispositivo.
  return 'fq_'+hash([ym,collection,id]);
}
function money(v){
  if(typeof v!=='number'||!Number.isFinite(v)) throw Error('Valor financeiro nao finito.');
  const scaled=v*100;
  const rounded=Math.round(scaled);
  if(!Number.isSafeInteger(rounded)||Math.abs(scaled-rounded)>1e-7)
    throw Error('Precisao monetaria acima de dois decimais.');
  // Normaliza -0 para 0; preserva valor original no registro.
  return rounded===0?0:rounded;
}
function fieldFor(collection,record){
  if(collection==='cardExpenses'&&Object.hasOwn(record,'installmentValue'))
    return 'installmentValue';
  return Object.hasOwn(record,'amount')?'amount':null;
}
function toQueue(ym,collection,record){
  if(!record||typeof record!=='object'||Array.isArray(record)) throw Error('Registro invalido.');
  identity(ym,collection,record.id);
  const original=clone(record);
  const field=fieldFor(collection,original);
  const signedCents=field===null?null:money(original[field]);
  // Fila v1 só admite inteiros positivos até MAX. Usar sentinela 0
  // quando negativo ou acima do teto; dados integrais ficam no envelope.
  const indexCents=signedCents===null||signedCents<0||signedCents>MAX?0:signedCents;
  const id=queueId(ym,collection,original.id);
  const title=typeof original.title==='string'&&original.title.trim()
    ?original.title.slice(0,120):'Lancamento financeiro '+id.slice(0,24);
  const data={
    title,amountCents:indexCents,financeSchema:2,financeCollection:collection,
    financeMonth:ym,financeId:original.id,financeQueueId:id,
    financeMoneyField:field,financeSignedCents:signedCents,
    financeRecord:original,financeDigest:hash([ym,collection,original.id,original])
  };
  return {month:ym,type:TYPES[collection],id,data};
}
function fromQueue(month,type,id,data){
  if(!YM.test(month)||!Object.hasOwn(BACK,type)||!data||data.financeSchema!==2||
    data.financeMonth!==month||data.financeCollection!==BACK[type]||
    data.financeQueueId!==id||typeof data.financeId!=='string'||
    id!==queueId(month,BACK[type],data.financeId)||
    typeof data.title!=='string'||!data.title.trim()||data.title.length>120||
    !Number.isSafeInteger(data.amountCents)||data.amountCents<0||data.amountCents>MAX)
    throw Error('Envelope v2 incompativel.');
  const record=clone(data.financeRecord);
  if(!record||typeof record!=='object'||Array.isArray(record)||record.id!==data.financeId)
    throw Error('Registro original divergente.');
  const field=fieldFor(BACK[type],record);
  const signed=field===null?null:money(record[field]);
  const index=signed===null||signed<0||signed>MAX?0:signed;
  if(field!==data.financeMoneyField||signed!==data.financeSignedCents||
    index!==data.amountCents||
    data.financeDigest!==hash([month,BACK[type],record.id,record]))
    throw Error('Integridade financeira divergente.');
  return {ym:month,collection:BACK[type],record};
}
function enqueue(queue,ym,collection,record){
  const v=toQueue(ym,collection,record);
  return queue.create(v.month,v.type,v.id,v.data);
}
function auditSnapshot(snapshot){
  if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot)||
    !snapshot.months||typeof snapshot.months!=='object'||Array.isArray(snapshot.months)||
    !YM.test(snapshot.selectedMonth)||!Object.hasOwn(snapshot.months,snapshot.selectedMonth))
    throw Error('Estrutura mensal invalida para auditoria.');
  const results=[],errors=[];
  for(const [ym,month] of Object.entries(snapshot.months)){
    if(!YM.test(ym)||!month||typeof month!=='object'||Array.isArray(month))
      throw Error('Mes invalido para auditoria: '+ym);
    for(const collection of Object.keys(TYPES)){
      if(month[collection]!==undefined&&!Array.isArray(month[collection]))
        throw Error('Colecao invalida para auditoria: '+ym+'/'+collection);
      for(const [index,record] of (month[collection]||[]).entries()){
        try{
          const q=toQueue(ym,collection,record);
          assert.deepStrictEqual(fromQueue(q.month,q.type,q.id,q.data).record,record);
          results.push({ym,collection,index,id:record.id,queueId:q.id});
        }catch(e){errors.push({ym,collection,index,id:record.id,reason:String(e.message)});}
      }
    }
  }
  const ids=new Set(results.map(r=>r.queueId));
  if(ids.size!==results.length) errors.push({reason:'Colisao de identificador de fila.'});
  return {total:results.length+errors.filter(e=>e.index!==undefined).length,
    compatible:results.length,errors,ok:errors.length===0};
}
module.exports={toQueue,fromQueue,enqueue,queueId,auditSnapshot,money};
