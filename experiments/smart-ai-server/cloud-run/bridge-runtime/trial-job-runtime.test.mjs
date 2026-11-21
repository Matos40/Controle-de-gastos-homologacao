import assert from 'node:assert/strict';
import test from 'node:test';
import {createTrialGate} from './trial-readiness.mjs';
import {runPinnedTrialController} from './trial-controller-lifecycle.mjs';
import {runSyntheticTrialJob} from './trial-job-runtime.mjs';
import {createAuthenticatedTrialChannel,createRemoteTrialControlStore,
 TRIAL_PATH} from './trial-control-channel.mjs';

test('real channel protocol: controller stays through single simulated worker job and rollback',async()=>{
 const now=Date.now(),absoluteDeadline=now+20000;
 const approved={
  executionId:'synthetic-execution',jobName:'synthetic-job',
  jobEmail:'synthetic-job@raytech-3d.iam.gserviceaccount.com',
  executionUid:'00000000-0000-4000-8000-000000000864',
  runId:'test-run-824',requestId:'00000000-0000-4000-8000-000000000864',
  absoluteDeadline,endpoint:'https://trial.internal.invalid'+TRIAL_PATH,
  verifiedAt:now
 };
 let record=null,serial=Promise.resolve();
 const backing={read:async()=>structuredClone(record),
  async compareAndSet(revision,next){
   const task=serial.then(()=>{
    if((record?.revision??0)!==revision)return false;
    record=structuredClone(next);return true;
   });serial=task.catch(()=>{});return task;
  }};
 const controller={email:'synthetic-controller@raytech-3d.iam.gserviceaccount.com',
  subject:'111',audience:'https://trial.internal.invalid'};
 const job={email:approved.jobEmail,subject:'222',audience:'https://trial.internal.invalid'};
 const handler=createAuthenticatedTrialChannel({store:backing,
  runId:approved.runId,requestId:approved.requestId,absoluteDeadline,
  executionId:approved.executionId,jobName:approved.jobName,
  controller,job,verifyGoogle:async(token,claim)=>{
   if(token!==claim.email)throw Error('TEST_UNAUTHORIZED');
  }});
 const transport=(url,options)=>handler(new Request(url,options));
 const identity=async(_audience,_transport,_signal)=>job.email;
 const localStore=role=>createRemoteTrialControlStore({endpoint:approved.endpoint,role,
  identity:async()=>role==='controller'?controller.email:job.email,transport});
 const gate=createTrialGate({store:localStore('controller'),runId:approved.runId,
  requestId:approved.requestId,absoluteDeadline});
 assert.ok(await gate.initializing(approved));
 const controllerRun=runPinnedTrialController({gate,proof:approved,pollMs:2,cleanupReserveMs:1000,
  verifySyntheticPreflight:async()=>true});
 const workerRun=runSyntheticTrialJob({env:{
  SMART_AI_TRIAL_SYNTHETIC_ONLY:'true',GOOGLE_CLOUD_PROJECT:'raytech-3d',
  CLOUD_RUN_EXECUTION:approved.executionId,CLOUD_RUN_JOB:approved.jobName,
  SMART_AI_TRIAL_RUN_ID:approved.runId,SMART_AI_TRIAL_REQUEST_ID:approved.requestId,
  SMART_AI_TRIAL_ABSOLUTE_DEADLINE:String(absoluteDeadline),
  SMART_AI_TRIAL_CONTROL_ENDPOINT:approved.endpoint
 },transport,identity,metadataAccess:()=>async()=> 'synthetic-access-token',pollMs:2});
 const [c,w]=await Promise.all([controllerRun,workerRun]);
 assert.equal(c.phase,'reversed');
 assert.equal(w.state,'synthetic');
 assert.deepEqual([w.accepted,w.rejected],[1,1]);
 assert.equal(record.phase,'reversed');
 assert.equal(record.dispatchFinished,true);
});
test('synthetic worker refuses missing project, target and synthetic-only flag',async()=>{
 for(const patch of [{SMART_AI_TRIAL_SYNTHETIC_ONLY:'false'},
  {GOOGLE_CLOUD_PROJECT:'raytech-cg-producao'},
  {SMART_AI_TRIAL_CONTROL_ENDPOINT:'http://127.0.0.1:8080/internal/smart-ai/trial-control'}]){
  await assert.rejects(runSyntheticTrialJob({env:{
   SMART_AI_TRIAL_SYNTHETIC_ONLY:'true',GOOGLE_CLOUD_PROJECT:'raytech-3d',
   CLOUD_RUN_EXECUTION:'synthetic-execution',CLOUD_RUN_JOB:'synthetic-job',
   SMART_AI_TRIAL_RUN_ID:'test-run',SMART_AI_TRIAL_REQUEST_ID:'00000000-0000-4000-8000-000000000864',
   SMART_AI_TRIAL_ABSOLUTE_DEADLINE:String(Date.now()+20000),
   SMART_AI_TRIAL_CONTROL_ENDPOINT:'https://trial.internal.invalid'+TRIAL_PATH,...patch
  }}),/TRIAL_WORKER_CONFIGURATION/);
 }
});
