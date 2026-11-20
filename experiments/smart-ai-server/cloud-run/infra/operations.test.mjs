import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {inflateSync} from 'node:zlib';
import {backendAudience,makeGateway,requestIdentity} from '../gateway.mjs';
import {makeServer} from '../server.mjs';
import {createCloudRunHandler} from '../handler.mjs';
import {decodeInvoice} from '../invoice.mjs';
import {prepare} from './prepare.mjs';
import {invoices} from './fixtures.mjs';
import {operationalCost} from './operational-cost.mjs';
import {scenarios} from './cost.mjs';

const origin='https://smart-ai.example.invalid',number='761761828111';
const audience=backendAudience(number);
const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const close=server=>new Promise(resolve=>server.close(resolve));
const url=server=>'http://127.0.0.1:'+server.address().port;
const pngMagic=Buffer.from([137,80,78,71,13,10,26,10]);

test('offline rendering pins compute project, immutable image, VPC and disabled manifests',async()=>{
 const input={projectNumber:number,origin,secretVersion:'7',
  image:'us-central1-docker.pkg.dev/raytech-3d/raytech-smart-ai/candidate@sha256:'+'f'.repeat(64)};
 const {backend,gateway,resources,iam,monitoring}=await prepare(input);
 assert.equal(backend.metadata.namespace,number);
 assert.equal(backend.metadata.annotations['run.googleapis.com/ingress'],'internal');
 assert.equal(resources.applyAuthorized,false);
 assert.equal(resources.projectId,'raytech-3d');
 assert.equal(resources.projectNumber,number);
 assert.equal(iam.applyAuthorized,false);
 assert.equal(monitoring.applyAuthorized,false);
 assert.equal(monitoring.computeProject,'raytech-3d');
 assert.equal(iam.firebaseProject,'gen-lang-client-0593667072');
 assert.equal(resources.firebaseProject,'gen-lang-client-0593667072');
 assert.equal(resources.network.privateGoogleAccess,true);
 assert.equal(resources.secretManager.gatewayAccess,false);
 assert.deepEqual(resources.budget.thresholdRules.map(row=>row.thresholdPercent),[0.25,0.5,0.75,1]);
 assert.deepEqual(resources.budget.amount.specifiedAmount,{currencyCode:'BRL',units:'10'});
 assert.deepEqual(resources.budget.budgetFilter.projects,['projects/'+number]);
 for(const service of [backend,gateway]){
  const {spec}=service.spec.template;
  assert.equal(spec.containerConcurrency,1);
  assert.deepEqual(spec.containers[0].resources.limits,{cpu:'1',memory:'512Mi'});
  assert.equal(spec.containers[0].env.find(row=>row.name.endsWith('_ENABLED')).value,'false');
 }
 assert.equal(gateway.spec.template.metadata.annotations['run.googleapis.com/vpc-access-egress'],'all-traffic');
 await assert.rejects(prepare({...input,image:'image:latest'}));
 await assert.rejects(prepare({...input,origin:'http://example.invalid'}));
 await assert.rejects(prepare({...input,secretVersion:'latest'}));
});

test('renderer rejects a different compute target, registry or official app origin',async()=>{
 const image='us-central1-docker.pkg.dev/raytech-3d/raytech-smart-ai/candidate@sha256:'+'a'.repeat(64);
 const fixed={projectNumber:number,origin,secretVersion:'1',image};
 for(const invalid of [{projectNumber:'123456789012'},{projectId:'raytech-cg-producao'},
  {projectId:'gen-lang-client-0593667072'},{image:image.replace('raytech-3d','raytech-cg-homologacao')},
  {origin:'https://matos40.github.io'},{origin:'https://raytech-cg-homologacao.web.app'},
  {origin:'https://raytech-3d.web.app'}])await assert.rejects(prepare({...fixed,...invalid}),/INVALID_ISOLATED_INPUTS/);
});

test('disabled manifests pin IAM identities, private audience and a dormant finance guard',async()=>{
 const {backend,gateway,resources,iam}=await prepare({projectNumber:number,origin,secretVersion:'1',
  image:'us-central1-docker.pkg.dev/raytech-3d/raytech-smart-ai/candidate@sha256:'+'a'.repeat(64)});
 assert.equal(audience,'https://raytech-smart-ai-exp-761761828111.us-central1.run.app');
 assert.equal(backend.spec.template.spec.serviceAccountName,'raytech-ai-runtime@raytech-3d.iam.gserviceaccount.com');
 assert.equal(gateway.spec.template.spec.serviceAccountName,'raytech-ai-gateway@raytech-3d.iam.gserviceaccount.com');
 assert.equal(iam.invoker.public,false);
 assert.equal(resources.budgetPush.enabled,false);
 assert.equal(resources.budgetPush.audience,audience);
 assert.equal(resources.budgetPush.subscription,'projects/raytech-3d/subscriptions/raytech-budget-push');
 assert.throws(()=>backendAudience('123456789012'));
 for(const service of [backend,gateway])assert.equal(service.metadata.annotations['run.googleapis.com/invoker-iam-disabled'],'false');
});

