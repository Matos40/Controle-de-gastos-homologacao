import test from 'node:test';
import assert from 'node:assert/strict';
import {planOf,monthOf,view,reserve,finish} from './quota.mjs';
import {createCommercialStore} from './store.mjs';
import {makeServer} from './server.mjs';
import {createRestStore} from '../firestore.mjs';
import {readCreditBalance} from './handler.mjs';
import {extractInvoice} from './invoice.mjs';
import {handleSmartAdmin} from './admin.mjs';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {financeRef,parseBudgetPush,recordBudgetPush} from './finance-guard.mjs';
import {createPushVerifier,invalidLimiter,recentlyAuthenticated} from './security-guard.mjs';
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
   const findByIdPrefix=async(collection,prefix)=>[...docs.keys()].filter(key=>key.startsWith(collection+'/'+prefix))
    .sort().slice(0,20).map(name=>({id:name.split('/').at(-1),...snap({name})}));
   const result=await fn({getAll:async(...refs)=>refs.map(snap),findByIdPrefix,set:(r,d)=>writes.push([r.name,d]),create:(r,d)=>{if(docs.has(r.name))throw Error('EXISTS');writes.push([r.name,d]);},update:(r,d)=>writes.push([r.name,{...docs.get(r.name),...d}])});
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

function adminFixture(){
 const {db,docs}=mockDb();
 for(const actor of ['owner','admin','inactive','blocked']){
  docs.set('raytechV345Accounts/'+actor,{uid:actor,blocked:actor==='blocked',plan:'free'});
  docs.set('raytechV345Roles/'+actor,{role:actor==='admin'?'admin':'owner',active:actor!=='inactive'});
 }
 let now=t-120000;
 const clock=()=>now;
 const api=(token,body)=>handleSmartAdmin(new Request('https://fixture.invalid/v1/admin/ai',{
  headers:token?{authorization:'Bearer '+token}:{},
 }),body,{db,clock,ownerUid:'owner',verifyToken:async value=>{
  if(value==='revoked')throw Error('REVOKED');
  return {uid:value==='owner-old'?'owner':value,authTime:Math.floor(now/1000)-(value==='owner-old'?301:0),smartAiAdmin:value==='admin'};
 }});
 return {db,docs,api,store:createCommercialStore(db,{clock}),advance:ms=>{now+=ms;}};
}

test('forged role documents and administrative payloads cannot elevate a Free caller',async()=>{
 const {api,docs}=adminFixture();
 for(const role of ['owner','admin']){
  docs.set('raytechV345Roles/u',{role,active:true});
  assert.equal((await api('u',{action:'overview'})).status,403);
 }
 for(const fields of [{role:'owner'},{plan:'premium'},{credits:15},{blocked:true}]){
  assert.equal((await api('owner',{action:'overview',...fields})).status,400);
 }
 const change={action:'configure',enabled:true,day:10,month:20,expectedVersion:0};
 assert.equal((await api('owner-old',change)).body.error,'REAUTH_REQUIRED');
 assert.equal(recentlyAuthenticated(Math.floor(t/1000)-300,t),true);
 assert.equal(recentlyAuthenticated(Math.floor(t/1000)+1,t),false);
});

test('finance guard serializes admission, preserves settlements and persists across month and store recreation',async()=>{
 const {db,docs,api,store,advance}=adminFixture();
 const reserve={uid:'u',requestId:id(731)},next={uid:'v',requestId:id(732)};
 assert.equal((await store.reserveUsage(reserve)).status,200);
 const budget={period:'2026-11',current:true,publishedAt:t-1,observedCents:750,id:'1'};
 const [written,attempt]=await Promise.all([recordBudgetPush(db,budget),store.reserveUsage(next)]);
 assert.equal(written,true);
 assert.equal(attempt.status,503);
 await store.finishOutcome({...reserve,status:'failed'});
 assert.equal((await store.readCredits('u')).remaining,2);
 const restarted=createCommercialStore(db,{clock:()=>t+86400000,requireFinance:true});
 await recordBudgetPush(db,{...budget,period:'2026-12',id:'2',publishedAt:t+86400000,observedCents:20});
 assert.equal((await restarted.reserveUsage(next)).status,503);
 assert.equal(await recordBudgetPush(db,budget),false);
 assert.equal(await recordBudgetPush(db,{...budget,period:'2026-12',id:'2',publishedAt:t+86400000,observedCents:20}),false);
 assert.equal(await recordBudgetPush(db,{...budget,period:'2026-12',id:'3',publishedAt:t+80000000,observedCents:1000}),false);
 const state=docs.get(financeRef(db).name);
 assert.deepEqual(state.alerts.map(x=>x.threshold),[25,50,75]);
 const change={action:'reactivateFinance',confirmed:true,expectedVersion:state.version};
 assert.equal((await api('u',change)).status,403);
 assert.equal((await api('admin',change)).status,403);
 assert.equal((await api('owner-old',change)).body.error,'REAUTH_REQUIRED');
 assert.equal((await api('owner',{...change,confirmed:false})).status,400);
 advance(86400000);
 assert.equal((await api('owner',change)).status,200);
 assert.equal((await api('owner',change)).status,409);
 assert.equal((await restarted.reserveUsage(next)).status,200);
 assert.equal(await recordBudgetPush(db,{...budget,period:'2026-12',id:'4',publishedAt:t+86400001,observedCents:1000}),true);
 assert.equal(docs.get(financeRef(db).name).alerts.at(-1).threshold,100);
});

