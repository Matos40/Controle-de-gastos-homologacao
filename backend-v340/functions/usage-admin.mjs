import {randomUUID} from 'node:crypto';
import {FieldPath} from 'firebase-admin/firestore';
import {ACCOUNT_COLLECTION,ROLE_COLLECTION} from './policy.mjs';
import {USAGE_COLLECTION,LIMITS_COLLECTION,DEFAULT_LIMITS,validateLimits,windows} from './usage.mjs';
export const AUDIT_COLLECTION='raytechLabUsageAuditV343';
const uidOk=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
const result=(status,body)=>({status,body});
const error=(status,code)=>result(status,{error:code});
export function isOperator(uid,account,role){
 return uidOk(uid)&&account?.uid===uid&&account.blocked===false&&['free','premium'].includes(account.plan)&&role?.active===true&&['owner','admin'].includes(role.role);
}
export function summarizeUsage(data,limits,now){
 const cap=validateLimits(limits),periods=windows(now),used={},reached=[];
 if(data!==undefined&&(!data||!Number.isSafeInteger(data.lastAt)||data.lastAt>now))throw Error('INVALID_USAGE');
 for(const k of ['minute','day','month']){
  const old=data?.[k];
  if(data!==undefined&&(!old||old.period!==windows(data.lastAt)[k]||!Number.isSafeInteger(old.count)||old.count<1))throw Error('INVALID_USAGE');
  used[k]=old?.period===periods[k]?old.count:0;
  if(used[k]>=cap[k])reached.push(k);
 }
 return {used,limits:cap,reached};
}
export function parseAdminBody(body){
 if(exact(body,['action','after'])&&body.action==='list'&&(body.after===null||uidOk(body.after)))return body;
 if(exact(body,['action','uid'])&&body.action==='get'&&uidOk(body.uid))return body;
 if(exact(body,['action','uid','limits','expectedVersion'])&&body.action==='set'&&uidOk(body.uid)&&Number.isSafeInteger(body.expectedVersion)&&body.expectedVersion>=0){
  try{return {...body,limits:validateLimits(body.limits)};}catch{}
 }
 return null;
}
export async function handleUsageAdmin(req,{db,verifyToken,clock=Date.now}){
 if(req.method!=='POST')return error(405,'METHOD_NOT_ALLOWED');
 const header=req.headers?.authorization;
 if(typeof header!=='string'||header.length>8192||!/^Bearer [^\s,]+$/.test(header))return error(401,'UNAUTHENTICATED');
 let uid;try{uid=(await verifyToken(header.slice(7)))?.uid;}catch{return error(401,'UNAUTHENTICATED');}
 if(!uidOk(uid))return error(401,'UNAUTHENTICATED');
 const body=parseAdminBody(req.body);
 if(!body||Object.keys(req.query??{}).length)return error(400,'INVALID_REQUEST');
 const accounts=db.collection(ACCOUNT_COLLECTION),roles=db.collection(ROLE_COLLECTION),usage=db.collection(USAGE_COLLECTION),limits=db.collection(LIMITS_COLLECTION);
 try{
  return await db.runTransaction(async tx=>{
   const [actor,role]=await tx.getAll(accounts.doc(uid),roles.doc(uid));
   if(!isOperator(uid,actor.data(),role.data()))return error(403,'ACCESS_DENIED');
   const now=clock();
   const readRow=async doc=>{
    const target=doc.id,account=doc.data();
    if(account?.uid!==target||!['free','premium'].includes(account.plan)||typeof account.blocked!=='boolean')throw Error('INVALID_ACCOUNT');
    const [u,l,operator]=await tx.getAll(usage.doc(target),limits.doc(target),roles.doc(target));
    const settings=l.data();
    if(l.exists&&(!Number.isSafeInteger(settings.version)||settings.version<1))throw Error('INVALID_VERSION');
    const targetRole=operator.data()?.active===true&&['owner','admin'].includes(operator.data()?.role)?operator.data().role:null;
    return {uid:target,name:typeof account.name==='string'?account.name.slice(0,120):'',email:typeof account.email==='string'?account.email.slice(0,320):'',role:targetRole,editable:role.data().role==='owner'||(target!==uid&&!targetRole),plan:account.plan,blocked:account.blocked,version:settings?.version??0,...summarizeUsage(u.data(),l.exists?settings.limits:DEFAULT_LIMITS,now)};
   };
   if(body.action==='list'){
    let query=accounts.orderBy(FieldPath.documentId()).limit(26);
    if(body.after!==null)query=query.startAfter(body.after);
    const page=await tx.get(query),docs=page.docs.slice(0,25);
    const rows=[];
    for(const doc of docs)rows.push(await readRow(doc));
    const totals={minute:0,day:0,month:0,atLimit:0};
    for(const row of rows){for(const k of ['minute','day','month'])totals[k]+=row.used[k];if(row.reached.length)totals.atLimit++;}
    return result(200,{rows,totals,next:page.size>25?docs.at(-1).id:null,periods:windows(now)});
   }
   const target=await tx.get(accounts.doc(body.uid));
   if(!target.exists)return error(404,'NOT_FOUND');
   const row=await readRow(target);
   if(body.action==='get')return result(200,{row,periods:windows(now)});
   const targetRole=await tx.get(roles.doc(body.uid));
   // Only Owner may alter another operator or its own limits; Admin manages ordinary accounts.
   if(role.data().role!=='owner'&&(body.uid===uid||targetRole.data()?.active===true&&['owner','admin'].includes(targetRole.data().role)))return error(403,'ACCESS_DENIED');
   if(row.version!==body.expectedVersion)return error(409,'VERSION_CONFLICT');
   const version=row.version+1;
   tx.set(limits.doc(body.uid),{limits:body.limits,version,updatedAt:now});
   tx.create(db.collection(AUDIT_COLLECTION).doc(randomUUID()),{actorUid:uid,targetUid:body.uid,before:row.limits,after:body.limits,version,at:now});
   return result(200,{version,limits:body.limits});
  },body.action==='set'?{maxAttempts:5}:{readOnly:true});
 }catch{return error(503,'ADMIN_UNAVAILABLE');}
}