test('backend rejects authentication projects outside the isolated Firebase before accessing credentials',async()=>{
 const noNetwork=()=>assert.fail('external access attempted');
 const handler=createCloudRunHandler(noNetwork,{connect:noNetwork});
 for(const id of ['raytech-3d','raytech-cg-producao','raytech-cg-homologacao']){
  const response=await handler.fetch(new Request('https://synthetic.invalid/v1/credits'),{FIREBASE_PROJECT_ID:id});
  assert.equal(response.status,503);
  assert.equal((await response.json()).error,'EXPERIMENT_UNAVAILABLE');
 }
});

test('gateway metadata credential is minted for the exact internal service audience',async()=>{
 const token=await requestIdentity(audience,async(address,options)=>{
  const parsed=new URL(address);
  assert.equal(parsed.hostname,'metadata.google.internal');
  assert.equal(parsed.searchParams.get('audience'),audience);
  assert.equal(options.redirect,'manual');
  assert.equal(options.headers['Metadata-Flavor'],'Google');
  return new Response('synthetic.oidc.token',{headers:{'Metadata-Flavor':'Google'}});
 });
 assert.equal(token,'synthetic.oidc.token');
 assert.throws(()=>backendAudience('https://elsewhere.invalid'));
 await assert.rejects(requestIdentity(audience,async()=>new Response('synthetic.oidc.token')));
});

test('local browser-to-gateway-to-backend contract keeps Firebase and service credentials separate',async()=>{
 let minted=0,forwarded=0;
 const backend=makeServer({env:{SMART_AI_EXPERIMENT_ENABLED:'true',SMART_AI_UI_ORIGIN:origin},
  handler:{fetch:async request=>{
   forwarded++;
   assert.equal(request.headers.get('authorization'),'Bearer fixture-firebase');
   assert.equal(request.headers.get('x-serverless-authorization'),'Bearer synthetic.oidc.token');
   assert.equal(request.headers.get('cookie'),null);
   const path=new URL(request.url).pathname;
   if(path==='/v1/invoices')assert.equal((await request.json()).feature,'invoice-ai');
   return Response.json({ok:true});
  }}});
 await listen(backend);
 const gateway=makeGateway({env:{SMART_AI_GATEWAY_ENABLED:'true',SMART_AI_COMPUTE_PROJECT_NUMBER:number,SMART_AI_UI_ORIGIN:origin},
  verifySignature:async token=>{if(token!=='fixture-firebase')throw Error('INVALID');},
  identity:async target=>{assert.equal(target,audience);minted++;return 'synthetic.oidc.token';},
  transport:async(target,options)=>{
   assert.ok(target.startsWith(audience+'/v1/'));
   assert.equal(options.redirect,'manual');
   return fetch(url(backend)+new URL(target).pathname,options);
  }});
 await listen(gateway);
 try{
  const reader=url(gateway)+'/v1/invoices';
  assert.equal((await fetch(reader,{method:'POST',headers:{origin},body:'{}'})).status,401);
  assert.equal((await fetch(reader,{method:'POST',headers:{origin:'https://other.invalid'},body:'{}'})).status,403);
  const preflight=await fetch(reader,{method:'OPTIONS',headers:{origin,
   'access-control-request-method':'POST','access-control-request-headers':'authorization,content-type,x-request-id'}});
  assert.equal(preflight.status,204);
  assert.equal(preflight.headers.get('access-control-allow-origin'),origin);
  assert.equal(minted,0);
  for(const [path,body] of [['/v1/credits'],['/v1/invoices',{feature:'invoice-ai'}],['/v1/admin/ai',{action:'overview'}]]){
   const response=await fetch(url(gateway)+path,{method:body?'POST':'GET',headers:{
    origin,authorization:'Bearer fixture-firebase','x-serverless-authorization':'Bearer spoof.test.token',
    'content-type':'application/json','x-request-id':randomUUID(),cookie:'unused=fixture',
   },body:body?JSON.stringify(body):undefined});
   assert.equal(response.status,200);
   assert.equal(response.headers.has('x-serverless-authorization'),false);
   assert.deepEqual(await response.json(),{ok:true});
  }
  assert.equal(minted,3);
  assert.equal(forwarded,3);
 }finally{await close(gateway);await close(backend);}
});

test('eight deterministic generated fixtures survive the invoice contract at their exact sizes',()=>{
 const observed=[];
 for(const {mimeType,bytes,sha256} of invoices()){
  const data=decodeInvoice({feature:'invoice-ai',mimeType,data:bytes.toString('base64')});
  assert.ok(data.bytes.equals(bytes));
  if(mimeType==='image/png'){
   assert.ok(bytes.subarray(0,8).equals(pngMagic));
   const length=bytes.readUInt32BE(33);
   assert.equal(bytes.toString('ascii',37,41),'IDAT');
   const pixels=inflateSync(bytes.subarray(41,41+length));
   assert.equal(pixels.length,(bytes.readUInt32BE(16)+1)*bytes.readUInt32BE(20));
   assert.ok(pixels.subarray(2).includes(255));
  }else{
   const index=Number(bytes.subarray(-80).toString().match(/startxref\n(\d+)/)?.[1]);
   assert.equal(bytes.toString('ascii',index,index+4),'xref');
  }
  assert.match(sha256,/^[a-f0-9]{64}$/);
  observed.push(bytes.length);
 }
 assert.deepEqual(observed,[102400,102400,512000,512000,2097152,2097152,10485760,10485760]);
 assert.ok(operationalCost(scenarios.maximum).total>operationalCost(scenarios.typical).total);
});
