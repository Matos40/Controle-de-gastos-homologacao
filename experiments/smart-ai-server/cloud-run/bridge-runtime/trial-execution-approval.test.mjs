import assert from 'node:assert/strict';
import test from 'node:test';
import {verifyAndPinCloudRunExecution,validExecutionApproval,
 matchesStoredExecutionApproval} from './trial-execution-approval.mjs';

const now=Date.now();
const approved=()=>({
 executionId:'synthetic-exec-001',
 jobName:'raytech-test-job',
 jobEmail:'raytech-ai-control-job-08645@raytech-3d.iam.gserviceaccount.com',
 executionUid:'00000000-0000-4000-8000-000000000864',
 runId:'synthetic-run-001',
 requestId:'00000000-0000-4000-8000-000000000864',
 absoluteDeadline:now+60000,
 endpoint:'https://private-control.run.app/internal/smart-ai/trial-control',
});
const expectedName='projects/raytech-3d/locations/us-central1/jobs/raytech-test-job/executions/synthetic-exec-001';
const result=()=>({
 name:expectedName,uid:approved().executionUid,
 job:'projects/raytech-3d/locations/us-central1/jobs/raytech-test-job',
 template:{serviceAccount:approved().jobEmail},taskCount:1,parallelism:1,
 createTime:new Date(now-1000).toISOString(),reconciling:false,
});
function harness({remote=result(),status=200,record=approved()}={}){
 const calls={get:0,pin:0,tokens:0};
 let pinned=null;
 const gate={async initializing(proof){calls.pin++;
  if(pinned)return false;
  pinned=structuredClone(proof);return true;
 }};
 const accessToken=async()=>{calls.tokens++;return 'test-access-token';};
 const transport=async(url,options)=>{
  calls.get++;assert.equal(url,'https://run.googleapis.com/v2/'+expectedName);
  assert.equal(options.method,'GET');
  assert.equal(options.headers.authorization,'Bearer test-access-token');
  assert.equal(options.redirect,'error');
  return Response.json(remote,{status});
 };
 return {calls,gate,accessToken,transport,record,get pinned(){return pinned;}};
}
test('controller verifies Cloud Run Admin v2, binds immutable UID and persists one approval',async()=>{
 const h=harness();
 const run=()=>verifyAndPinCloudRunExecution({approved:h.record,gate:h.gate,
  accessToken:h.accessToken,transport:h.transport,clock:()=>now});
 const proof=await run();
 assert.equal(proof.executionUid,h.record.executionUid);
 assert.equal(proof.jobEmail,h.record.jobEmail);
 assert.equal(proof.verifiedAt,now);
 assert.ok(validExecutionApproval(proof,{runId:h.record.runId,requestId:h.record.requestId,
  executionId:h.record.executionId,jobName:h.record.jobName,jobEmail:h.record.jobEmail,
  absoluteDeadline:h.record.absoluteDeadline,clock:()=>now}));
 assert.equal(matchesStoredExecutionApproval(h.pinned,h.record,{clock:()=>now}),true);
 assert.deepEqual([h.calls.get,h.calls.pin,h.calls.tokens],[1,1,1]);
 await assert.rejects(run(),/TRIAL_APPROVAL_ALREADY_USED/);
 assert.equal(h.calls.pin,2);
});
test('Cloud Run v2 accepts the exact short parent Job observed by the operator',async()=>{
 const h=harness({remote:{...result(),job:'raytech-test-job'}});
 const proof=await verifyAndPinCloudRunExecution({approved:h.record,gate:h.gate,
  accessToken:h.accessToken,transport:h.transport,clock:()=>now});
 assert.equal(proof.executionId,'synthetic-exec-001');
 assert.equal(proof.jobName,'raytech-test-job');
 assert.equal(h.pinned.executionUid,h.record.executionUid);
 assert.deepEqual([h.calls.get,h.calls.pin,h.calls.tokens],[1,1,1]);
});

