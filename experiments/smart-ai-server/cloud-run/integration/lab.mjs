import {randomUUID} from 'node:crypto';
import {createCommercialStore} from '../store.mjs';
import {readCreditBalance} from '../handler.mjs';
import {extractInvoice} from '../invoice.mjs';
import {handleSmartAdmin} from '../admin.mjs';
import {financeRef,financeState,recordBudgetPush} from '../finance-guard.mjs';
import {createBridge} from './bridge.mjs';

const profiles={free:'lab-free',premium:'lab-premium',admin:'lab-admin',owner:'lab-owner'};
const row=(kind,title,amountCents,currentInstallment=null,installments=null)=>({
 kind,title,amountCents,currentInstallment,installments,date:'2026-11-05',
});
export const syntheticInvoice={
 entries:[row('PURCHASE','Compra à vista',1890),row('INSTALLMENT','Compra parcelada',2590,2,3),row('REFUND','Estorno',-625)],
 statementTotalCents:3855,priorBalanceCents:null,priorPaymentsCents:null,balanceBasis:'ACTIVITY_ONLY',
};

function memoryDb(){
 const docs=new Map();
 const ref=name=>({name,collection:x=>({doc:y=>ref(name+'/'+x+'/'+y)})});
 const snapshot=name=>({exists:docs.has(name),data:()=>structuredClone(docs.get(name))});
 let tail=Promise.resolve();
 const db={collection:x=>({doc:y=>ref(x+'/'+y)}),runTransaction(fn){
  const transaction=tail.then(async()=>{
   const staged=new Map();
   const result=await fn({
    getAll:async(...refs)=>refs.map(r=>snapshot(r.name)),
    findByIdPrefix:async(collection,prefix)=>[...docs.keys()].filter(key=>key.startsWith(collection+'/'+prefix))
     .sort().slice(0,20).map(name=>({id:name.split('/').at(-1),...snapshot(name)})),
    set:(r,data)=>staged.set(r.name,data),
    update:(r,data)=>staged.set(r.name,{...docs.get(r.name),...data}),
    create:(r,data)=>{if(docs.has(r.name)||staged.has(r.name))throw Error('EXISTS');staged.set(r.name,data);},
   });
   for(const [key,value] of staged)docs.set(key,structuredClone(value));
   return result;
  });
  tail=transaction.catch(()=>{});
  return transaction;
 }};
 return {docs,db};
}

