import assert from 'node:assert/strict';
import test from 'node:test';
import {cloudBridge,firebaseAdminVerifier,bridgePrincipal,gatewayAudience} from './cloud-bridge.mjs';
import {createSmartAiTransport} from './remote-transport.mjs';
import {makeBridgeServer} from '../bridge-runtime/server.mjs';
import {FIREBASE_PROJECT} from '../projects.mjs';

const origin='https://candidate.example.test',now=Date.now(),seconds=Math.floor(now/1000);
const claims={aud:FIREBASE_PROJECT,iss:'https://securetoken.google.com/'+FIREBASE_PROJECT,
 uid:'owner-fixture',sub:'owner-fixture',iat:seconds,exp:seconds+600,auth_time:seconds-60};
const auth=verifyIdToken=>firebaseAdminVerifier({verifyIdToken},{clock:()=>now});
const route=(path,body,headers={})=>new Request(origin+path,{method:body?'POST':'GET',headers:{
 origin,authorization:'Bearer fixture-token','content-type':'application/json',
 'x-request-id':'00000000-0000-4000-8000-000000000093',...headers},body:body?JSON.stringify(body):undefined});
const encoded=aud=>'fixture.'+Buffer.from(JSON.stringify({aud,exp:seconds+600})).toString('base64url')+'.fixture';

test('Firebase adapter requires signature verification with revocation enabled and validates claims',async()=>{
 const verify=auth(async(token,revoke)=>{assert.equal(token,'fixture-token');assert.equal(revoke,true);return claims;});
 assert.deepEqual(await verify('fixture-token'),{uid:'owner-fixture',authTime:seconds-60,smartAiAdmin:false});
 for(const patch of [{aud:'foreign'},{iss:'https://wrong.example'},{sub:'someone-else'},{exp:seconds},{auth_time:seconds+1}]){
  await assert.rejects(auth(async()=>({...claims,...patch}))('fixture-token'));
 }
 for(const code of ['auth/id-token-revoked','auth/user-disabled','auth/argument-error'])
  await assert.rejects(auth(async()=>{throw Error(code);})('fixture-token'));
});

test('bridge pins gateway, validates managed identity and removes client IAM headers and remote error details',async()=>{
 for(const kind of ['valid','wrong-audience','wrong-principal','gateway-denied']){
  let upstream=0;
  const bridge=cloudBridge({origin,ownerUid:claims.uid,verifyFirebase:auth(async()=>claims),clock:()=>now,transport:async(url,opts)=>{
   if(url.endsWith('/email'))return new Response(kind==='wrong-principal'?'foreign@example.invalid':bridgePrincipal,{headers:{'metadata-flavor':'Google'}});
   if(url.startsWith('http://metadata.google.internal/')){
    assert.equal(new URL(url).searchParams.get('audience'),gatewayAudience);
    return new Response(encoded(kind==='wrong-audience'?'https://other.run.app':gatewayAudience),{headers:{'metadata-flavor':'Google'}});
   }
   upstream++;
   assert.equal(url,gatewayAudience+'/v1/credits');
   assert.equal(opts.headers.get('authorization'),'Bearer fixture-token');
   assert.equal(opts.headers.get('x-serverless-authorization'),'Bearer '+encoded(gatewayAudience));
   assert.equal(opts.headers.has('x-goog-authenticated-user-email'),false);
   if(kind==='gateway-denied')return Response.json({error:'ACCESS_DENIED',token:'private'},{status:403});
   return Response.json({plan:'free',remaining:2,busy:false,operational:'available',internal:'private'});
  }});
  const result=await bridge(route('/v1/credits',null,{'x-serverless-authorization':'attacker','x-goog-authenticated-user-email':'forged'}));
  if(kind==='valid'){assert.equal(result.status,200);assert.equal((await result.json()).internal,undefined);}
  else if(kind==='gateway-denied'){assert.equal(result.status,403);assert.deepEqual(await result.json(),{error:'ACCESS_DENIED'});}
  else{assert.equal(result.status,503);assert.equal(upstream,0);}
  assert.equal(result.headers.get('cache-control'),'no-store');
  assert.equal((await bridge(route('/internal/budget-push'))).status,404);
 }
});

