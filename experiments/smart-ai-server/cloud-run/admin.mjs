import {randomUUID} from 'node:crypto';
import {validateBudget,budgetView} from '../legacy/global-budget.mjs';
import {COMMERCIAL_ACCOUNTS,COMMERCIAL_GLOBAL,LAB_CAP,createCommercialStore} from './store.mjs';
import {validUid,planOf,monthOf} from './quota.mjs';
import {metricRefs,metricView,dayOf} from './admin-metrics.mjs';

const roles='raytechV345Roles';
const audit='raytechLabSmartAiAdminAuditV350';
const exact=(body,keys)=>body&&typeof body==='object'&&!Array.isArray(body)&&
 Object.keys(body).length===keys.length&&keys.every(k=>Object.hasOwn(body,k));
const reply=(status,body)=>({status,body});
const error=(status,code)=>reply(status,{error:code});

function configView(old,budget){
 if(old===undefined)return {enabled:true,budget,version:0};
 if(!old||typeof (old.enabled??true)!=='boolean'||!Number.isSafeInteger(old.version??0)||(old.version??0)<0)throw Error('INVALID_CONFIG');
 return {enabled:old.enabled??true,budget:old.budget===undefined?budget:validateBudget(old.budget),version:old.version??0};
}

function parse(body){
 if(exact(body,['action'])&&body.action==='overview')return body;
 if(exact(body,['action','prefix'])&&body.action==='search'&&
    typeof body.prefix==='string'&&/^[A-Za-z0-9_-]{2,128}$/.test(body.prefix))return body;
 if(exact(body,['action','uid'])&&body.action==='credits'&&validUid(body.uid))return body;
 if(exact(body,['action','enabled','day','month','expectedVersion'])&&body.action==='configure'&&
    typeof body.enabled==='boolean'&&Number.isSafeInteger(body.expectedVersion)&&body.expectedVersion>=0&&
    Number.isSafeInteger(body.day)&&Number.isSafeInteger(body.month)&&
    body.day>=1&&body.day<=LAB_CAP.day&&body.month>=body.day&&body.month<=LAB_CAP.month)return body;
 return null;
}

export async function handleSmartAdmin(request,body,{db,verifyToken,clock=Date.now}){
 const bearer=request.headers.get('authorization');
 if(!bearer||bearer.length>8192||!/^Bearer [^\s,]+$/.test(bearer))return error(401,'ACCESS_DENIED');
 let uid;
 try{({uid}=await verifyToken(bearer.slice(7)));}catch{return error(401,'ACCESS_DENIED');}
 if(!validUid(uid))return error(401,'ACCESS_DENIED');
 const action=parse(body);
 if(!action)return error(400,'INVALID_REQUEST');
 const change=action.action==='configure';
 const changeId=change?randomUUID():null;
 const configRef=db.collection(COMMERCIAL_GLOBAL).doc('config');
 const budgetRef=db.collection(COMMERCIAL_GLOBAL).doc('budget');
 const accountRef=id=>db.collection(COMMERCIAL_ACCOUNTS).doc(id);
 const roleRef=id=>db.collection(roles).doc(id);
 const store=createCommercialStore(db,{clock});
 try{
  return await db.runTransaction(async tx=>{
   const [profile,permission]=await tx.getAll(accountRef(uid),roleRef(uid));
   const now=clock(),role=permission.data();
   if(!planOf(uid,profile.data(),now)||role?.active!==true||!['owner','admin'].includes(role.role)||
      (change&&role.role!=='owner'))return error(403,'ACCESS_DENIED');
   if(action.action==='search'){
    const fields=['uid','blocked','plan','premiumUntil','name','displayName','googleProfile.displayName','googleProfile.name'];
    const rows=await tx.findByIdPrefix(COMMERCIAL_ACCOUNTS,action.prefix,fields);
    return reply(200,{rows:rows.filter(row=>validUid(row.id)&&row.data()?.uid===row.id).map(row=>{
     const profile=row.data(), identity=profile.googleProfile??profile;
     return {uid:row.id,name:typeof identity.displayName==='string'?identity.displayName.slice(0,120):
       typeof identity.name==='string'?identity.name.slice(0,120):'',plan:planOf(row.id,profile,now),blocked:profile.blocked===true};
    })});
   }
   if(action.action==='credits'){
    const credit=await store.readCredits(action.uid,tx);
    return credit?reply(200,{uid:action.uid,...credit}):error(404,'NOT_FOUND');
   }
   if(change){
    const [snapshot]=await tx.getAll(configRef);
    const before=configView(snapshot.data(),LAB_CAP);
    if(before.version!==action.expectedVersion)return error(409,'VERSION_CONFLICT');
    const settings={enabled:action.enabled,budget:{day:action.day,month:action.month,perAttempt:1},version:before.version+1};
    tx.set(configRef,settings);
    tx.create(db.collection(audit).doc(changeId),{actorUid:uid,at:now,before,after:settings});
    return reply(200,{settings});
   }
   const [settings,usage,daily,monthly]=await tx.getAll(configRef,budgetRef,...metricRefs(db,now));
   const config=configView(settings.data(),LAB_CAP);
   const day=metricView(daily.data()),month=metricView(monthly.data());
   const complete=month.free.completed+month.premium.completed;
   const budget=budgetView(usage.data(),now,config.budget);
   return reply(200,{settings:config,role:role.role,periods:{day:dayOf(now),month:monthOf(now)},
    day,month,attemptsUtc:budget.attempts,monthlyAverage:month.users?Math.round(100*complete/month.users)/100:null});
  },{readOnly:!change});
 }catch{return error(503,'ADMIN_UNAVAILABLE');}
}