export function createLab({origin,mode='reconciled',observedCents=mode==='suspended'?750:null,clock=Date.now}){
 const {docs,db}=memoryDb(),sessions=new Map(),queries=new Map(),securityEvents=[];
 for(const [role,uid] of Object.entries(profiles)){
  docs.set('raytechV345Accounts/'+uid,{uid,blocked:false,plan:role==='premium'?'premium':'free',name:'Perfil fictício '+role});
  if(['admin','owner'].includes(role))docs.set('raytechV345Roles/'+uid,{role,active:true});
 }
 const store=createCommercialStore(db,{clock});
 const verifyFirebase=async token=>{
  const identity=sessions.get(token);
  if(!identity||identity.expires<=clock())throw Error('INVALID_SESSION');
  return identity;
 };
 function login(role,oldToken){
  const old=sessions.get(oldToken);
  if(!Object.hasOwn(profiles,role)||oldToken&&(role!=='owner'||old?.uid!==profiles.owner||old.expires<=clock()))return null;
  const token=randomUUID();
  if(oldToken)sessions.delete(oldToken);
  sessions.set(token,{uid:profiles[role],smartAiAdmin:role==='admin',authTime:oldToken?Math.floor(clock()/1000):0,expires:clock()+3600000});
  return token;
 }
 const readPermissions=async uid=>({account:docs.get('raytechV345Accounts/'+uid),role:docs.get('raytechV345Roles/'+uid)});
 const send=(status,data)=>Response.json(data,{status});
 async function invoke(path,options,identity){
  const request=new Request(origin+path,{...options,...(options.body?{duplex:'half'}:{})});
  const verifyToken=async token=>{
   const checked=await verifyFirebase(token);
   if(checked.uid!==identity.uid)throw Error('SESSION_CHANGED');
   return checked;
  };
  const finance=()=>financeState(docs.get(financeRef(db).name));
  const operational=()=>finance().suspended?'suspended':docs.get('raytechLabCommercialGlobalV350/config')?.enabled===false?'administrative':mode==='unavailable'?'unavailable':'available';
  if(path==='/v1/credits'){
   const result=await readCreditBalance(request,{verifyToken,readCredits:store.readCredits});
   return result.ok?send(200,{...await result.json(),operational:operational()}):result;
  }
  let body;
  try{body=await request.json();}catch{return send(400,{error:'INVALID_FILE'});}
  if(path==='/v1/admin/ai'){
   const adminContext={db,verifyToken,ownerUid:profiles.owner,clock,security:event=>{
    securityEvents.push({actorUid:identity.uid,at:clock(),action:body?.action==='search'?'search':'admin',result:'rejected',reason:event.code});
    if(securityEvents.length>100)securityEvents.shift();
   }};
   if(body?.action==='search'&&typeof body.prefix==='string'&&body.prefix.trim().length>=2){
    const access=await handleSmartAdmin(request,{action:'overview'},adminContext);
    if(access.status!==200)return send(access.status,access.body);
    if(!Object.keys(body).every(key=>['action','prefix','cursor'].includes(key))||body.prefix.length>128)return send(400,{error:'INVALID_REQUEST'});
    const query=body.prefix.trim().normalize('NFKC').toLocaleLowerCase('pt-BR');
    let window=queries.get(identity.uid);
    if(!window||clock()-window.start>=60000){window={start:clock(),count:0,pages:new Map()};queries.set(identity.uid,window);}
    if(++window.count>10)return send(429,{error:'RATE_LIMIT'});
    const page=body.cursor==null?{query,offset:0}:window.pages.get(body.cursor);
    if(!page||page.query!==query)return send(400,{error:'INVALID_REQUEST'});
    if(body.cursor)window.pages.delete(body.cursor);
    const matches=Object.entries(profiles).filter(([role,uid])=>
     [uid,'Perfil fictício '+role,role+'@example.invalid'].some(value=>value.toLowerCase().includes(query)));
    const rows=matches.slice(page.offset,page.offset+2).map(([role,uid])=>({uid,name:'Perfil fictício '+role}));
    const nextCursor=matches.length>page.offset+2?randomUUID():null;
    if(nextCursor)window.pages.set(nextCursor,{query,offset:page.offset+2});
    securityEvents.push({actorUid:identity.uid,at:clock(),action:'search',result:'accepted'});
    if(securityEvents.length>100)securityEvents.shift();
    return send(200,{rows,nextCursor});
   }
   const result=await handleSmartAdmin(request,body,adminContext);
   if(result.status===200&&body.action==='overview'){
    const audit=[...docs.entries()].filter(([key])=>key.startsWith('raytechLabSmartAiAdminAuditV350/'));
    result.body.auditCount=audit.length;
    const events=[...audit.map(([,event])=>({...event,result:'accepted',action:event.action??(event.after?.enabled===false?'suspend':'configure')})),...securityEvents];
    if(finance().suspended)events.push({actorUid:null,at:finance().publishedAt,action:'finance',result:'accepted',before:'Em operação',after:'Suspenso',reason:'Limite financeiro observado'});
    result.body.audit=events.sort((a,b)=>b.at-a.at).slice(0,20).map(({actorUid,...event})=>{
     const role=Object.keys(profiles).find(key=>profiles[key]===actorUid);
     return {...event,actor:role?'Perfil fictício '+role:'Finance Guard',role:role??'Sistema'};
    });
    result.body.simulated=true;
   }
   return send(result.status,result.body);
  }
  if(operational()!=='available')return send(503,{error:finance().suspended?'FINANCE_SUSPENDED':'EXPERIMENT_UNAVAILABLE'});
  const result=await extractInvoice({method:'POST',headers:Object.fromEntries(request.headers),body},{
   verifyToken,readPermissions,reserveUsage:store.reserveUsage,finishOutcome:store.finishOutcome,invoiceContractVersion:2,
   provider:async()=>{
    await new Promise(resolve=>setTimeout(resolve,250));
    if(mode==='failed')throw Error('SIMULATED_FAILURE');
    const fixture=structuredClone(syntheticInvoice);
    if(mode==='divergent')fixture.statementTotalCents+=100;
    if(mode==='incomplete')fixture.statementTotalCents=null;
    if(mode==='duplicates')fixture.entries.push({...fixture.entries[0]});
    return fixture;
   },
  });
  return send(result.status,result.body);
 }
 const observe=(cents,id=randomUUID())=>recordBudgetPush(db,{
  period:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit'}).format(clock()),
  publishedAt:clock(),observedCents:cents,current:true,id,
 });
 return {login,logout:token=>sessions.delete(token),bridge:createBridge({verifyFirebase,invoke,origin,clock}),
  observe,ready:observedCents===null?Promise.resolve():observe(observedCents)};
}
