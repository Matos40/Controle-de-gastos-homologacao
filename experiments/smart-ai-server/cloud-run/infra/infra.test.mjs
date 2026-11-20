import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {createRuntimeAccess} from '../runtime.mjs';
import {makeServer} from '../server.mjs';
import {startObservation} from '../telemetry.mjs';
import {estimate,scenarios} from './cost.mjs';

const read=name=>readFile(new URL(name,import.meta.url),'utf8').then(JSON.parse);
test('offline manifest is private, disabled and pins runtime capacity and secret references',async()=>{
 const service=await read('service.template.json'),iam=await read('permissions.json'),monitoring=await read('monitoring.json');
 assert.equal(service.metadata.namespace,'__COMPUTE_PROJECT_NUMBER__');
 assert.equal(service.metadata.annotations['run.googleapis.com/ingress'],'internal');
 assert.equal(service.metadata.annotations['run.googleapis.com/invoker-iam-disabled'],'false');
 assert.equal(service.metadata.annotations['run.googleapis.com/minScale'],'0');
 assert.equal(service.metadata.annotations['run.googleapis.com/maxScale'],'1');
 const {spec}=service.spec.template;
 assert.equal(spec.containerConcurrency,1);
 assert.equal(spec.serviceAccountName,'raytech-ai-runtime@__COMPUTE_PROJECT_ID__.iam.gserviceaccount.com');
 const [container]=spec.containers,env=Object.fromEntries(container.env.map(e=>[e.name,e.value??e.valueFrom]));
 assert.deepEqual(container.resources.limits,{cpu:'1',memory:'512Mi'});
 assert.equal(container.image,'__EXPERIMENT_IMAGE_DIGEST__');
 assert.equal(env.SMART_AI_EXPERIMENT_ENABLED,'false');
 assert.equal(env.FIREBASE_PROJECT_ID,'__EXPERIMENT_FIREBASE_PROJECT__');
 assert.deepEqual(env.RAYTECH_GEMINI_API_KEY,{secretKeyRef:{name:'raytech-ai-gemini',key:'__SECRET_VERSION_NUMBER__'}});
 assert.equal(iam.applyAuthorized,false);
 assert.equal(iam.invoker.public,false);
 assert.equal(iam.runtime.staticKeys,false);
 assert.deepEqual(iam.runtime.firebaseAuthRole.includedPermissions,['firebaseauth.users.get']);
 assert.deepEqual(iam.runtime.firestoreRole.includedPermissions,[
  'datastore.databases.get','datastore.entities.get','datastore.entities.list',
  'datastore.entities.create','datastore.entities.update',
 ]);
 assert.equal(monitoring.applyAuthorized,false);
 assert.equal(monitoring.invoiceContentLogging,false);
});

test('runtime uses only the pinned metadata service identity and caches short-lived credentials',async()=>{
 const identity='raytech-ai-runtime@raytech-3d.iam.gserviceaccount.com';
 const access=createRuntimeAccess(identity),requests=[];
 const transport=async(url,options)=>{
  requests.push(url);
  assert.match(url,/^http:\/\/metadata\.google\.internal\/computeMetadata\/v1\/instance\/service-accounts\/default\/(email|token)$/);
  assert.equal(options.headers['Metadata-Flavor'],'Google');
  assert.equal(options.redirect,'manual');
  const headers={'Metadata-Flavor':'Google'};
  return url.endsWith('/email')?new Response(identity,{headers}):
   Response.json({access_token:'synthetic-metadata-token',token_type:'Bearer',expires_in:3600},{headers});
 };
 assert.equal(await access(transport),'synthetic-metadata-token');
 await access(transport);
 assert.equal(requests.length,2);
 assert.throws(()=>createRuntimeAccess('owner@raytech-cg-producao.iam.gserviceaccount.com'));
 await assert.rejects(createRuntimeAccess(identity)(async()=>new Response('wrong identity',{
  headers:{'Metadata-Flavor':'Google'},
 })),/WRONG_RUNTIME_IDENTITY/);
});

test('CORS preflight is origin, route, method and header restricted over HTTP',async()=>{
 const origin='https://smart-ai.example.invalid';
 let called=0;
 const server=makeServer({env:{SMART_AI_EXPERIMENT_ENABLED:'true',SMART_AI_UI_ORIGIN:origin},
  handler:{fetch:async()=>{called++;return Response.json({ok:true});}}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const endpoint='http://127.0.0.1:'+server.address().port+'/v1/invoices';
  const preflight=(source,method,headers)=>fetch(endpoint,{method:'OPTIONS',headers:{
   origin:source,'access-control-request-method':method,'access-control-request-headers':headers,
  }});
  const allowed=await preflight(origin,'POST','authorization, content-type, x-request-id');
  assert.equal(allowed.status,204);
  assert.equal(allowed.headers.get('access-control-allow-origin'),origin);
  assert.equal(allowed.headers.has('access-control-allow-credentials'),false);
  for(const entry of [['https://other.example.invalid','POST','authorization'],[origin,'GET','authorization'],
    [origin,'POST','x-user-id'],['null','POST','authorization']])assert.equal((await preflight(...entry)).status,403);
  assert.equal(called,0);
  const sent=await fetch(endpoint,{method:'POST',headers:{origin},body:'{}'});
  assert.equal(sent.headers.get('access-control-allow-origin'),origin);
  assert.equal(called,1);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('telemetry excludes request data, and scenario estimates obey the admission ceiling',()=>{
 let event;
 startObservation('/v1/invoices',value=>{event=value;})(200,{
  subrequests:12,inputTokens:800,outputTokens:50,thinkingTokens:12,providerBody:'raw',uid:'private',
  confirmedFirestoreWrites:20,authorization:'private',
 });
 assert.equal(event.inputTokens,800);
 assert.equal(event.confirmedFirestoreWrites,20);
 assert.ok(event.processCpuMicros>=0&&event.rssBytes>0);
 for(const field of ['providerBody','uid','authorization'])assert.equal(Object.hasOwn(event,field),false);
 assert.equal(estimate(scenarios.typical).admitted,44);
 assert.equal(estimate(scenarios.maximum).admitted,60);
 assert.ok(estimate(scenarios.maximum).subtotal>estimate(scenarios.typical).subtotal);
});
