import test from 'node:test';
import assert from 'node:assert/strict';
import {planOf,monthOf,view,reserve,finish} from './quota.mjs';
import {createCommercialStore} from './store.mjs';
import {makeServer} from './server.mjs';
import {createRestStore} from '../firestore.mjs';
import {readCreditBalance} from './handler.mjs';
import {extractInvoice} from './invoice.mjs';
const t=Date.parse('2026-11-30T23:59:00-03:00');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const account=(plan='free')=>({uid:'u',blocked:false,plan,premiumUntil:t+10000000});
const done=(s,plan,n,now,status='completed')=>{
 const r=reserve(s,now,plan,id(n));assert.equal(r.status,200);
 return finish(r.next,{status:'pending',plan,month:monthOf(now)},id(n),status,now+1);
};
test('free account eligibility and expiration',()=>{
 assert.equal(planOf('u',account(),t),'free');
 assert.equal(planOf('u',account('premium'),t),'premium');
 assert.equal(planOf('u',account('premium'),t+10000000),'free');
 assert.equal(planOf('u',{...account(),blocked:true},t),null);
 assert.equal(planOf('other',account(),t),null);
});
test('existing Premium profile works without an expiry and retains Free history on cancellation',async()=>{
 const {db,docs}=mockDb();let now=t;
 const s=createCommercialStore(db,{clock:()=>now});
 const first={uid:'u',requestId:id(101)};
 assert.equal((await s.reserveUsage(first)).status,200);
 await s.finishOutcome({...first,status:'completed'});
 docs.set('raytechV345Accounts/u',{uid:'u',blocked:false,plan:'premium'});
 assert.equal((await s.readCredits('u')).remaining,15);
 const second={uid:'u',requestId:id(102)};
 assert.equal((await s.reserveUsage(second)).status,200);
 await s.finishOutcome({...second,status:'completed'});
 assert.equal((await s.readCredits('u')).remaining,14);
 docs.set('raytechV345Accounts/u',{uid:'u',blocked:false,plan:'free'});
 now+=60001;
 assert.equal((await s.readCredits('u')).remaining,1);
 assert.equal(planOf('u',{uid:'u',blocked:false,plan:'premium',premiumUntil:null},now),null);
});
test('Free two credits persist across month; premium independent',()=>{
 let s=done(undefined,'free',1,t);
 s=done(s,'free',2,t+60001);
 assert.equal(reserve(s,t+120002,'free',id(3)).status,429);
 assert.equal(view(s,t+120002,'premium').remaining,15);
 assert.equal(view(s,t+120002,'free').remaining,0);
});
test('15 premium credits, renewal at Bahia midnight, no accumulation',()=>{
 let s;
 const start=t-3600000;
 for(let i=0;i<15;i++)s=done(s,'premium',i,start+i*60001);
 assert.equal(reserve(s,t,'premium',id(20)).status,429);
 assert.equal(view(s,t+60000,'premium').remaining,15);
 assert.equal(monthOf(t+59999),'2026-11');
 assert.equal(monthOf(t+60000),'2026-12');
});
test('reservation before provider, failure refunds credit but not rate',()=>{
 let r=reserve(undefined,t,'free',id(1));
 assert.equal(view(r.next,t,'free').remaining,1);
 assert.equal(reserve(r.next,t+1,'free',id(2)).status,409);
 let s=finish(r.next,{status:'pending',plan:'free',month:monthOf(t)},id(1),'failed',t+1);
 s=done(s,'free',2,t+2,'failed');
 assert.equal(view(s,t+3,'free').remaining,2);
 assert.equal(reserve(s,t+59999,'free',id(3)).error,'RATE_LIMIT');
 assert.equal(reserve(s,t+60000,'free',id(3)).status,200);
});
test('settlement is idempotent and cross-month reservation uses original period',()=>{
 const r=reserve(undefined,t,'premium',id(1)),a={status:'pending',plan:'premium',month:monthOf(t)};
 const s=finish(r.next,a,id(1),'completed',t+60001);
 assert.equal(view(s,t+60001,'premium').remaining,15);
 assert.equal(finish(s,{...a,status:'completed'},id(1),'completed',t+60002),null);
 assert.throws(()=>finish(s,{...a,status:'completed'},id(1),'failed',t+60002));
});
function mockDb(){
 const docs=new Map([['raytechV345Accounts/u',account()],['raytechV345Accounts/v',{...account(),uid:'v'}]]);
 const ref=name=>({name,collection:x=>({doc:y=>ref(name+'/'+x+'/'+y)})});
 let tail=Promise.resolve();
 const db={collection:x=>({doc:y=>ref(x+'/'+y)}),runTransaction(fn){
  const work=tail.then(async()=>{
   const writes=[];
   const snap=r=>({exists:docs.has(r.name),data:()=>structuredClone(docs.get(r.name))});
   const result=await fn({getAll:async(...refs)=>refs.map(snap),set:(r,d)=>writes.push([r.name,d]),create:(r,d)=>{if(docs.has(r.name))throw Error('EXISTS');writes.push([r.name,d]);},update:(r,d)=>writes.push([r.name,{...docs.get(r.name),...d}])});
   for(const [key,val] of writes)docs.set(key,structuredClone(val));
   return result;
  });tail=work.catch(()=>{});return work;
 }};
 return {db,docs};
}
test('transaction mock: concurrent reservations, replay, UID isolation, global budget',async()=>{
 const {db}=mockDb();let now=t;
 const s=createCommercialStore(db,{clock:()=>now,budget:{day:2,month:2,perAttempt:1}});
 const a={uid:'u',requestId:id(1)},b={uid:'u',requestId:id(2)};
 const results=await Promise.all([s.reserveUsage(a),s.reserveUsage(b)]);
 assert.deepEqual(results.map(x=>x.status),[200,409]);
 await s.finishOutcome({...a,status:'failed'});
 await s.finishOutcome({...a,status:'failed'});
 assert.equal((await s.readCredits('u')).remaining,2);
 assert.equal((await s.reserveUsage(a)).status,409);
 const other={uid:'v',requestId:id(1)};
 assert.equal((await s.reserveUsage(other)).status,200);
 await s.finishOutcome({...other,status:'completed'});
 assert.equal((await s.readCredits('v')).remaining,1);
 now+=60001;
 assert.equal((await s.reserveUsage(b)).error,'GLOBAL_BUDGET_EXCEEDED');
});
test('HTTP server disabled by default and isolated adapter forwards JSON',async()=>{
 const server=makeServer({env:{},handler:{fetch:async()=>{throw Error('must not call');}}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try{assert.equal((await fetch('http://127.0.0.1:'+server.address().port+'/v1/invoices',{method:'POST',body:'{}'})).status,503);}
 finally{await new Promise(r=>server.close(r));}
 const enabled=makeServer({env:{SMART_AI_EXPERIMENT_ENABLED:'true'},handler:{fetch:async req=>Response.json(await req.json())}});
 await new Promise(r=>enabled.listen(0,'127.0.0.1',r));
 try{const r=await fetch('http://127.0.0.1:'+enabled.address().port+'/v1/invoices',{method:'POST',body:'{"synthetic":true}'});assert.deepEqual(await r.json(),{synthetic:true});}
 finally{await new Promise(r=>enabled.close(r));}
});

test('expired undelivered reservation recovered once; late success rejected',async()=>{
 const {db,docs}=mockDb();let now=t;
 const s=createCommercialStore(db,{clock:()=>now,budget:{day:10,month:10,perAttempt:1}});
 const a={uid:'u',requestId:id(31)};
 assert.equal((await s.reserveUsage(a)).status,200);
 now+=119999;
 assert.equal(await s.recoverExpired('u'),false);
 now++;
 assert.deepEqual(await Promise.all([s.recoverExpired('u'),s.recoverExpired('u')]),[true,false]);
 assert.equal((await s.readCredits('u')).remaining,2);
 assert.equal(docs.get('raytechLabCommercialGlobalV350/budget').month.attempts,1);
 const audit=docs.get('raytechLabCommercialAuditV350/user_u_'+monthOf(t));
 assert.deepEqual(audit,{reserved:1,completed:0,failed:1,pending:0});
 await assert.rejects(s.finishOutcome({...a,status:'completed'}));
 assert.equal((await s.reserveUsage(a)).status,409);
 const b={uid:'u',requestId:id(32)};
 assert.equal((await s.reserveUsage(b)).status,200);
 await s.finishOutcome({...b,status:'completed'});
 now+=120001;
 assert.equal(await s.recoverExpired('u'),false);
 assert.equal((await s.readCredits('u')).remaining,1);
});

test('REST transaction retries an explicit Firestore abort and never retries an ambiguous commit',async()=>{
 for(const [failure,expected] of [['ABORTED',2],['UNAVAILABLE',1]]){
  let commits=0,begins=0;
  const db=createRestStore('projects/demo-test/databases/(default)','http://127.0.0.1:1/documents',
   async()=> 'synthetic',new AbortController().signal,async url=>{
    if(url.endsWith(':beginTransaction'))return Response.json({transaction:String(++begins)});
    if(url.endsWith(':rollback'))return Response.json({});
    assert.ok(url.endsWith(':commit'));
    if(++commits===1)return Response.json({error:{status:failure}},{status:failure==='ABORTED'?409:503});
    return Response.json({});
   },{abortedRetries:3});
  const work=db.runTransaction(tx=>tx.set(db.collection('synthetic').doc('fixture'),{count:1}));
  if(expected===1)await assert.rejects(work,/FIRESTORE_UNAVAILABLE/);
  else await work;
  assert.equal(begins,expected);
  assert.equal(commits,expected);
 }
});

test('GET credits derives UID from verified token and returns only balance, plan and renewal date',async()=>{
 const {db,docs}=mockDb();
 docs.set('raytechV345Accounts/u',{uid:'u',blocked:false,plan:'premium'});
 const s=createCommercialStore(db,{clock:()=>t});
 const snapshot=structuredClone(docs);
 const env={SMART_AI_EXPERIMENT_ENABLED:'true'};
 const server=makeServer({env,handler:{fetch:request=>readCreditBalance(request,{
  verifyToken:async token=>{if(token==='invalid')throw Error('REVOKED');return {uid:token};},
  readCredits:s.readCredits,
 })}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const url='http://127.0.0.1:'+server.address().port+'/v1/credits';
  const read=token=>fetch(url,token?{headers:{authorization:'Bearer '+token,'x-user-id':'v'}}:{});
  assert.equal((await read()).status,401);
  assert.equal((await read('invalid')).status,401);
  assert.equal((await read('missing')).status,403);
  const premium=await read('u');
  assert.equal(premium.headers.get('cache-control'),'no-store');
  assert.deepEqual(await premium.json(),{plan:'premium',remaining:15,busy:false,nextRenewalDate:'2026-12-01'});
  assert.deepEqual(await (await read('v')).json(),{plan:'free',remaining:2,busy:false,nextRenewalDate:null});
  assert.equal((await fetch(url+'?uid=v')).status,404);
  assert.deepEqual(docs,snapshot);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('credit reads account for current-month and expired holds without writing',async()=>{
 const {db,docs}=mockDb();let now=t;
 docs.set('raytechV345Accounts/u',{uid:'u',blocked:false,plan:'premium'});
 const s=createCommercialStore(db,{clock:()=>now});
 assert.equal((await s.reserveUsage({uid:'u',requestId:id(121)})).status,200);
 assert.equal((await s.readCredits('u')).remaining,14);
 const snapshot=structuredClone(docs);
 now+=60000;
 assert.deepEqual(await s.readCredits('u'),{plan:'premium',remaining:15,busy:true,month:'2026-12'});
 now+=60000;
 assert.deepEqual(await s.readCredits('u'),{plan:'premium',remaining:15,busy:false,month:'2026-12'});
 assert.deepEqual(docs,snapshot);
});

test('extraction acknowledges a refund only after the settlement succeeds',async()=>{
 const body={feature:'invoice-ai',mimeType:'application/pdf',data:Buffer.from('%PDF-1.4\n%%EOF\n').toString('base64')};
 const request={method:'POST',headers:{authorization:'Bearer synthetic','x-request-id':id(131)},body};
 for(const blocked of [false,true]){
  const result=await extractInvoice(request,{
   verifyToken:async()=>({uid:'u'}),readPermissions:async()=>({account:account()}),
   reserveUsage:async()=>({status:200}),provider:async()=>{throw Error('synthetic provider failure');},
   finishOutcome:async ({status})=>{assert.equal(status,'failed');if(blocked)throw Error('unavailable');},
  });
  assert.equal(result.status,502);
  assert.equal(result.body.creditRefunded,!blocked||undefined);
 }
});
