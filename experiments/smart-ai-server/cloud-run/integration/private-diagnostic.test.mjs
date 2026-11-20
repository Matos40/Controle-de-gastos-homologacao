import assert from 'node:assert/strict';
import test from 'node:test';
import {probeLocalCredits,assessInterruptedExtraction} from './private-diagnostic.mjs';
import {cloudBridge,gatewayAudience} from './cloud-bridge.mjs';
import {makeBridgeServer} from '../bridge-runtime/server.mjs';

test('loopback probe observes the bridge contract without exposing token, balance or upstream headers',async t=>{
 const origin='https://candidate.example.test';
 const handler=cloudBridge({origin,ownerUid:'fixture-owner',
  verifyFirebase:async token=>{
   if(token!=='fixture-user-token')throw Error('INVALID_TOKEN');
   return {uid:'fixture-user'};
  },
  identity:async()=> 'fixture.iam.token',
  transport:async(url,options)=>{
   assert.equal(url,gatewayAudience+'/v1/credits');
   assert.equal(options.headers.get('authorization'),'Bearer fixture-user-token');
   assert.equal(options.headers.get('x-serverless-authorization'),'Bearer fixture.iam.token');
   return Response.json({plan:'free',remaining:2,busy:false});
  }});
 const server=makeBridgeServer({handler,origin});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const endpoint='http://127.0.0.1:'+server.address().port;
 const result=await probeLocalCredits({endpoint,origin,token:'fixture-user-token'});
 assert.equal(result.outcome,'credits_verified');
 assert.deepEqual(Object.keys(result),['outcome','status','elapsedMs']);
 assert.equal((await probeLocalCredits({endpoint,origin,token:'revoked-fixture'})).status,401);
 assert.equal((await probeLocalCredits({endpoint,origin:'https://wrong.example.test'})).status,403);
 await assert.rejects(probeLocalCredits({endpoint:'https://example.test',origin}),/LOOPBACK_REQUIRED/);
});

test('timeouts keep the extraction outcome unknown until the authoritative ledger settles',()=>{
 const requestId='00000000-0000-4000-8000-000000000011';
 for(const [ledgerStatus,outcome,action] of [[undefined,'unknown','reconcile_before_retry'],
  ['pending','pending','wait_for_settlement'],['completed','completed','refresh_balance'],['failed','failed','refresh_balance']]){
  assert.deepEqual(assessInterruptedExtraction({requestId,ledgerStatus}),{requestId,outcome,action});
 }
 assert.throws(()=>assessInterruptedExtraction({requestId:'invalid'}),/REQUEST_ID_REQUIRED/);
});

test('diagnostic distinguishes timeout, unavailable service and malformed successful payload',async()=>{
 const endpoint='http://127.0.0.1:8785',origin='https://candidate.example.test';
 const probe=fetcher=>probeLocalCredits({endpoint,origin,fetcher,timeoutMs:20});
 assert.equal((await probe(async()=>Response.json({plan:'premium',remaining:16,busy:false}))).outcome,'invalid_response');
 assert.equal((await probe(async()=>Response.json({error:'EXPERIMENT_UNAVAILABLE'},{status:503}))).outcome,'service_unavailable');
 const keepAlive=setTimeout(()=>{},200);
 try{
  const result=await probe((_,{signal})=>new Promise((resolve,reject)=>{
   signal.addEventListener('abort',()=>reject(signal.reason),{once:true});
  }));
  assert.equal(result.outcome,'deadline');
  assert.equal(result.status,null);
 }finally{clearTimeout(keepAlive);}
});

test('isolated diagnostic traverses three independently authenticated hops with no invoice endpoint',async()=>{
 const {createPrivateDiagnostic,diagnosticPath}=await import('./private-diagnostic.mjs');
 const url='https://private.example.test'+diagnosticPath;
 const calls=[];
 const verifyFirebase=async token=>{
  assert.equal(token,'firebase-fixture');
  return {uid:'fixture-user'};
 };
 const backend=createPrivateDiagnostic({enabled:true,expectedCaller:'gateway',verifyFirebase});
 const next=(service,caller)=>async(path,options)=>{
  calls.push(caller);
  assert.equal(path,diagnosticPath);
  assert.equal(options.headers.has('x-serverless-authorization'),false);
  assert.equal(options.headers.has('x-caller'),false);
  return service(new Request(url,options),caller);
 };
 const gateway=createPrivateDiagnostic({enabled:true,expectedCaller:'bridge',verifyFirebase,forward:next(backend,'gateway')});
 const bridge=createPrivateDiagnostic({enabled:true,expectedCaller:'client',verifyFirebase,forward:next(gateway,'bridge')});
 const request=new Request(url,{headers:{authorization:'Bearer firebase-fixture','x-caller':'client','x-serverless-authorization':'forged'}});
 assert.equal((await bridge(request,'wrong-client')).status,403);
 assert.equal((await createPrivateDiagnostic()(request,'client')).status,503);
 assert.deepEqual(calls,[]);
 const response=await bridge(request,'client');
 assert.equal(response.status,200);
 assert.deepEqual(await response.json(),{status:'ok',mode:'diagnostic',provider:'none'});
 assert.deepEqual(calls,['bridge','gateway']);
 assert.equal((await backend(request,'client')).status,403);
 assert.equal((await bridge(new Request(url,{method:'POST'}),'client')).status,405);
 assert.equal((await bridge(new Request(url+'?target=forged'),'client')).status,404);
});

test('reconciliation queries only the original operation and never writes or retries on timeout',async()=>{
 const {createExtractionReconciliation}=await import('./private-diagnostic.mjs');
 const original='00000000-0000-4000-8000-000000000011';
 const other='00000000-0000-4000-8000-000000000012';
 const reconciliation=createExtractionReconciliation(original);
 const queries=[];
 let state;
 const lookup=async id=>{queries.push(id);return state;};
 await assert.rejects(reconciliation.check(other,lookup),/REQUEST_ID_CHANGED/);
 assert.deepEqual(queries,[]);
 for(const value of [undefined,'pending','completed']){
  state=value;
  assert.equal((await reconciliation.check(original,lookup)).outcome,value??'unknown');
 }
 assert.deepEqual(queries,[original,original,original]);
});
