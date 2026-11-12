'use strict';
/* Node-only, Firestore injetado. Somente dados ficticios no emulador.
 * Documentos v2 imutaveis, separados por plano e usuario.
 */
const assert=require('node:assert/strict');
const {makeV2,checkV2,fromLegacy,importVersioned}=require('./versionedBoundaryBridgeLab.js');
const UID=/^[a-zA-Z0-9_-]{1,100}$/;
const YM=/^\d{4}-(0[1-9]|1[0-2])$/;
function validate(uid){if(typeof uid!=='string'||!UID.test(uid))throw Error('UID invalido.');}
function prepare(input){
 const envelope=input&&input.version===2?input:
  input&&input.version===1?fromLegacy(input.plan).envelope:makeV2(input);
 const shared=checkV2(envelope);
 const planId='v2_'+envelope.checksum;
 const docs=[{id:'manifest',value:{version:2,kind:'manifest',planId,
  checksum:envelope.checksum,monthCount:Object.keys(shared.months).length}}];
 for(const ym of Object.keys(shared.months).sort()){
  if(!YM.test(ym))throw Error('Mes invalido.');
  docs.push({id:'m_'+ym,value:{version:2,kind:'month',planId,ym,
   data:shared.months[ym]}});
 }
 return {envelope,planId,docs};
}
function root(db,uid,plan){validate(uid);return db.collection('users/'+uid+'/financeV2Plans/'+plan.planId+'/documents');}
function marker(db,uid,plan){validate(uid);return db.doc('users/'+uid+'/financeV2Plans/'+plan.planId+'/completion/audited');}
async function inspect(plan,db,uid){
 const base=root(db,uid,plan);
 const snaps=await Promise.all(plan.docs.map(x=>base.doc(x.id).get()));
 const conflicts=[],missing=[];
 for(let i=0;i<snaps.length;i++){
  if(!snaps[i].exists)missing.push(plan.docs[i].id);
  else try{assert.deepStrictEqual(snaps[i].data(),plan.docs[i].value);}
  catch(_){conflicts.push(plan.docs[i].id);}
 }
 const all=await base.get();
 const known=new Set(plan.docs.map(x=>x.id));
 for(const d of all.docs)if(!known.has(d.id))conflicts.push(d.id);
 return {missing,conflicts,present:plan.docs.length-missing.length-conflicts.filter(x=>known.has(x)).length};
}
async function read(plan,db,uid,preferences){
 const s=await inspect(plan,db,uid);
 if(s.conflicts.length||s.missing.length)throw Error('Plano remoto incompleto ou conflitante.');
 const base=root(db,uid,plan);
 const docs=await Promise.all(plan.docs.map(x=>base.doc(x.id).get()));
 const months={};
 for(const d of docs.slice(1)){
  const v=d.data();
  months[v.ym]=v.data;
 }
 const envelope={version:2,schema:1,shared:{schema:1,months},checksum:plan.envelope.checksum};
 const result=importVersioned(envelope,preferences);
 assert.deepStrictEqual(result.snapshot.months,plan.envelope.shared.months);
 return result;
}
async function finalize(plan,db,uid,preferences){
 await read(plan,db,uid,preferences);
 const target=marker(db,uid,plan);
 const base=root(db,uid,plan);
 const value={version:2,planId:plan.planId,checksum:plan.envelope.checksum,status:'audited'};
 const created=await db.runTransaction(async tx=>{
  const snapshots=[];
  for(const entry of plan.docs)snapshots.push(await tx.get(base.doc(entry.id)));
  const existing=await tx.get(target);
  for(let i=0;i<plan.docs.length;i++){
   if(!snapshots[i].exists)throw Error('Documento ausente na finalizacao.');
   assert.deepStrictEqual(snapshots[i].data(),plan.docs[i].value);
  }
  if(existing.exists){assert.deepStrictEqual(existing.data(),value);return false;}
  tx.set(target,value);return true;
 });
 return {status:'audited',created};
}
async function run(plan,db,uid,preferences,limit=1){
 if(!Number.isSafeInteger(limit)||limit<1)throw Error('Limite invalido.');
 const before=await inspect(plan,db,uid);
 if(before.conflicts.length)return {status:'conflict',written:0,conflicts:before.conflicts};
 let written=0;
 const base=root(db,uid,plan);
 for(const entry of plan.docs){
  if(written>=limit)break;
  if(!before.missing.includes(entry.id))continue;
  try{
   const created=await db.runTransaction(async tx=>{
    const target=base.doc(entry.id),old=await tx.get(target);
    if(old.exists){assert.deepStrictEqual(old.data(),entry.value);return false;}
    tx.set(target,entry.value);return true;
   });
   if(created)written++;
  }catch(error){return {status:'interrupted',written,error:String(error.message||error)};}
 }
 const after=await inspect(plan,db,uid);
 if(after.conflicts.length)return {status:'conflict',written,conflicts:after.conflicts};
 if(after.missing.length)return {status:'in_progress',written,missing:after.missing.length};
 try{return {...await finalize(plan,db,uid,preferences),written};}
 catch(error){return {status:'interrupted',written,error:String(error.message||error)};}
}
module.exports={prepare,root,marker,inspect,read,finalize,run};