test('budget push rejects mismatched project subscription, account, budget, currency and period',()=>{
 const config={subscription:'projects/fixture/subscriptions/push',billingAccount:'fixture-account',budgetId:'fixture-budget'};
 const message={messageId:'180',publishTime:'2026-11-19T18:00:00Z',
  attributes:{billingAccountId:config.billingAccount,budgetId:config.budgetId,schemaVersion:'1.0'}};
 const make=(fields={})=>({subscription:config.subscription,message:{...message,
  data:Buffer.from(JSON.stringify({budgetAmount:10,budgetAmountType:'SPECIFIED_AMOUNT',
   costIntervalStart:'2026-11-01T07:00:00Z',currencyCode:'BRL',costAmount:7.5,...fields})).toString('base64')}});
 assert.equal(parseBudgetPush(make(),config,t).observedCents,750);
 for(const fields of [{currencyCode:'USD'},{budgetAmount:100},{costIntervalStart:'2026-11-02T08:00:00Z'}])
  assert.throws(()=>parseBudgetPush(make(fields),config,t));
 for(const fields of [{subscription:'projects/another/subscriptions/push'},{billingAccount:'other'},{budgetId:'other'}])
  assert.throws(()=>parseBudgetPush(make(),{...config,...fields},t));
});

test('push OIDC requires an authentic Google signature and exact issuer, account, subject and audience',async()=>{
 const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 const verifier=createPushVerifier(),now=Math.floor(Date.now()/1000);
 const config={audience:'https://backend.example.invalid',email:'push@example.invalid',subject:'123456'};
 const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
 const token=(overrides={})=>{
  const input=encode({alg:'RS256',kid:'fixture'})+'.'+encode({iss:'https://accounts.google.com',aud:config.audience,
   email:config.email,email_verified:true,sub:config.subject,exp:now+600,iat:now,...overrides});
  return input+'.'+sign('RSA-SHA256',Buffer.from(input),privateKey).toString('base64url');
 };
 const transport=async()=>Response.json({keys:[{...publicKey.export({format:'jwk'}),alg:'RS256',kid:'fixture'}]},
  {headers:{'cache-control':'max-age=600'}});
 await verifier(token(),config,transport);
 for(const fields of [{sub:'other'},{aud:'elsewhere'},{email_verified:false},{exp:now-1},{iss:'https://wrong.invalid'}])
  await assert.rejects(verifier(token(fields),config,transport));
 const forged=token().split('.').slice(0,2).join('.')+'.'+createHash('sha256').update('fixture').digest('base64url');
 await assert.rejects(verifier(forged,config,transport));
});

test('invalid requests use bounded counters and recover after one minute',()=>{
 let now=0;
 const limiter=invalidLimiter(()=>now);
 for(let i=0;i<30;i++)assert.equal(limiter.record(),i+1);
 assert.equal(limiter.blocked(),true);
 now=60000;
 assert.equal(limiter.blocked(),false);
});

test('Smart Admin authorizes active operators on every request and reserves writes for Owner',async()=>{
 const {api,docs}=adminFixture();
 const overview={action:'overview'};
 assert.equal((await api(null,overview)).status,401);
 assert.equal((await api('revoked',overview)).status,401);
 for(const user of ['u','inactive','blocked'])assert.equal((await api(user,overview)).status,403);
 assert.equal((await api('owner',overview)).body.role,'owner');
 assert.equal((await api('admin',overview)).body.role,'admin');
 const change={action:'configure',enabled:false,day:10,month:20,expectedVersion:0};
 assert.equal((await api('admin',change)).status,403);
 assert.equal((await api('owner',{...change,day:31})).status,400);
 assert.equal((await api('owner',{...change,actorUid:'admin'})).status,400);
 docs.delete('raytechV345Roles/owner');
 assert.equal((await api('owner',change)).status,403);
 assert.equal(docs.has('raytechLabCommercialGlobalV350/config'),false);
});

