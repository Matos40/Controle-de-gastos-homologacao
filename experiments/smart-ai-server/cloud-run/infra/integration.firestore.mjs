import {cloudBridge,gatewayAudience} from '../integration/cloud-bridge.mjs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {assertLocalEmulators} from '../../legacy/emulator-guard.mjs';
import {createRestStore} from '../../firestore.mjs';
import {makeServer} from '../server.mjs';
import {createCloudRunHandler} from '../handler.mjs';
import {makeGateway,backendAudience} from '../gateway.mjs';
import {createCommercialStore} from '../store.mjs';
import {parseBudgetPush,recordBudgetPush} from '../finance-guard.mjs';

assertLocalEmulators();
const project='projects/demo-raytech-v340/databases/(default)';
const target='http://127.0.0.1:18080/v1/'+project+'/documents';
const db=(signal,transport=fetch)=>createRestStore(project,target,async()=>'owner',signal,transport,{abortedRetries:3});
const uid='fixture-reader-'+randomUUID(),owner='fixture-owner-'+randomUUID();
const signup=await fetch('http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake',{
 method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({returnSecureToken:true}),
});
assert.equal(signup.status,200);
const {idToken,localId}=await signup.json();
const maliciousWrites=[
 ['raytechV345Accounts/'+localId,{plan:{stringValue:'premium'}}],
 ['raytechV345Roles/'+localId,{role:{stringValue:'owner'}}],
 ['raytechLabCommercialV350/'+localId,{free:{integerValue:'0'}}],
 ['raytechLabCommercialGlobalV350/config',{enabled:{booleanValue:true}}],
 ['raytechLabCommercialGlobalV350/financeGuard',{suspended:{booleanValue:false}}],
 ['raytechV345Accounts/'+owner,{blocked:{booleanValue:true}}],
];
for(const [path,fields] of maliciousWrites){
 const denied=await fetch(target+'/'+path,{method:'PATCH',headers:{authorization:'Bearer '+idToken,'content-type':'application/json'},
  body:JSON.stringify({fields})});
 assert.equal(denied.status,403,path);
}
await db(AbortSignal.timeout(10000)).runTransaction(tx=>{
 for(const id of [uid,owner])tx.set(db().collection('raytechV345Accounts').doc(id),{uid:id,plan:'free',blocked:false});
 tx.set(db().collection('raytechV345Roles').doc(owner),{role:'owner',active:true});
});
const removeOwner=await fetch(target+'/raytechV345Roles/'+owner,{method:'DELETE',headers:{authorization:'Bearer '+idToken}});
assert.equal(removeOwner.status,403);

const fakeInvoice=Buffer.from('%PDF-1.4\n% private-synthetic-marker\n%%EOF\n').toString('base64');
const providerKey='synthetic-provider-key';
let providerCalls=0;
const events=[];
const transport=async(url,options)=>{
 if(url.startsWith(target+':'))return fetch(url,options);
 assert.equal(url,'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent');
 assert.equal(options.headers['x-goog-api-key'],providerKey);
 assert.equal(JSON.parse(options.body).contents[0].parts[0].inlineData.data,fakeInvoice);
 providerCalls++;
 if(providerCalls===2)return new Response(null,{status:503});
 const row={kind:'PURCHASE',title:'Compra fictícia',date:'2026-11-07',amountCents:1200,
  currentInstallment:null,installments:null};
 const statement={entries:[row],statementTotalCents:1200,priorBalanceCents:null,priorPaymentsCents:null,balanceBasis:'ACTIVITY_ONLY'};
 return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(statement)}]}}],
  usageMetadata:{promptTokenCount:610,candidatesTokenCount:90,totalTokenCount:710,thoughtsTokenCount:10}});
};
const handler=createCloudRunHandler(transport,{
 verifyPush:async token=>{if(token!=='fixture-budget-push')throw Error('INVALID_PUSH_IDENTITY');},
 connect:(signal,counted)=>({db:db(signal,counted),verifyToken:async token=>{
  if(token==='fixture-reader')return {uid};
  if(token==='fixture-owner')return {uid:owner,authTime:Math.floor(Date.now()/1000)};
  throw Error('SYNTHETIC_REVOKED');
 }}),writeTelemetry:event=>events.push(event),
});
const ui='https://raytech-smart-ai.example.invalid';
const env={SMART_AI_EXPERIMENT_ENABLED:'true',SMART_AI_TELEMETRY:'true',SMART_AI_UI_ORIGIN:ui,SMART_AI_OWNER_UID:owner,
 SMART_AI_FINANCE_PUSH_ENABLED:'true',SMART_AI_PUSH_AUDIENCE:backendAudience('761761828111'),SMART_AI_PUSH_SUBJECT:'111222333',
 SMART_AI_BILLING_ACCOUNT_ID:'synthetic-account',SMART_AI_BUDGET_ID:'synthetic-budget',
 FIREBASE_PROJECT_ID:'gen-lang-client-0593667072',RAYTECH_GEMINI_API_KEY:providerKey};