// The values below are verbatim from the operator's 21-Nov-2026 remote report.
// The report did not include the entire Admin API JSON. Missing timestamps,
// task shape and execution lifecycle are simulated rather than invented as
// remote evidence. No Google API requests or IAM are made in these tests.
test('08.6.4.10: replay the observed Cloud Run v2 short-job response from raytech-3d',async()=>{
 const replayNow=Date.now();
 const observed={
  name:'projects/raytech-3d/locations/us-central1/jobs/raytech-ai-trial-worker/executions/raytech-ai-trial-worker-4kc6v',
  job:'raytech-ai-trial-worker',
  uid:'db1266e0-9adb-4e60-a5bd-e8b62ce9aca8',
  template:{serviceAccount:'raytech-ai-control-job-08645@raytech-3d.iam.gserviceaccount.com'},
 };
 const request={
  executionId:'raytech-ai-trial-worker-4kc6v',
  jobName:'raytech-ai-trial-worker',
  jobEmail:observed.template.serviceAccount,
  executionUid:observed.uid,
  runId:'replay-20261121-synthetic',
  requestId:'00000000-0000-4000-8000-000000000864',
  absoluteDeadline:replayNow+60000,
  endpoint:'https://private-control.run.app/internal/smart-ai/trial-control',
 };
 let reads=0,grants=0,persisted;
 const accessToken=async()=> 'local-mock-token';
 const gate={async initializing(proof){grants++;persisted=proof;return true;}};
 const invoke=async body=>verifyAndPinCloudRunExecution({
  approved:request,gate,accessToken,clock:()=>replayNow,
  transport:async(url,init)=>{
   reads++;
   assert.equal(url,'https://run.googleapis.com/v2/'+observed.name);
   assert.equal(init.method,'GET');
   assert.equal(init.headers.authorization,'Bearer local-mock-token');
   return Response.json(body);
  },
 });
 // Insufficient original telemetry is NOT interpreted as success.
 await assert.rejects(invoke(observed),/TRIAL_EXECUTION_MISMATCH/);
 assert.equal(grants,0);
 // Local scaffold only: these 4 fields were NOT supplied by the remote report.
 const scaffold={...observed,taskCount:1,parallelism:1,
  createTime:new Date(replayNow-1000).toISOString(),reconciling:false};
 const result=await invoke(scaffold);
 assert.equal(result.jobName,observed.job);
 assert.equal(result.executionUid,observed.uid);
 assert.equal(result.jobEmail,observed.template.serviceAccount);
 assert.equal(persisted.executionId,request.executionId);
 assert.deepEqual([reads,grants],[2,1]);
});
test('08.6.4.10: observed real execution identity cannot be rebound to another job',async()=>{
 const replayNow=Date.now();
 const observed={
  name:'projects/raytech-3d/locations/us-central1/jobs/raytech-ai-trial-worker/executions/raytech-ai-trial-worker-4kc6v',
  job:'raytech-ai-trial-worker',
  uid:'db1266e0-9adb-4e60-a5bd-e8b62ce9aca8',
  template:{serviceAccount:'raytech-ai-control-job-08645@raytech-3d.iam.gserviceaccount.com'},
  taskCount:1,parallelism:1,
  createTime:new Date(replayNow-1000).toISOString(),
 };
 const request={
  executionId:'raytech-ai-trial-worker-4kc6v',jobName:observed.job,
  jobEmail:observed.template.serviceAccount,executionUid:observed.uid,
  runId:'replay-20261121-synthetic',
  requestId:'00000000-0000-4000-8000-000000000864',
  absoluteDeadline:replayNow+60000,
  endpoint:'https://private-control.run.app/internal/smart-ai/trial-control',
 };
 for(const mutated of [
  {...observed,job:'raytech-ai-trial-worker-other'},
  {...observed,job:'projects/another-project/locations/us-central1/jobs/raytech-ai-trial-worker'},
  {...observed,name:observed.name.replace('/us-central1/','/us-east1/')},
  {...observed,uid:'db1266e0-9adb-4e60-a5bd-e8b62ce9aca9'},
  {...observed,template:{serviceAccount:'wrong@raytech-3d.iam.gserviceaccount.com'}},
  {...observed,taskCount:2},
  {...observed,parallelism:2},
  {...observed,completionTime:new Date(replayNow-1000).toISOString()},
 ]){
  let grants=0;
  await assert.rejects(verifyAndPinCloudRunExecution({
   approved:request,gate:{async initializing(){grants++;return true;}},
   accessToken:async()=> 'local-mock-token',
   clock:()=>replayNow,
   transport:async()=>Response.json(mutated),
  }),/TRIAL_EXECUTION_MISMATCH/);
  assert.equal(grants,0,'mismatched real-identity fixture must not create an approval');
 }
});

