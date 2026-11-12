'use strict';
// Fronteira HTTP de laboratorio: validacao sem alterar os modelos financeiros.
class HttpInputError extends Error {
 constructor(code){super(code);this.name='HttpInputError';this.code=code;}
}
const fail=code=>{throw new HttpInputError(code);};
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const month=/^\d{4}-(0[1-9]|1[0-2])$/;
const key=/^[A-Za-z0-9_-]{1,80}$/;
const id=/^[A-Za-z0-9_-]{1,100}$/;
function safeTree(value,depth=0,count={n:0}){
 if(depth>16)fail('invalid_payload');
 count.n++;if(count.n>5000)fail('invalid_payload');
 if(typeof value==='number'&&!Number.isFinite(value))fail('invalid_payload');
 if(typeof value==='string'&&value.length>8192)fail('invalid_payload');
 if(Array.isArray(value)){for(const x of value)safeTree(x,depth+1,count);return;}
 if(obj(value)){
  for(const [k,v] of Object.entries(value)){
   if(['__proto__','prototype','constructor'].includes(k)||k.length>128)
    fail('invalid_payload');
   safeTree(v,depth+1,count);
  }
 }
}
function exact(value,allowed,code){
 if(!obj(value)||Object.keys(value).some(k=>!allowed.includes(k)))fail(code);
}
function validate(action,data){
 exact(data,action==='audit'?[]:action==='initialize'?['snapshot']:['operation'],'invalid_request');
 safeTree(data);
 if(action==='audit')return;
 if(action==='initialize'){
  const s=data.snapshot;
  if(!obj(s)||!obj(s.months)||!month.test(s.selectedMonth)||!own(s.months,s.selectedMonth)||
   Object.keys(s.months).length===0)fail('invalid_snapshot');
  for(const [ym,entry] of Object.entries(s.months)){
   if(!month.test(ym)||!obj(entry)||!Number.isFinite(entry.salary)||
    !Array.isArray(entry.expenses)||!Array.isArray(entry.cardExpenses)||
    !Array.isArray(entry.extraIncomes))fail('invalid_snapshot');
  }
  return;
 }
 const op=data.operation;
 if(!obj(op)||Object.keys(op).some(k=>!['key','ym','type','id','expected','value'].includes(k))||
  (typeof op.key!=='string'||!key.test(op.key))||
  (typeof op.ym!=='string'||!month.test(op.ym))||
  !['salary','expenses','cardExpenses','extraIncomes'].includes(op.type)||
  !own(op,'expected')||!own(op,'value'))fail('invalid_operation');
 if(op.type==='salary'){
  if(own(op,'id')||!Number.isFinite(op.value)||
   (op.expected!==null&&!Number.isFinite(op.expected)))fail('invalid_operation');
 }else{
  if(typeof op.id!=='string'||!id.test(op.id))fail('invalid_operation');
  for(const value of [op.expected,op.value]){
   if(value!==null&&(!obj(value)||value.id!==op.id))fail('invalid_operation');
  }
 }
}
module.exports={validate,HttpInputError};
