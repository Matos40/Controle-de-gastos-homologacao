import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {assertLocalEmulators} from '../../legacy/emulator-guard.mjs';
import {createRestStore} from '../../firestore.mjs';
import {makeServer} from '../server.mjs';
import {createCloudRunHandler} from '../handler.mjs';
import {makeGateway,backendAudience} from '../gateway.mjs';

assertLocalEmulators();
const project='projects/demo-raytech-v340/databases/(default)';
const target='http://127.0.0.1:18080/v1/'+project+'/documents';
const db=(signal,transport=fetch)=>createRestStore(project,target,async()=>'owner',signal,transport,{abortedRetries:3});
const uid='fixture-reader-'+randomUUID(),owner='fixture-owner-'+randomUUID();
await db(AbortSignal.timeout(10000)).runTransaction(tx=>{
 for(const id of [uid,owner])tx.set(db().collection('raytechV345Accounts').doc(id),{uid:id,plan:'free',blocked:false});
 tx.set(db().collection('raytechV345Roles').doc(owner),{role:'owner',active:true});
});

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
 const row={title:'Compra fictícia',date:'2026-11-07',installmentValue:12,isInstallment:false,
  currentInstallment:1,installments:1,totalAmount:12};
 return Response.json({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify([row])}]}}],
  usageMetadata:{promptTokenCount:610,candidatesTokenCount:90,totalTokenCount:710,thoughtsTokenCount:10}});
};
const handler=createCloudRunHandler(transport,{
 connect:(signal,counted)=>({db:db(signal,counted),verifyToken:async token=>{
  if(token==='fixture-reader')return {uid};
  if(token==='fixture-owner')return {uid:owner};
  throw Error('SYNTHETIC_REVOKED');
 }}),writeTelemetry:event=>events.push(event),
});
const ui='https://raytech-smart-ai.example.invalid';
const env={SMART_AI_EXPERIMENT_ENABLED:'true',SMART_AI_TELEMETRY:'true',SMART_AI_UI_ORIGIN:ui,
 FIREBASE_PROJECT_ID:'gen-lang-client-0593667072',RAYTECH_GEMINI_API_KEY:providerKey};
const server=makeServer({handler,env});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const number='123456789012',audience=backendAudience(number);
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
 assert.equal(await credits(),2);
 assert.equal((await api('/v1/credits','fixture-revoked')).status,401);
 assert.equal((await reader(invoice)).status,200);
 assert.equal(await credits(),1);
 const failed=await reader(invoice);
 assert.equal(failed.status,502);
 assert.equal(failed.data.creditRefunded,true);
 assert.equal(await credits(),1);
 const summary=(await admin({action:'overview'})).data;
 assert.deepEqual(summary.month.free,{reserved:2,completed:1,failed:1,pending:0});
 assert.equal((await admin({action:'credits',uid})).data.remaining,1);
 assert.equal((await api('/v1/admin/ai','fixture-reader',{action:'overview'})).status,403);
 assert.equal((await admin({action:'configure',enabled:false,day:12,month:24,expectedVersion:0})).status,200);
 assert.equal((await reader(invoice)).status,503);
 assert.equal(providerCalls,2);
 assert.equal(await credits(),1);
 assert.ok(events.some(event=>event.inputTokens===610&&event.thinkingTokens===10&&
  event.confirmedFirestoreWrites>0&&event.requestedFirestoreReads>0));
 const serialized=JSON.stringify(events);
 for(const absent of [uid,owner,fakeInvoice,providerKey,'Compra fictícia','fixture-reader'])assert.ok(!serialized.includes(absent));
 console.log('Integração Firestore Emulator: gateway, leitor, saldo e Smart Admin com a mesma conta sintética; restituição, pausa e telemetria verificadas.');
}finally{
 await new Promise(resolve=>gateway.close(resolve));
 await new Promise(resolve=>server.close(resolve));
}