test('Cloud Run rejects spoofed execution name, job, UID, service account or task shape',async()=>{
 const mutations=[
  {name:'projects/elsewhere/locations/us-central1/jobs/raytech-test-job/executions/synthetic-exec-001'},
  {job:'projects/raytech-3d/locations/us-central1/jobs/another-job'},
  {job:'projects/other-project/locations/us-central1/jobs/raytech-test-job'},
  {job:'projects/raytech-3d/locations/us-east1/jobs/raytech-test-job'},
  {job:'raytech-test-job-other'},
  {job:'jobs/raytech-test-job'},
  {job:'other-raytech-test-job'},
  {job:''},
  {uid:'00000000-0000-4000-8000-000000000888'},
  {template:{serviceAccount:'wrong@raytech-3d.iam.gserviceaccount.com'}},
  {template:{}},{taskCount:2},{parallelism:2},{taskCount:0},
  {deleteTime:new Date(now).toISOString()},
  {completionTime:new Date(now).toISOString()},
  {cancelledCount:1},{failedCount:1},
  {createTime:'not-a-time'},{createTime:new Date(now+60_000).toISOString()},
 ];
 for(const mutation of mutations){
  const h=harness({remote:{...result(),...mutation}});
  await assert.rejects(verifyAndPinCloudRunExecution({approved:h.record,gate:h.gate,
   accessToken:h.accessToken,transport:h.transport,clock:()=>now}),
   /TRIAL_EXECUTION_MISMATCH/);
  assert.equal(h.calls.pin,0,'no approval written on mismatched admin response');
 }
});
test('HTTP 403, 404, 500 and inaccessible admin service never permit a bind',async()=>{
 for(const status of [403,404,500]){
  const h=harness({status});
  await assert.rejects(verifyAndPinCloudRunExecution({approved:h.record,gate:h.gate,
   accessToken:h.accessToken,transport:h.transport,clock:()=>now}),
   /TRIAL_EXECUTION_UNVERIFIED/);
  assert.equal(h.calls.pin,0);
 }
});
test('expired approval, fake endpoint, wrong UID format, unexpected fields fail before API access',async()=>{
 const cases=[
  {absoluteDeadline:now-1},
  {endpoint:'http://localhost/internal/smart-ai/trial-control'},
  {endpoint:'https://private-control.run.app/internal/smart-ai/trial-control?unsafe=1'},
  {executionUid:'unconfirmed'},
  {jobName:'../bad-job'},
  {unauthorized:true},
  {verifiedAt:now},
 ];
 for(const mutation of cases){
  const h=harness({record:{...approved(),...mutation}});
  await assert.rejects(verifyAndPinCloudRunExecution({approved:h.record,gate:h.gate,
   accessToken:h.accessToken,transport:h.transport,clock:()=>now}),
   /TRIAL_APPROVAL_INVALID/);
  assert.deepEqual([h.calls.tokens,h.calls.get,h.calls.pin],[0,0,0]);
 }
});
test('job cannot substitute a local forged approval for the controller-persisted record',()=>{
 const binding={...approved(),verifiedAt:now};
 assert.equal(matchesStoredExecutionApproval(binding,approved(),{clock:()=>now}),true);
 for(const key of ['executionId','jobName','jobEmail','executionUid','runId','requestId','endpoint']){
  assert.equal(matchesStoredExecutionApproval(binding,{...approved(),[key]:'other'},{clock:()=>now}),false,key);
 }
 assert.equal(matchesStoredExecutionApproval({...binding,verifiedAt:now+600_000},approved(),{clock:()=>now}),false);
 assert.equal(matchesStoredExecutionApproval(null,approved(),{clock:()=>now}),false);
});
