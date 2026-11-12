'use strict';
/* Protocolo experimental. O marcador final e imutavel; estado parcial e derivado
 * dos documentos. Nenhuma conexao a Firebase real ou localStorage.
 * Marcador criado apenas apos auditoria integral; regras nao comprovam auditoria
 * independente contra clientes maliciosos. */
const assert=require('node:assert/strict');
const {entries,inspect,migrate,audit,planIdOf}=require('./monthMigrationLab.js');
const UID=/^[a-zA-Z0-9_-]{1,100}$/;
function finalRef(db,uid,plan){
 if(typeof uid!=='string'||!UID.test(uid)) throw Error('UID invalido.');
 return db.doc('users/'+uid+'/monthMigrationFinalized/'+planIdOf(plan));
}
function finalValue(plan){
 return {version:1,planId:planIdOf(plan),checksum:plan.checksum,
  monthCount:plan.envelope.months.length,recordCount:plan.envelope.records.length,
  status:'audited'};
}
async function state(plan,db,uid){
 const target=finalRef(db,uid,plan);
 const [s,marker]=await Promise.all([inspect(plan,db,uid),target.get()]);
 if(s.conflicts.length) return {status:'conflict',...s,finalized:marker.exists};
 if(marker.exists){
  assert.deepStrictEqual(marker.data(),finalValue(plan),'Marcador final divergente.');
  if(s.missing!==0) throw Error('Marcador final sem documentos completos.');
  await audit(plan,db,uid);
  return {status:'audited',...s,finalized:true};
 }
 return {status:s.present===0?'not_started':'in_progress',...s,finalized:false};
}
async function finalize(plan,db,uid){
 const s=await state(plan,db,uid);
 if(s.status==='audited') return {status:'audited',created:false};
 if(s.status==='conflict'||s.missing!==0) throw Error('Migracao incompleta ou em conflito.');
 await audit(plan,db,uid);
 const target=finalRef(db,uid,plan),value=finalValue(plan);
 const created=await db.runTransaction(async tx=>{
  // Revalidar todos os documentos dentro da transacao, antes de marcar.
  const all=entries(plan);
  const refs=all.map(e=>{
   const collections={manifest:'monthMigrationManifest',month:'monthMigrationMonths',
    record:'monthMigrationRecords'};
   return db.doc('users/'+uid+'/'+collections[e.kind]+'/'+e.id);
  });
  const docs=[];
  for(const r of refs) docs.push(await tx.get(r));
  const old=await tx.get(target);
  for(let i=0;i<all.length;i++){
   if(!docs[i].exists) throw Error('Documento ausente durante finalizacao.');
   assert.deepStrictEqual(docs[i].data(),all[i].value,'Conflito durante finalizacao.');
  }
  if(old.exists){
   assert.deepStrictEqual(old.data(),value,'Marcador final divergente.');
   return false;
  }
  tx.set(target,value);
  return true;
 });
 await state(plan,db,uid);
 return {status:'audited',created};
}
async function run(plan,db,uid,limit=1){
 const before=await state(plan,db,uid);
 if(before.status==='audited') return {status:'audited',written:0};
 if(before.status==='conflict') return {status:'conflict',written:0,conflicts:before.conflicts};
 let result;
 try {result=await migrate(plan,db,uid,limit);}
 catch(error){return {status:'interrupted',written:null,error:String(error.message||error)};}
 if(result.status==='conflict') return {status:'conflict',written:result.written,conflicts:result.conflicts};
 if(result.status!=='complete') return {status:'in_progress',written:result.written,missing:result.missing};
 try {const f=await finalize(plan,db,uid);return {...f,written:result.written};}
 catch(error){return {status:'interrupted',written:result.written,error:String(error.message||error)};}
}
module.exports={state,run,finalize,finalRef,finalValue};
