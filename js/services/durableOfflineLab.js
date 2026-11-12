'use strict';
/* LAB Node-only: checkpoint JSON atomico em arquivo local de teste.
 * Sem dados reais, Firebase de producao, IndexedDB ou navegador.
 */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const queue=require('./offlineRevisionQueueLab.js');
const revision=require('./financialRevisionLab.js');
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const clone=x=>JSON.parse(JSON.stringify(x));
const digest=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
function wrap(state){const clean=queue.load(state);return {format:1,checksum:digest(clean),state:clean};}
function save(filename,state){
 const payload=wrap(state);
 fs.mkdirSync(path.dirname(filename),{recursive:true});
 const tmp=filename+'.tmp';
 try{
  fs.writeFileSync(tmp,JSON.stringify(payload),'utf8');
  fs.renameSync(tmp,filename);
 }finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}
 return payload.checksum;
}
function read(filename){
 const p=JSON.parse(fs.readFileSync(filename,'utf8'));
 if(!p||p.format!==1||p.checksum!==digest(p.state))throw Error('Checkpoint corrompido.');
 return queue.load(p.state);
}
function audit(state){
 const s=queue.load(state);
 const keys=[...s.pending.map(x=>x.key),...s.completed];
 if(new Set(keys).size!==keys.length)throw Error('Duplicidade na fila.');
 return {pending:s.pending.length,completed:s.completed.length,checksum:digest(s)};
}
function enqueue(filename,operation){
 const current=read(filename);
 const result=queue.enqueue(current,operation);
 if(result.status==='queued')save(filename,result.state);
 return result;
}
async function flush(filename,db,uid,preferences,hooks={}){
 let state=read(filename),applied=0;
 while(state.pending.length){
  const op=state.pending[0];
  let current;
  try{current=await revision.current(db,uid,preferences);}
  catch(error){return {status:'interrupted',applied,error:String(error.message||error)};}
  if(current.status!=='ready')return {status:'missing_remote',applied};
  let result;
  try{result=queue.reconcile(current.snapshot,op);}
  catch(error){return {status:'conflict',key:op.key,applied,error:String(error.message||error)};}
  if(result.status==='conflict')return {status:'conflict',key:op.key,applied};
  if(result.status==='merged'){
   let published;
   try{published=await revision.publish(db,uid,result.snapshot,current);}
   catch(error){return {status:'interrupted',applied,error:String(error.message||error)};}
   if(published.status==='conflict')continue;
   if(!['published','unchanged'].includes(published.status))throw Error('Publicacao inesperada.');
  }
  // Simula encerramento abrupto entre commit remoto e checkpoint.
  if(hooks.afterRemote)await hooks.afterRemote(op);
  state.pending.shift();state.completed.push(op.key);
  // Checkpoint antes da proxima operacao: nao perde progresso confirmado.
  save(filename,state);applied++;
 }
 const latest=await revision.current(db,uid,preferences);
 state.base={number:latest.number,checksum:latest.checksum};
 state.snapshot=clone(latest.snapshot);
 save(filename,state);
 return {status:'synced',applied,state};
}
module.exports={save,read,audit,enqueue,flush};
