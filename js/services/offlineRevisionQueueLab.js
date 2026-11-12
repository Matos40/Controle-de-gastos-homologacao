'use strict';
/* Laboratorio isolado: fila serializavel, reconciliacao conservadora por campo/registro.
 * Nao acessa armazenamento, rede ou credenciais diretamente.
 */
const assert=require('node:assert/strict');
const revision=require('./financialRevisionLab.js');
const {assertSnapshot}=require('./financeConverterLab.js');
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const clone=x=>JSON.parse(JSON.stringify(x));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const TYPES=new Set(['expenses','cardExpenses','extraIncomes']);
function location(snapshot,op){
 const month=snapshot.months[op.ym];
 if(!month)throw Error('Mes nao encontrado.');
 if(op.type==='salary')return {get:()=>month.salary,set:v=>{month.salary=clone(v);}};
 if(!TYPES.has(op.type))throw Error('Tipo nao permitido.');
 if(!Array.isArray(month[op.type]))throw Error('Colecao ausente.');
 const arr=month[op.type],index=arr.findIndex(x=>x.id===op.id);
 return {get:()=>index<0?null:arr[index],set:v=>{
  if(v===null){if(index>=0)arr.splice(index,1);}
  else if(index<0)arr.push(clone(v));else arr[index]=clone(v);
 }};
}
function validateOp(op){
 if(!op||typeof op.key!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(op.key)||
  !/^\d{4}-(0[1-9]|1[0-2])$/.test(op.ym)||
  !['salary',...TYPES].includes(op.type))throw Error('Operacao invalida.');
 if(op.type!=='salary'&&(typeof op.id!=='string'||!op.id||op.id.includes('/')))
  throw Error('ID de registro invalido.');
 if(op.type==='salary'&&typeof op.value!=='number')throw Error('Salario invalido.');
 if(op.type!=='salary'&&op.value!==null&&
  (!op.value||op.value.id!==op.id))throw Error('Registro invalido.');
 if(!own(op,'expected')||!own(op,'value'))throw Error('Precondicao ausente.');
}
function create(snapshot,base){
 assertSnapshot(snapshot);
 if(!base||!Number.isSafeInteger(base.number)||base.number<1||
  typeof base.checksum!=='string')throw Error('Base invalida.');
 return {version:1,base:{number:base.number,checksum:base.checksum},
  snapshot:clone(snapshot),pending:[],completed:[]};
}
function load(serialized){
 const state=typeof serialized==='string'?JSON.parse(serialized):clone(serialized);
 if(!state||state.version!==1||!Array.isArray(state.pending)||
  !Array.isArray(state.completed)||!state.base)throw Error('Fila invalida.');
 assertSnapshot(state.snapshot);
 state.pending.forEach(validateOp);
 if(new Set([...state.pending.map(x=>x.key),...state.completed]).size!==
  state.pending.length+state.completed.length)throw Error('Chaves duplicadas.');
 return state;
}
function enqueue(state,input){
 const s=load(state);
 if(s.pending.some(x=>x.key===input.key)||s.completed.includes(input.key))
  return {state:s,status:'duplicate'};
 const op=clone(input);validateOp(op);
 const slot=location(s.snapshot,op);
 if(!same(slot.get(),op.expected))throw Error('Precondicao local divergente.');
 slot.set(op.value);assertSnapshot(s.snapshot);
 s.pending.push(op);
 return {state:s,status:'queued'};
}
function reconcile(remote,op){
 const next=clone(remote);const slot=location(next,op);
 const actual=slot.get();
 if(same(actual,op.value))return {status:'already_applied',snapshot:next};
 if(!same(actual,op.expected))return {status:'conflict',snapshot:next};
 slot.set(op.value);assertSnapshot(next);
 return {status:'merged',snapshot:next};
}
async function flush(db,uid,state,preferences){
 const s=load(state);
 let applied=0;
 while(s.pending.length){
  const op=s.pending[0];
  let current;
  try{current=await revision.current(db,uid,preferences);}
  catch(error){return {status:'interrupted',state:s,applied,error:String(error.message||error)};}
  if(current.status!=='ready')return {status:'missing_remote',state:s,applied};
  let merged;
  try{merged=reconcile(current.snapshot,op);}
  catch(error){return {status:'conflict',state:s,applied,key:op.key,error:String(error.message||error)};}
  if(merged.status==='conflict')
   return {status:'conflict',state:s,applied,key:op.key,remote:current.snapshot};
  if(merged.status==='merged'){
   let result;
   try{result=await revision.publish(db,uid,merged.snapshot,current);}
   catch(error){return {status:'interrupted',state:s,applied,error:String(error.message||error)};}
   if(result.status==='conflict')continue; // Rele e reavalia precondicao.
   if(!['published','unchanged'].includes(result.status))throw Error('Resultado inesperado.');
  }
  s.pending.shift();s.completed.push(op.key);applied++;
 }
 const latest=await revision.current(db,uid,preferences);
 s.base={number:latest.number,checksum:latest.checksum};
 s.snapshot=clone(latest.snapshot);
 return {status:'synced',state:s,applied};
}
module.exports={create,load,enqueue,reconcile,flush};
