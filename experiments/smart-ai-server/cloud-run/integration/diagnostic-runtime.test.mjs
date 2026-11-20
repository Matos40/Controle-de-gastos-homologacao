import test from 'node:test';
import assert from 'node:assert/strict';
import {createPrivateKey,createPublicKey,sign} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {once} from 'node:events';
import {makeBridgeServer} from '../bridge-runtime/server.mjs';
import {makeGateway} from '../gateway.mjs';
import {makeServer} from '../server.mjs';
import {BACKEND_AUDIENCE,FIREBASE_PROJECT,RUNTIME_IDENTITY} from '../projects.mjs';
import {bridgePrincipal,gatewayAudience} from './cloud-bridge.mjs';
import {diagnosticPath} from './private-diagnostic.mjs';

// An isolated test key and cert. No runtime or service accepts this key outside this fixture.
const key=createPrivateKey(readFileSync(new URL('./diagnostic-test-key.pem',import.meta.url)));
const certificate=readFileSync(new URL('./diagnostic-test-cert.pem',import.meta.url),'utf8');
const jwk={...createPublicKey(key).export({format:'jwk'}),kid:'fixture',alg:'RS256'};
const bridgeAudience=gatewayAudience.replace('-gateway-','-bridge-');
const gatewayPrincipal='raytech-ai-gateway@raytech-3d.iam.gserviceaccount.com';
const client='raytech-smart-ai-diagnostic@raytech-3d.iam.gserviceaccount.com';
const subjects={[client]:'101',[bridgePrincipal]:'102',[gatewayPrincipal]:'103'};
const uid='synthetic-user';
const authTime=Math.floor(Date.now()/1000)-20;
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
function jwt(claims){
 const data=encode({alg:'RS256',kid:'fixture'})+'.'+encode({
  iat:authTime,exp:authTime+600,...claims,
 });
 return data+'.'+sign('RSA-SHA256',Buffer.from(data),key).toString('base64url');
}
const firebase=jwt({aud:FIREBASE_PROJECT,iss:'https://securetoken.google.com/'+FIREBASE_PROJECT,auth_time:authTime,sub:uid});
const serviceToken=(email,aud)=>jwt({iss:'https://accounts.google.com',aud,email,email_verified:true,sub:subjects[email]});

async function chain(t,enabled){
 const endpoints=new Map(),lookups=[],hops=[],unexpected=[];
 let validSince=authTime,budgetCalls=0;
 const transport=principal=>async(url,init)=>{
  const target=new URL(url);
  if(endpoints.has(target.origin)){
   hops.push(target.origin);
   return fetch(endpoints.get(target.origin)+target.pathname,init);
  }
  if(target.origin==='http://metadata.google.internal'){
   const headers={'metadata-flavor':'Google'};
   if(target.pathname.endsWith('/identity'))return new Response(serviceToken(principal,target.searchParams.get('audience')),{headers});
   if(target.pathname.endsWith('/email'))return new Response(principal,{headers});
   if(target.pathname.endsWith('/token'))return Response.json({access_token:'synthetic-access-token',expires_in:3600,token_type:'Bearer'},{headers});
  }
  if(target.pathname==='/oauth2/v3/certs')return Response.json({keys:[jwk]});
  if(target.hostname==='www.googleapis.com'&&target.pathname.includes('/x509/'))return Response.json({fixture:certificate});
  if(target.hostname==='identitytoolkit.googleapis.com'&&target.pathname.endsWith('/accounts:lookup')){
   lookups.push(principal);
   assert.deepEqual(JSON.parse(init.body),{localId:[uid]});
   return Response.json({users:[{localId:uid,validSince}]});
  }
  unexpected.push(target.origin);
  throw Error('UNEXPECTED_EXTERNAL_CALL');
 };
 const env=principal=>({SMART_AI_DIAGNOSTIC_CALLER_SUB:subjects[principal],
  ...(enabled?{SMART_AI_PRIVATE_DIAGNOSTIC_ENABLED:'true'}:{}),SMART_AI_FINANCE_PUSH_ENABLED:'true'});
 const servers=[
  [bridgeAudience,makeBridgeServer({env:env(client),diagnosticTransport:transport(bridgePrincipal)})],
  [gatewayAudience,makeGateway({env:env(bridgePrincipal),transport:transport(gatewayPrincipal)})],
  [BACKEND_AUDIENCE,makeServer({env:env(gatewayPrincipal),diagnosticTransport:transport(RUNTIME_IDENTITY),
   handler:{async fetch(request){assert.equal(new URL(request.url).pathname,'/internal/budget-push');budgetCalls++;return new Response(null,{status:204});}}})],
 ];
 for(const [audience,server] of servers){
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  endpoints.set(audience,'http://127.0.0.1:'+server.address().port);
 }
 const call=({audience=bridgeAudience,path=diagnosticPath,method='GET',proof=serviceToken(client,bridgeAudience),token=firebase,headers={}}={})=>
  fetch(endpoints.get(audience)+path,{method,headers:{authorization:'Bearer '+token,'x-raytech-diagnostic-proof':'Bearer '+proof,...headers}});
 return {call,hops,lookups,unexpected,revoke(){validSince++;},get budgetCalls(){return budgetCalls;}};
}

