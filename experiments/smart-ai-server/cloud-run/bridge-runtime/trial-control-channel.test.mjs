import assert from 'node:assert/strict';
import test from 'node:test';
import {createTrialGate} from './trial-readiness.mjs';
import {createAuthenticatedTrialChannel,createFirestoreTrialControlStore,
 createRemoteTrialControlStore,TRIAL_PATH,TRIAL_COLLECTION} from './trial-control-channel.mjs';

const uuid='00000000-0000-4000-8000-000000000864';
function harness(){
 let now=1_000_000,record=null,chain=Promise.resolve(),writes=0;
 const runId='synthetic-run',executionId='synthetic-execution',absoluteDeadline=1_010_000;
 const db={collection(name){
  assert.equal(name,TRIAL_COLLECTION);
  return {doc(key){
   assert.equal(key,runId);
   return {async get(){return {exists:!!record,data:()=>structuredClone(record)};}};
  }};
 },async runTransaction(fn){
  const task=chain.then(()=>fn({get:async()=>({exists:!!record,data:()=>structuredClone(record)}),
   set:(_r,s)=>{record=structuredClone(s);writes++;},
   create:(_r,s)=>{if(record)throw Error('ALREADY_EXISTS');record=structuredClone(s);writes++;}}));
  chain=task.catch(()=>{});
  return task;
 }};
 const store=createFirestoreTrialControlStore(db,{runId});
 const controller={email:'controller@example.iam.gserviceaccount.com',subject:'12345',audience:'https://private.test'};
 const job={email:'job@example.iam.gserviceaccount.com',subject:'67890',audience:'https://private.test'};
 const verifyGoogle=async(token,expected)=>{
  const known=token==='controller-proof'?controller:token==='job-proof'?job:null;
  if(!known||known.email!==expected.email||known.subject!==expected.subject||
   known.audience!==expected.audience)throw Error('UNAUTHORIZED');
 };
 const handler=createAuthenticatedTrialChannel({store,runId,requestId:uuid,absoluteDeadline,
  executionId,jobName:'test-job',controller,job,verifyGoogle,clock:()=>now});
 const endpoint='https://private.test'+TRIAL_PATH;
 const transport=(url,options)=>handler(new Request(url,options));
 function client(role,identity){
  const remote=createRemoteTrialControlStore({endpoint,role,identity:async()=>identity,transport});
  return createTrialGate({store:remote,runId,requestId:uuid,absoluteDeadline,clock:()=>now});
 }
 return {controller:client('controller','controller-proof'),job:client('job','job-proof'),
  handler,endpoint,runId,executionId,absoluteDeadline,
  setTime:x=>{now=x;},snapshot:()=>structuredClone(record),get writes(){return writes;}};
}
test('private transaction: authenticated controller and job claim exactly once',async()=>{
 const h=harness(),c=h.controller,j=h.job;
 assert.ok(await c.initializing({executionId:h.executionId,jobName:'test-job',
  jobEmail:'job@example.iam.gserviceaccount.com',executionUid:'00000000-0000-4000-8000-000000000864',
  runId:h.runId,requestId:uuid,absoluteDeadline:h.absoluteDeadline,
  endpoint:h.endpoint,verifiedAt:1_000_000}));
 assert.ok(await j.identityReady(h.executionId,'synthetic-user'));
 assert.ok(await c.profilePrepared(h.executionId));
 assert.ok(await j.privateReady(h.executionId));
 assert.ok(await c.financeVerified());
 assert.ok(await c.authorize(1_005_000));
 const [a,b]=await Promise.all([j.claim(h.executionId),j.claim(h.executionId)]);
 assert.equal(Number(!!a)+Number(!!b),1);
 assert.equal((await c.read()).admitted,true);
 assert.ok(await j.report(h.executionId,{state:'completed'}));
 assert.ok(await c.block());
 assert.equal(await j.claim(h.executionId),null);
 assert.ok(await c.reversing());
 assert.ok(await c.reversed());
 assert.equal((await c.read()).phase,'reversed');
});
test('false principal, wrong role and arbitrary financial command are rejected',async()=>{
 const h=harness();
 async function post(role,proof,data){
  return h.handler(new Request(h.endpoint,{method:'POST',
   headers:{'content-type':'application/json','x-raytech-trial-role':role,'x-raytech-trial-proof':'Bearer '+proof},
   body:JSON.stringify(data)}));
 }
 assert.equal((await post('job','controller-proof',{action:'read'})).status,401);
 assert.equal((await post('controller','job-proof',{action:'read'})).status,401);
 assert.equal((await post('controller','controller-proof',{action:'delete-finances'})).status,400);
 assert.equal((await post('controller','controller-proof',{action:'cas',revision:0,next:{
  runId:h.runId,requestId:uuid,absoluteDeadline:h.absoluteDeadline,phase:'authorized',revision:1,admitted:false
 }})).status,200);
 assert.equal(h.writes,0);
});
test('expired permit and late client cannot dispatch after cancellation',async()=>{
 const h=harness(),c=h.controller,j=h.job;
 await c.initializing({executionId:h.executionId,jobName:'test-job',
  jobEmail:'job@example.iam.gserviceaccount.com',executionUid:'00000000-0000-4000-8000-000000000864',
  runId:h.runId,requestId:uuid,absoluteDeadline:h.absoluteDeadline,
  endpoint:h.endpoint,verifiedAt:1_000_000});
 await j.identityReady(h.executionId,'synthetic-user');
 await c.profilePrepared(h.executionId);
 await j.privateReady(h.executionId);
 await c.financeVerified();
 await c.authorize(1_001_000);
 h.setTime(1_002_000);
 assert.equal(await j.claim(h.executionId),null);
 assert.ok(await c.block());
 assert.equal((await c.read()).phase,'reconciling');
 assert.equal(await j.claim(h.executionId),null);
});
test('controller can persist recovery and rollback after absolute deadline',async()=>{
 const h=harness(),c=h.controller,j=h.job;
 await c.initializing({executionId:h.executionId,jobName:'test-job',
  jobEmail:'job@example.iam.gserviceaccount.com',executionUid:'00000000-0000-4000-8000-000000000864',
  runId:h.runId,requestId:uuid,absoluteDeadline:h.absoluteDeadline,
  endpoint:h.endpoint,verifiedAt:1_000_000});
 await j.identityReady(h.executionId,'synthetic-user');
 h.setTime(h.absoluteDeadline+1);
 assert.ok(await c.block());
 assert.ok(await c.reversing());
 assert.ok(await c.reversed());
 assert.equal(await c.reversed(),null);
 assert.equal((await c.read()).phase,'reversed');
});
test('durable read survives new controller instances; a forged second dispatch is refused',async()=>{
 const h=harness(),c=h.controller,j=h.job;
 await c.initializing({executionId:h.executionId,jobName:'test-job',
  jobEmail:'job@example.iam.gserviceaccount.com',executionUid:'00000000-0000-4000-8000-000000000864',
  runId:h.runId,requestId:uuid,absoluteDeadline:h.absoluteDeadline,
  endpoint:h.endpoint,verifiedAt:1_000_000});
 const first=await c.read();
 assert.equal(first.phase,'initializing');
 assert.ok(await j.identityReady(h.executionId,'synthetic-user'));
 assert.equal((await c.read()).uid,'synthetic-user');
 assert.equal(await j.identityReady('other-execution','other-user'),null);
 assert.equal((await c.read()).uid,'synthetic-user');
});
