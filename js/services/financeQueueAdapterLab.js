/* Raytech CG: adaptador experimental, isolado, sem acesso a storage ou rede.
 * O campo amountCents da fila e apenas indice de transporte; financeRecord
 * contem o registro integral e e a fonte de verdade no round-trip.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.RaytechFinanceQueueAdapterLab=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const mapping=Object.freeze({
    expenses:'expense',cardExpenses:'cardExpense',extraIncomes:'extraIncome'
  });
  const reverse=Object.freeze({
    expense:'expenses',cardExpense:'cardExpenses',extraIncome:'extraIncomes'
  });
  const MONTH=/^\d{4}-(0[1-9]|1[0-2])$/;
  const ID=/^[a-zA-Z0-9_-]{1,128}$/;
  function copy(x){
    const encoded=JSON.stringify(x);
    if(encoded===undefined) throw new Error('Registro nao serializavel.');
    const decoded=JSON.parse(encoded);
    if(JSON.stringify(decoded)!==encoded) throw new Error('Registro JSON inconsistente.');
    return decoded;
  }
  function check(record){
    if(!record||typeof record!=='object'||Array.isArray(record)||
      typeof record.id!=='string'||!record.id.trim()) throw new Error('Registro financeiro invalido.');
    const data=copy(record);
    if(!data||typeof data!=='object'||Array.isArray(data)||data.id!==record.id)
      throw new Error('Registro financeiro invalido.');
    return data;
  }
  function cents(value){
    if(typeof value!=='number'||!Number.isFinite(value)||value<0)
      throw new Error('Valor monetario invalido.');
    const rounded=Math.round(value*100);
    if(!Number.isSafeInteger(rounded)||rounded>999999999||
      Math.abs(value*100-rounded)>1e-7)
      throw new Error('Valor fora do limite ou com mais de duas casas.');
    return rounded;
  }
  function queueId(id){
    if(!ID.test(id)) throw new Error('ID incompatível com fila; exige mapeamento estavel.');
    return id;
  }
  function toQueue(ym,collection,record,options={}){
    if(!MONTH.test(ym)||!Object.prototype.hasOwnProperty.call(mapping,collection))
      throw new Error('Identidade financeira invalida.');
    const original=check(record);
    queueId(original.id);
    const moneyField=options.moneyField||
      (collection==='cardExpenses'&&typeof original.installmentValue==='number'
        ? 'installmentValue':'amount');
    const amount=Object.prototype.hasOwnProperty.call(original,moneyField)
      ? cents(original[moneyField]):0;
    const title=typeof original.title==='string'&&original.title.trim()
      ? original.title.slice(0,120):'Lancamento financeiro '+original.id.slice(0,70);
    const payload={title,amountCents:amount,financeSchema:1,
      financeCollection:collection,financeMonth:ym,financeId:original.id,
      financeMoneyField:Object.prototype.hasOwnProperty.call(original,moneyField)
        ?moneyField:null,financeRecord:original};
    return {month:ym,type:mapping[collection],id:original.id,data:payload};
  }
  function fromQueue(month,type,id,data){
    if(!MONTH.test(month)||!Object.prototype.hasOwnProperty.call(reverse,type)||
      !data||data.financeSchema!==1||data.financeMonth!==month||
      data.financeCollection!==reverse[type]||data.financeId!==id||
      typeof data.title!=='string'||!Number.isSafeInteger(data.amountCents))
      throw new Error('Envelope financeiro incompativel.');
    const record=check(data.financeRecord);
    if(record.id!==id) throw new Error('ID financeiro divergente.');
    const field=data.financeMoneyField;
    if(field!==null){
      if(typeof field!=='string'||!Object.prototype.hasOwnProperty.call(record,field)||
        cents(record[field])!==data.amountCents)
        throw new Error('Valor monetario divergente.');
    }else if(data.amountCents!==0) throw new Error('Valor monetario inesperado.');
    return {ym:month,collection:reverse[type],record};
  }
  function enqueue(queue,ym,collection,record){
    const v=toQueue(ym,collection,record);
    return queue.create(v.month,v.type,v.id,v.data);
  }
  return Object.freeze({toQueue,fromQueue,enqueue,mapping});
});