test('real HTTP entrypoints default to disabled; budget-push remains separately routed',async t=>{
 const h=await chain(t,false);
 for(const audience of [bridgeAudience,gatewayAudience,BACKEND_AUDIENCE])assert.equal((await h.call({audience})).status,503);
 assert.equal((await h.call({audience:BACKEND_AUDIENCE,path:'/internal/budget-push',method:'POST'})).status,204);
 assert.equal(h.budgetCalls,1);
 assert.deepEqual(h.lookups,[]);
});

test('private flag alone enables all three HTTP hops with signed identities and no commercial calls',async t=>{
 const h=await chain(t,true);
 const response=await h.call();
 assert.equal(response.status,200);
 assert.deepEqual(await response.json(),{status:'ok',mode:'diagnostic',provider:'none'});
 assert.deepEqual(h.hops,[gatewayAudience,BACKEND_AUDIENCE]);
 assert.deepEqual(h.lookups,[bridgePrincipal,gatewayPrincipal,RUNTIME_IDENTITY]);
 for(const audience of [bridgeAudience,gatewayAudience,BACKEND_AUDIENCE])
  assert.equal((await h.call({audience,path:'/v1/credits'})).status,503);
 assert.equal(h.budgetCalls,0);
 assert.deepEqual(h.unexpected,[]);
});

test('HTTP chain rejects malformed requests, forged identities, wrong audience and revoked Firebase',async t=>{
 const h=await chain(t,true);
 assert.equal((await h.call({path:diagnosticPath+'?target=other'})).status,404);
 assert.equal((await h.call({method:'POST'})).status,405);
 assert.equal((await h.call({headers:{'x-goog-authenticated-user-email':client}})).status,400);
 assert.equal((await h.call({headers:{'x-raytech-caller':client}})).status,400);
 assert.equal((await h.call({proof:serviceToken(client,BACKEND_AUDIENCE)})).status,403);
 assert.equal((await h.call({proof:serviceToken(gatewayPrincipal,bridgeAudience)})).status,403);
 const proof=serviceToken(client,bridgeAudience);
 assert.equal((await h.call({proof:proof.replace(/\.[^.]+$/,'.AAAA')})).status,403);
 assert.equal((await h.call({audience:BACKEND_AUDIENCE,proof:serviceToken(client,BACKEND_AUDIENCE)})).status,403);
 assert.equal((await h.call({token:'invalid'})).status,401);
 h.revoke();
 assert.equal((await h.call()).status,401);
 assert.deepEqual(h.hops,[]);
 assert.deepEqual(h.unexpected,[]);
 assert.equal(h.budgetCalls,0);
});