test('bridge rejects stale owner login, forged roles and malformed files before requesting service identity',async()=>{
 for(const [identity,body,status] of [[{...claims,auth_time:seconds-301},{action:'reactivateFinance'},403],
  [{...claims,uid:'member',sub:'member',smartAiAdmin:true},{action:'configure'},403],
  [{...claims,uid:'member',sub:'member'},{action:'overview',role:'owner'},403],
  [claims,{action:'arbitrary'},400]]){
  const bridge=cloudBridge({origin,ownerUid:claims.uid,verifyFirebase:auth(async()=>identity),clock:()=>now,
   identity:async()=>{assert.fail('No IAM call allowed');}});
  assert.equal((await bridge(route('/v1/admin/ai',body))).status,status);
  assert.equal((await bridge(route('/v1/invoices',{feature:'invoice-ai',mimeType:'application/pdf',data:'dGVzdA=='}))).status,400);
 }
});

test('loopback runtime keeps CORS origin distinct from authorization and defaults disabled',async t=>{
 const handler=cloudBridge({origin,ownerUid:claims.uid,verifyFirebase:async()=>{throw Error('revoked');}});
 const servers=[makeBridgeServer({handler,origin}),makeBridgeServer()];
 t.after(()=>Promise.all(servers.map(server=>new Promise(resolve=>server.close(resolve)))));
 for(const server of servers)await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const [enabled,disabled]=servers.map(server=>'http://127.0.0.1:'+server.address().port+'/v1/credits');
 assert.equal((await fetch(disabled,{headers:{origin}})).status,503);
 assert.equal((await fetch(enabled,{headers:{origin:'https://wrong.invalid'}})).status,403);
 const preflight=await fetch(enabled,{method:'OPTIONS',headers:{origin,'access-control-request-method':'GET','access-control-request-headers':'authorization'}});
 assert.equal(preflight.status,204);
 assert.equal(preflight.headers.get('access-control-allow-origin'),origin);
 assert.equal((await fetch(enabled,{headers:{origin,authorization:'Bearer revoked'}})).status,401);
 assert.equal((await fetch(enabled+'?redirect=x',{headers:{origin}})).status,404);
});

test('frontend transport defaults local, fails on invalid responses and pins the remote HTTPS origin',async()=>{
 const transport=createSmartAiTransport({fetcher:async(path,options)=>{
  assert.equal(path,'/v1/credits');assert.equal(options.credentials,'omit');
  return new Response('unexpected HTML');
 }});
 await assert.rejects(transport('/v1/credits'),/INVALID_RESPONSE/);
 await assert.rejects(transport('/redirect'),/INVALID_REMOTE_OPERATION/);
 assert.throws(()=>createSmartAiTransport({remoteEnabled:true,endpoint:'https://wrong.invalid',expectedOrigin:origin}),/INVALID_BRIDGE_ORIGIN/);
 const remote=createSmartAiTransport({remoteEnabled:true,endpoint:origin,expectedOrigin:origin,fetcher:async(path,options)=>{
  assert.equal(path,origin+'/v1/credits');
  assert.equal(options.headers.has('x-serverless-authorization'),false);
  return Response.json({error:'EXPERIMENT_UNAVAILABLE'},{status:503});
 }});
 assert.equal((await remote('/v1/credits',{headers:{'x-serverless-authorization':'forged'}})).status,503);
});

test('remote transport translates unified search to the bounded directory contract',async()=>{
 const transport=createSmartAiTransport({remoteEnabled:true,endpoint:origin,expectedOrigin:origin,fetcher:async(url,options)=>{
  assert.equal(url,origin+'/v1/admin/ai');
  assert.deepEqual(JSON.parse(options.body),{action:'directory',field:'uid',term:'fixture-user',cursor:null});
  return Response.json({rows:[]});
 }});
 assert.equal((await transport('/v1/admin/ai',{method:'POST',body:JSON.stringify({action:'search',prefix:'uid:fixture-user'})})).status,200);
});