const server=makeServer({handler,env});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const number='761761828111',audience=backendAudience(number);
const gateway=makeGateway({env:{SMART_AI_GATEWAY_ENABLED:'true',SMART_AI_UI_ORIGIN:ui,SMART_AI_COMPUTE_PROJECT_NUMBER:number},
 verifySignature:async token=>{
  if(!['fixture-reader','fixture-owner','fixture-revoked'].includes(token))throw Error('INVALID_FIXTURE');
 },
 identity:async target=>{assert.equal(target,audience);return 'fixture.oidc.token';},
 transport:(url,options)=>{
  assert.ok(url.startsWith(audience+'/v1/'));
  assert.equal(options.headers['x-serverless-authorization'],'Bearer fixture.oidc.token');
  return fetch('http://127.0.0.1:'+server.address().port+new URL(url).pathname,options);
 },
});
await new Promise(resolve=>gateway.listen(0,'127.0.0.1',resolve));
try{
 const base='http://127.0.0.1:'+gateway.address().port;
 const api=async(path,token,body,extra={})=>{
  const response=await fetch(base+path,{method:body?'POST':'GET',headers:{
   origin:ui,authorization:'Bearer '+token,...(body?{'content-type':'application/json'}:{}),...extra,
  },body:body?JSON.stringify(body):undefined});
  assert.equal(response.headers.get('access-control-allow-origin'),ui);
  return {status:response.status,data:await response.json()};
 };
 const reader=(body,requestId=randomUUID())=>api('/v1/invoices','fixture-reader',body,{'x-request-id':requestId});
 const credits=async()=>(await api('/v1/credits','fixture-reader')).data.remaining;
 const admin=body=>api('/v1/admin/ai','fixture-owner',body);
 const invoice={feature:'invoice-ai',mimeType:'application/pdf',data:fakeInvoice};
 const bridged=cloudBridge({origin:ui,ownerUid:owner,verifyFirebase:async token=>{
  if(token!=='fixture-reader')throw Error('REVOKED');
  return {uid};
 },identity:async()=> 'fixture.bridge.token',transport:(url,options)=>{
  assert.ok(url.startsWith(gatewayAudience+'/v1/'));
  assert.equal(options.headers.get('x-serverless-authorization'),'Bearer fixture.bridge.token');
  options.headers.delete('x-serverless-authorization');
  return fetch(base+new URL(url).pathname,options);
 }});
 const probe=(path,body)=>bridged(new Request(ui+path,{method:body?'POST':'GET',headers:{origin:ui,
  authorization:'Bearer fixture-reader','content-type':'application/json','x-request-id':randomUUID()},
  body:body?JSON.stringify(body):undefined}));
 assert.equal((await (await probe('/v1/credits')).json()).remaining,2);
 assert.equal(await credits(),2);
 assert.equal((await api('/v1/credits','fixture-revoked')).status,401);
 const firstInvoice=await probe('/v1/invoices',invoice);
 assert.equal(firstInvoice.status,200);
 const parsed=await firstInvoice.json();
 assert.equal(parsed.requiresReview,true);
 assert.equal(parsed.reconciliation.differenceCents,0);
 assert.equal(parsed.metrics,undefined);
 assert.equal(await credits(),1);
 const failed=await reader(invoice);
 assert.equal(failed.status,502);
 assert.equal(failed.data.creditRefunded,true);
 assert.equal(await credits(),1);
 const summary=(await admin({action:'overview'})).data;
 assert.deepEqual(summary.month.free,{reserved:2,completed:1,failed:1,pending:0});
 assert.equal((await admin({action:'credits',uid})).data.remaining,1);
 assert.equal((await api('/v1/admin/ai','fixture-reader',{action:'overview'})).status,403);
 const directory=db(AbortSignal.timeout(18000));
 await directory.runTransaction(tx=>{
  for(let i=0;i<12;i++){
   const uid='directory-fixture-'+String(i).padStart(2,'0');
   tx.set(directory.collection('raytechLabAdminDirectoryV350').doc(uid),
    {uid,label:'Perfil '+i,nameKey:'perfil sintético',emailKey:uid+'@example.invalid'});
  }
 });
 const first=await admin({action:'directory',field:'name',term:'Perfil sintético',cursor:null});
 assert.equal(first.status,200);
 assert.equal(first.data.rows.length,10);
 const last=await admin({action:'directory',field:'name',term:'perfil sintético',cursor:first.data.nextCursor});
 assert.equal(last.data.rows.length,2);
 assert.equal(last.data.nextCursor,null);
 assert.ok(last.data.rows.every(row=>!first.data.rows.some(previous=>previous.uid===row.uid)));
 for(const [field,term] of [['email','directory-fixture-00@example.invalid'],['uid','directory-fixture-00']]){
  const result=await admin({action:'directory',field,term,cursor:null});
  assert.deepEqual(result.data.rows,[{uid:'directory-fixture-00',name:'Perfil 0'}]);
 }
 assert.equal((await api('/v1/admin/ai','fixture-reader',{action:'directory',field:'name',term:'perfil',cursor:null})).status,403);
 for(let i=0;i<2;i++)assert.equal((await admin({action:'directory',field:'name',term:'perfil',cursor:null})).status,200);
 assert.equal((await admin({action:'directory',field:'name',term:'perfil',cursor:null})).status,429);
 console.log('Diretório sintético: nome, e-mail, UID, paginação, minimização e limite distribuído verificados.');
 const current=new Date(),pacific=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit'}).format(current);
 const event={subscription:'projects/raytech-3d/subscriptions/raytech-budget-push',message:{
  messageId:'507',publishTime:current.toISOString(),attributes:{schemaVersion:'1.0',billingAccountId:'synthetic-account',budgetId:'synthetic-budget'},
 }};
 for(const offset of ['07','08']){
  event.message.data=Buffer.from(JSON.stringify({budgetAmount:10,budgetAmountType:'SPECIFIED_AMOUNT',currencyCode:'BRL',
   costAmount:7.5,costIntervalStart:pacific+'-01T'+offset+':00:00Z'})).toString('base64');
  const response=await fetch('http://127.0.0.1:'+server.address().port+'/internal/budget-push',{method:'POST',
   headers:{authorization:'Bearer fixture-budget-push','content-type':'application/json'},body:JSON.stringify(event)});
  if(response.ok)break;
  assert.equal(response.status,400);
 }
 const {finance}= (await admin({action:'overview'})).data;
 assert.equal(finance.suspended,true);
 assert.equal((await reader(invoice)).status,503);
 assert.equal((await admin({action:'reactivateFinance',confirmed:true,expectedVersion:finance.version})).status,200);
 const ledger=db(AbortSignal.timeout(18000)),store=createCommercialStore(ledger);
 const existing={uid:owner,requestId:randomUUID()};
 assert.equal((await store.reserveUsage(existing)).status,200);
 const config={subscription:event.subscription,budgetId:'synthetic-budget',billingAccount:'synthetic-account'};
 const next=parseBudgetPush(event,config,Date.now());
 const trialUid='fixture-race-'+randomUUID();
 const attempt={uid:trialUid,requestId:randomUUID()};
 await ledger.runTransaction(tx=>tx.set(ledger.collection('raytechV345Accounts').doc(trialUid),
  {uid:trialUid,blocked:false,plan:'free'}));
 const [applied,race]=await Promise.all([
  recordBudgetPush(ledger,{...next,id:'508',publishedAt:next.publishedAt+1,observedCents:1000}),
  store.reserveUsage(attempt),
 ]);
 assert.equal(applied,true);
 assert.ok([200,503].includes(race.status));
 assert.equal((await createCommercialStore(ledger).reserveUsage({uid:trialUid,requestId:randomUUID()})).status,503);
 await store.finishOutcome({...existing,status:'completed'});
 if(race.status===200)await store.finishOutcome({...attempt,status:'failed'});
 const latest=(await admin({action:'overview'})).data.finance;
 assert.equal(latest.alerts.at(-1).threshold,100);
 assert.equal((await admin({action:'reactivateFinance',confirmed:true,expectedVersion:latest.version})).status,200);
 assert.equal((await admin({action:'configure',enabled:false,day:12,month:24,expectedVersion:0})).status,200);
 assert.equal((await reader(invoice)).status,503);
 assert.equal(providerCalls,2);
 assert.equal(await credits(),1);
 assert.ok(events.some(event=>event.inputTokens===610&&event.thinkingTokens===10&&
  event.confirmedFirestoreWrites>0&&event.requestedFirestoreReads>0));
 const serialized=JSON.stringify(events);
 for(const absent of [uid,owner,fakeInvoice,providerKey,'Compra fictícia','fixture-reader'])assert.ok(!serialized.includes(absent));
 console.log('Firestore Emulator: escritas de cliente negadas, suspensão e reserva concorrentes, liquidação, reativação e preservação da integração verificadas.');
}finally{
 await new Promise(resolve=>gateway.close(resolve));
 await new Promise(resolve=>server.close(resolve));
}