test('Owner configuration is atomic, versioned and suspends admission while settlement continues',async()=>{
 const {api,store,docs}=adminFixture();
 const request={uid:'u',requestId:id(500)};
 assert.equal((await store.reserveUsage(request)).status,200);
 const change={action:'configure',enabled:false,day:10,month:20,expectedVersion:0};
 const results=await Promise.all([api('owner',change),api('owner',change)]);
 assert.deepEqual(results.map(x=>x.status).sort(),[200,409]);
 assert.equal((await store.reserveUsage({uid:'v',requestId:id(501)})).status,503);
 await store.finishOutcome({...request,status:'completed'});
 const [entry]=[...docs].filter(([key])=>key.startsWith('raytechLabSmartAiAdminAuditV350/'));
 assert.equal([...docs.keys()].filter(key=>key.startsWith('raytechLabSmartAiAdminAuditV350/')).length,1);
 assert.equal(entry[1].actorUid,'owner');
 assert.equal(entry[1].before.enabled,true);
 assert.equal(entry[1].after.enabled,false);
 assert.equal(entry[1].after.version,1);
 const summary=(await api('owner',{action:'overview'})).body;
 assert.equal(summary.month.free.completed,1);
 assert.equal(summary.settings.enabled,false);
 assert.equal((await api('owner',{...change,enabled:true,day:1,expectedVersion:1})).status,200);
 assert.equal((await store.reserveUsage({uid:'v',requestId:id(502)})).error,'GLOBAL_BUDGET_EXCEEDED');
});

test('Admin searches bounded UID prefix and reads separate balances and factual plan metrics',async()=>{
 const {api,store,docs,advance}=adminFixture();
 docs.set('raytechV345Accounts/test-search',{uid:'test-search',blocked:false,plan:'free',name:'Conta fictícia',private:'excluded'});
 const search=(await api('admin',{action:'search',prefix:'test-'})).body.rows;
 assert.deepEqual(search,[{uid:'test-search',name:'Conta fictícia',plan:'free',blocked:false}]);
 assert.equal((await api('admin',{action:'search',prefix:'t'})).status,400);
 const attempt={uid:'u',requestId:id(510)};
 assert.equal((await store.reserveUsage(attempt)).status,200);
 await store.finishOutcome({...attempt,status:'completed'});
 docs.set('raytechV345Accounts/u',{uid:'u',plan:'premium',blocked:false});
 advance(60001);
 const premium={uid:'u',requestId:id(511)};
 assert.equal((await store.reserveUsage(premium)).status,200);
 const pending=(await api('admin',{action:'overview'})).body.month;
 assert.equal(pending.free.completed,1);
 assert.equal(pending.premium.pending,1);
 assert.equal(pending.conversions,1);
 await store.finishOutcome({...premium,status:'failed'});
 await store.finishOutcome({...premium,status:'failed'});
 const result=(await api('admin',{action:'overview'})).body;
 assert.equal(result.day.premium.failed,1);
 assert.equal(result.month.premium.pending,0);
 assert.equal(result.monthlyAverage,1);
 assert.equal((await api('admin',{action:'credits',uid:'u'})).body.remaining,15);
 assert.equal((await api('admin',{action:'credits',uid:'v'})).body.remaining,2);
 assert.equal((await api('v',{action:'credits',uid:'u'})).status,403);
});

test('metric recovery refunds once and corrupt metrics fail closed without quota writes',async()=>{
 const {api,store,docs,advance}=adminFixture();
 const attempt={uid:'u',requestId:id(520)};
 assert.equal((await store.reserveUsage(attempt)).status,200);
 advance(120000);
 assert.deepEqual(await Promise.all([store.recoverExpired('u'),store.recoverExpired('u')]),[true,false]);
 assert.deepEqual((await api('admin',{action:'overview'})).body.month.free,
  {reserved:1,completed:0,failed:1,pending:0});
 const key='raytechLabSmartAiMetricsV350/month_'+monthOf(t);
 const metric=docs.get(key);
 docs.set(key,{...metric,free:{...metric.free,failed:2}});
 const before=structuredClone(docs);
 assert.equal((await api('owner',{action:'overview'})).status,503);
 assert.equal((await store.reserveUsage({uid:'v',requestId:id(521)})).status,503);
 assert.deepEqual(docs,before);
});

test('simulated bridge deadline and disconnect preserve the original reservation through settlement',async()=>{
 const {createExtractionReconciliation}=await import('./integration/private-diagnostic.mjs');
 const {db,docs}=mockDb(),store=createCommercialStore(db,{clock:()=>t});
 const requestId=id(877),other=id(878),operation={uid:'u',requestId};
 const disconnected=new AbortController();
 const reservation=await store.reserveUsage(operation);
 assert.equal(reservation.status,200);
 const reconciler=createExtractionReconciliation(requestId);
 const lookup=async key=>docs.get('raytechLabCommercialV350/u/attempts/'+key)?.status;
 disconnected.abort(new DOMException('Client disconnected','AbortError'));
 assert.equal(disconnected.signal.aborted,true);
 assert.equal((await reconciler.check(requestId,lookup)).outcome,'pending');
 assert.equal((await store.reserveUsage({uid:'u',requestId:other})).error,'ACTIVE_REQUEST');
 assert.equal((await store.reserveUsage(operation)).error,'DUPLICATE_REQUEST');
 await store.finishOutcome({...operation,status:'completed'});
 assert.equal((await reconciler.check(requestId,lookup)).outcome,'completed');
 assert.equal((await store.readCredits('u')).remaining,1);
 assert.equal((await store.reserveUsage(operation)).error,'DUPLICATE_REQUEST');
 assert.equal(await lookup(other),undefined);
});
