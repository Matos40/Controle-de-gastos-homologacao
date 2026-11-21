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
