import assert from 'node:assert/strict';
import test from 'node:test';
import {runSingleReadProbe,PROBE_WORKER_EMAIL} from './trial-auth-probe.mjs';
import {createAuthenticatedTrialChannel,TRIAL_PATH} from './trial-control-channel.mjs';

const now=Date.now();
const aud='https://trial.private.run.app';
const endpoint=aud+TRIAL_PATH;
const sub='987654321';
const env=()=>({
 SMART_AI_TRIAL_PROBE_ONLY:'true',SMART_AI_TRIAL_SYNTHETIC_ONLY:'true',
 GOOGLE_CLOUD_PROJECT:'raytech-3d',CLOUD_RUN_JOB:'raytech-ai-trial-worker',
 CLOUD_RUN_EXECUTION:'trial-worker-test-001',SMART_AI_TRIAL_JOB_SUB:sub,
 SMART_AI_TRIAL_CONTROL_AUDIENCE:aud,SMART_AI_TRIAL_CONTROL_ENDPOINT:endpoint,
 SMART_AI_TRIAL_ABSOLUTE_DEADLINE:String(now+60000)
});
const token=(changes={})=>{
 const h=Buffer.from(JSON.stringify({typ:'JWT',alg:'RS256'})).toString('base64url');
 const p=Buffer.from(JSON.stringify({iss:'https://accounts.google.com',
  email:PROBE_WORKER_EMAIL,sub,aud,iat:Math.floor(now/1000)-1,
  exp:Math.floor(now/1000)+300,...changes})).toString('base64url');
 return h+'.'+p+'.signature';
};
function harness({status=200,identity=token(),remoteState=null,wrongBody=false,
 email=PROBE_WORKER_EMAIL}={}){
 let reads=0,writes=0,privateCalls=0,identityCalls=0,metadataCalls=0;
 const store={async read(){reads++;return remoteState;},
  async compareAndSet(){writes++;throw Error('READ_ONLY_PROBE_MUST_NOT_WRITE');}};
 const handler=createAuthenticatedTrialChannel({store,runId:'trial-probe-test',
  requestId:'00000000-0000-4000-8000-000000000864',absoluteDeadline:now+60000,
  controller:{email:'controller@raytech-3d.iam.gserviceaccount.com',
   subject:'1234',audience:aud},
  job:{email:PROBE_WORKER_EMAIL,subject:sub,audience:aud},
  jobName:'raytech-ai-trial-worker',executionId:'trial-worker-test-001',
  verifyGoogle:async(proof,expected)=>{
   if(proof!==identity||expected.email!==PROBE_WORKER_EMAIL||
      expected.subject!==sub||expected.audience!==aud)throw Error('INVALID');
  },clock:()=>now});
 const transport=async(url,options)=>{
  if(url.endsWith('/email')){
   metadataCalls++;
   assert.equal(options.headers['Metadata-Flavor'],'Google');
   return new Response(email,{status:200,headers:{'metadata-flavor':'Google'}});
  }
  if(url===endpoint){
   privateCalls++;
   assert.equal(options.method,'POST');
   assert.equal(options.redirect,'error');
   assert.equal(options.headers['x-raytech-trial-role'],'job');
   assert.equal(options.headers['x-serverless-authorization'],'Bearer '+identity);
   assert.equal(options.headers['x-raytech-trial-proof'],'Bearer '+identity);
   assert.deepEqual(JSON.parse(options.body),{action:'read'});
   if(status!==200)return Response.json({error:'DENIED'},{status});
   if(wrongBody)return Response.json({accepted:true});
   return handler(new Request(url,options));
  }
  throw Error('UNEXPECTED_NETWORK_ACCESS');
 };
 return {transport,fetchIdentity:async requestedAudience=>{
  identityCalls++;
  assert.equal(requestedAudience,aud);
  return identity;
 },get counts(){return {reads,writes,privateCalls,identityCalls,metadataCalls};}};
}
test('08.6.4.12: successful read-only probe uses real channel read and exits with no writes',async()=>{
 const h=harness();
 const result=await runSingleReadProbe({env:env(),transport:h.transport,
  identity:h.fetchIdentity,clock:()=>now});
 assert.equal(result.status,200);
 assert.equal(result.result,'TRIAL_PROBE_READ_OK');
 assert.equal(result.controlState,'absent');
 assert.equal(result.identity,PROBE_WORKER_EMAIL);
 assert.equal(result.audience,aud);
 assert.deepEqual(h.counts,{reads:1,writes:0,privateCalls:1,identityCalls:1,metadataCalls:1});
});
test('08.6.4.12: 401,403,404,503 fail closed after one request without retry or write',async()=>{
 for(const status of [401,403,404,503]){
  const h=harness({status});
  await assert.rejects(runSingleReadProbe({env:env(),transport:h.transport,
   identity:h.fetchIdentity,clock:()=>now}),new RegExp('TRIAL_PROBE_HTTP_'+status));
  assert.deepEqual(h.counts,{reads:0,writes:0,privateCalls:1,identityCalls:1,metadataCalls:1});
 }
});
test('08.6.4.12: nonempty/invalid control responses fail closed without mutating state',async()=>{
 for(const mode of [{remoteState:{phase:'initializing'}},{wrongBody:true}]){
  const h=harness(mode);
  await assert.rejects(runSingleReadProbe({env:env(),transport:h.transport,
   identity:h.fetchIdentity,clock:()=>now}),/TRIAL_PROBE_RESPONSE_INVALID/);
  assert.equal(h.counts.privateCalls,1);assert.equal(h.counts.writes,0);
 }
});
test('08.6.4.12: bad audience, email, subject, expiry stop before private request',async()=>{
 const cases=[{aud:'https://other.run.app'},{email:'wrong@raytech-3d.iam.gserviceaccount.com'},
  {sub:'123'},{exp:Math.floor(now/1000)-1},{iat:Math.floor(now/1000)+120}];
 for(const patch of cases){
  const h=harness({identity:token(patch)});
  await assert.rejects(runSingleReadProbe({env:env(),transport:h.transport,
   identity:h.fetchIdentity,clock:()=>now}),/TRIAL_PROBE_TOKEN_MISMATCH/);
  assert.equal(h.counts.privateCalls,0);assert.equal(h.counts.writes,0);
 }
 const h=harness({email:'wrong@raytech-3d.iam.gserviceaccount.com'});
 await assert.rejects(runSingleReadProbe({env:env(),transport:h.transport,
  identity:h.fetchIdentity,clock:()=>now}),/TRIAL_PROBE_WRONG_IDENTITY/);
 assert.equal(h.counts.privateCalls,0);
});
test('08.6.4.12: missing probe-only flag, wrong execution context, expired deadline fail before network',async()=>{
 for(const patch of [
  {SMART_AI_TRIAL_PROBE_ONLY:'false'},
  {SMART_AI_TRIAL_SYNTHETIC_ONLY:'false'},
  {CLOUD_RUN_JOB:'raytech-ai-trial-controller'},
  {CLOUD_RUN_EXECUTION:''},
  {SMART_AI_TRIAL_CONTROL_AUDIENCE:'https://wrong.run.app'},
  {SMART_AI_TRIAL_CONTROL_ENDPOINT:'https://trial.private.run.app/another'},
  {SMART_AI_TRIAL_ABSOLUTE_DEADLINE:String(now-1)},
  {GOOGLE_APPLICATION_CREDENTIALS:'/tmp/fake.json'},
  {FIRESTORE_EMULATOR_HOST:'localhost:8080'},
 ]){
  const h=harness();
  await assert.rejects(runSingleReadProbe({env:{...env(),...patch},
   transport:h.transport,identity:h.fetchIdentity,clock:()=>now}),
   /TRIAL_PROBE_CONFIGURATION/);
  assert.deepEqual(h.counts,{reads:0,writes:0,privateCalls:0,identityCalls:0,metadataCalls:0});
 }
});
