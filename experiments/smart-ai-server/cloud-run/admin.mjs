import {randomUUID} from 'node:crypto';
import {validateBudget,budgetView} from '../legacy/global-budget.mjs';
import {COMMERCIAL_ACCOUNTS,COMMERCIAL_GLOBAL,LAB_CAP,createCommercialStore} from './store.mjs';
import {validUid,planOf,monthOf} from './quota.mjs';
import {metricRefs,metricView,dayOf} from './admin-metrics.mjs';
import {financeRef,financeState,financeView} from './finance-guard.mjs';
import {recentlyAuthenticated} from './security-guard.mjs';

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

function parseDirectory(body){
 const {field,term,cursor}=body;
 if(!['name','email','uid'].includes(field)||typeof term!=='string'||term.length>128)return null;
 const key=field==='uid'?term:term.trim().normalize('NFKC').toLocaleLowerCase('pt-BR');
 if(field==='uid'&&!/^[A-Za-z0-9_-]{3,128}$/.test(key)||
    field==='name'&&(key.length<3||/[\u0000-\u001f\uf8ff]/.test(key))||
    field==='email'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key))return null;
 if(cursor!==null&&(!exact(cursor,['key','uid'])||!validUid(cursor.uid)||typeof cursor.key!=='string'||cursor.key.length>128||
  (field==='email'?cursor.key!==key:!cursor.key.startsWith(key)||cursor.key>=key+'\uf8ff')))return null;
 return {action:'directory',field,term:key,cursor};
}
function parse(body){
 if(exact(body,['action','field','term','cursor'])&&body.action==='directory')return parseDirectory(body);
 if(exact(body,['action','confirmed','expectedVersion'])&&body.action==='reactivateFinance'&&
    body.confirmed===true&&Number.isSafeInteger(body.expectedVersion)&&body.expectedVersion>=0)return body;
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

export async function handleSmartAdmin(request,body,{db,verifyToken,ownerUid,clock=Date.now,security=()=>{}}){
 const deny=(status,code)=>{security({event:'smart_ai_security',code});return error(status,code);};
 const bearer=request.headers.get('authorization');
 if(!bearer||bearer.length>8192||!/^Bearer [^\s,]+$/.test(bearer))return deny(401,'ACCESS_DENIED');
 let identity;
 try{identity=await verifyToken(bearer.slice(7));}catch{return deny(401,'ACCESS_DENIED');}
 const {uid,authTime,smartAiAdmin}=identity??{};
 if(!validUid(uid))return deny(401,'ACCESS_DENIED');
 const action=parse(body);
 if(!action)return deny(400,'INVALID_REQUEST');
 const financeChange=action.action==='reactivateFinance';
 const change=action.action==='configure'||financeChange;
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
   const owner=validUid(ownerUid)&&uid===ownerUid&&Boolean(planOf(uid,profile.data(),now))&&role?.active===true&&role.role==='owner';
   const admin=smartAiAdmin===true&&role?.active===true&&role.role==='admin'&&planOf(uid,profile.data(),now);
   if(!owner&&(!admin||change))return deny(403,'ACCESS_DENIED');
   if(change&&!recentlyAuthenticated(authTime,now))return deny(403,'REAUTH_REQUIRED');
   if(financeChange){
    const ref=financeRef(db),[snapshot]=await tx.getAll(ref),before=financeState(snapshot.data());
    if(before.version!==action.expectedVersion||!before.suspended)return error(409,'VERSION_CONFLICT');
    const after={...before,suspended:false,version:before.version+1};
    tx.set(ref,after);
    tx.create(db.collection(audit).doc(changeId),{actorUid:uid,at:now,action:'reactivateFinance',before:before.version,after:after.version});
    return reply(200,{finance:financeView(after,now)});
   }
   if(action.action==='directory'){
    const throttle=db.collection('raytechLabAdminDirectoryAccessV350').doc(uid);
    const [snapshot]=await tx.getAll(throttle);
    const bucket=Math.floor(now/60000),previous=snapshot.data();
    const count=previous?.bucket===bucket?previous.count:0;
    if(!Number.isSafeInteger(count)||count<0)throw Error('INVALID_RATE_STATE');
    if(count>=6)return deny(429,'RATE_LIMIT');
    const found=await tx.findDirectoryPage(action);
    const fieldKey={name:'nameKey',email:'emailKey',uid:'uid'}[action.field];
    const rows=found.slice(0,10).filter(row=>validUid(row.id)&&row.data().uid===row.id)
     .map(row=>({uid:row.id,name:String(row.data().label??'').slice(0,120)}));
    const last=found[9];
    tx.set(throttle,{bucket,count:count+1,lastAt:now});
    return reply(200,{rows,nextCursor:found.length>10?{key:last.data()[fieldKey],uid:last.id}:null});
   }
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
   const [settings,usage,daily,monthly,finance]=await tx.getAll(configRef,budgetRef,...metricRefs(db,now),financeRef(db));
   const config=configView(settings.data(),LAB_CAP);
   const day=metricView(daily.data()),month=metricView(monthly.data());
   const complete=month.free.completed+month.premium.completed;
   const budget=budgetView(usage.data(),now,config.budget);
   return reply(200,{settings:config,role:owner?'owner':'admin',finance:financeView(financeState(finance.data()),now),
    security:{reauthSeconds:300,serverAuthorization:true},periods:{day:dayOf(now),month:monthOf(now)},
    day,month,attemptsUtc:budget.attempts,monthlyAverage:month.users?Math.round(100*complete/month.users)/100:null});
  },{readOnly:!change&&action.action!=='directory'});
 }catch{return error(503,'ADMIN_UNAVAILABLE');}
}
