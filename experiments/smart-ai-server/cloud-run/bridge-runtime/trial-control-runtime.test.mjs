import assert from 'node:assert/strict';
import test from 'node:test';
import {createBoundTrialJob} from './trial-job-binding.mjs';
import {makeTrialControlServer,trialControlConfig} from './trial-control-runtime.mjs';

const base=()=>({
 SMART_AI_TRIAL_CONTROL_ENABLED:'true',
 FIREBASE_PROJECT_ID:'gen-lang-client-0593667072',GOOGLE_CLOUD_PROJECT:'raytech-3d',
 SMART_AI_TRIAL_CONTROL_AUDIENCE:'https://private-control.run.app',
 SMART_AI_TRIAL_CONTROLLER_EMAIL:'trial-controller@raytech-3d.iam.gserviceaccount.com',
 SMART_AI_TRIAL_JOB_EMAIL:'trial-job-once@raytech-3d.iam.gserviceaccount.com',
 SMART_AI_TRIAL_CONTROL_IDENTITY:'trial-control@raytech-3d.iam.gserviceaccount.com',
 SMART_AI_TRIAL_CONTROLLER_SUB:'111111',SMART_AI_TRIAL_JOB_SUB:'222222',
 SMART_AI_TRIAL_EXECUTION_ID:'test-exec-123',
 SMART_AI_TRIAL_ABSOLUTE_DEADLINE:String(Date.now()+600000),
 SMART_AI_TRIAL_FIRESTORE_PROJECT:'projects/gen-lang-client-0593667072/databases/(default)',
 SMART_AI_TRIAL_RUN_ID:'test-run-123',
 SMART_AI_TRIAL_REQUEST_ID:'00000000-0000-4000-8000-000000000864'
});
const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const close=server=>new Promise(resolve=>server.close(resolve));
test('configuration fails closed for missing flag, emulator, shared identity and wrong project',()=>{
 const valid=base();assert.equal(trialControlConfig(valid).executionId,'test-exec-123');
 for(const edit of [
  {SMART_AI_TRIAL_CONTROL_ENABLED:'false'},
  {FIRESTORE_EMULATOR_HOST:'127.0.0.1:18080'},
  {SMART_AI_TRIAL_JOB_EMAIL:valid.SMART_AI_TRIAL_CONTROLLER_EMAIL},
  {SMART_AI_TRIAL_JOB_SUB:valid.SMART_AI_TRIAL_CONTROLLER_SUB},
  {SMART_AI_TRIAL_FIRESTORE_PROJECT:'projects/other-project/databases/(default)'},
  {SMART_AI_TRIAL_EXECUTION_ID:''},
  {SMART_AI_TRIAL_ABSOLUTE_DEADLINE:String(Date.now()-2000)}
 ])assert.throws(()=>trialControlConfig({...valid,...edit}),/TRIAL_CONTROL/);
});
test('isolated control entrypoint is disabled and exposes no commercial routes',async()=>{
 const server=makeTrialControlServer();
 await listen(server);
 try{
  const host='http://127.0.0.1:'+server.address().port;
  for(const path of ['/internal/smart-ai/trial-control','/v1/invoices','/internal/budget-push'])
   assert.equal((await fetch(host+path,{method:'POST'})).status,503);
 }finally{await close(server);}
});
test('enabled candidate allows ONLY the control route and delegates without commercial fallback',async()=>{
 let calls=0;
 const server=makeTrialControlServer({enabled:true,handler:async()=>{calls++;return Response.json({state:null});}});
 await listen(server);
 try{
  const host='http://127.0.0.1:'+server.address().port;
  assert.equal((await fetch(host+'/v1/invoices',{method:'POST'})).status,404);
  assert.equal((await fetch(host+'/internal/budget-push',{method:'POST'})).status,404);
  assert.equal((await fetch(host+'/internal/smart-ai/trial-control',{method:'GET'})).status,405);
  assert.equal((await fetch(host+'/internal/smart-ai/trial-control',{method:'POST'})).status,200);
  assert.equal(calls,1);
 }finally{await close(server);}
});
test('job binding requires independently confirmed execution and dedicated metadata identity',async()=>{
 const approved={executionId:'test-exec-123',jobName:'test-job',runId:'test-run-123',
 requestId:'00000000-0000-4000-8000-000000000864',jobEmail:'trial-job-once@raytech-3d.iam.gserviceaccount.com',
 endpoint:'https://private-control.run.app/internal/smart-ai/trial-control',
 absoluteDeadline:Date.now()+600000};
 const env={CLOUD_RUN_EXECUTION:'test-exec-123',CLOUD_RUN_JOB:'test-job'};
 let verified=false,metadata=false;
 const options={env,approved,
  verifyApproval:async binding=>{verified=true;return binding===approved;},
  metadataAccess:email=>{assert.equal(email,approved.jobEmail);return async()=>{metadata=true;return 'fake-access-token';};},
  identity:async()=> 'fake-service-token',
  transport:async()=>Response.json({state:null})};
 await assert.rejects(createBoundTrialJob({...options,verifyApproval:async()=>false}),/TRIAL_EXECUTION_UNVERIFIED/);
 await assert.rejects(createBoundTrialJob({...options,env:{...env,CLOUD_RUN_EXECUTION:'other-execution'}}),/TRIAL_EXECUTION_MISMATCH/);
 assert.equal(metadata,false);
 const bound=await createBoundTrialJob(options);
 assert.equal(bound.executionId,approved.executionId);
 assert.equal(verified,true);assert.equal(metadata,true);
 assert.equal((await bound.gate.read()).phase,'provisioning');
});
