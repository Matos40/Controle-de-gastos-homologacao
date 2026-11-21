import assert from 'node:assert/strict';
import test from 'node:test';
import {createTrialGate,runControlledClient} from './trial-readiness.mjs';
import {runPinnedTrialController} from './trial-controller-lifecycle.mjs';
const original=()=>({
 executionId:'synthetic-exec-001',jobName:'synthetic-job',
 jobEmail:'synthetic-job@raytech-3d.iam.gserviceaccount.com',
 executionUid:'00000000-0000-4000-8000-000000000864',runId:'synthetic-run',
 requestId:'00000000-0000-4000-8000-000000000864',
 absoluteDeadline:Date.now()+10000,
 endpoint:'https://private.run.app/internal/smart-ai/trial-control',verifiedAt:Date.now()
});
function harness(){
 const proof=original();
 let state=null,chain=Promise.resolve();
 const store={read:async()=>structuredClone(state),
  async compareAndSet(revision,next){
   const task=chain.then(()=>{
    if((state?.revision??0)!==revision)return false;
    state=structuredClone(next);return true;
   });chain=task.catch(()=>{});return task;
  }};
 const controller=createTrialGate({store,runId:proof.runId,requestId:proof.requestId,
  absoluteDeadline:proof.absoluteDeadline});
 const worker=createTrialGate({store,runId:proof.runId,requestId:proof.requestId,
  absoluteDeadline:proof.absoluteDeadline});
 return {proof,controller,worker,state:()=>structuredClone(state)};
}
test('same controller authorizes once, observes simulated result and reverses',async()=>{
 const h=harness();
 assert.ok(await h.controller.initializing(h.proof));
 let extracts=0;
 const coordinator=runPinnedTrialController({gate:h.controller,proof:h.proof,
  pollMs:2,cleanupReserveMs:1000,verifySyntheticPreflight:async()=>true});
 const worker=runControlledClient({gate:h.worker,executionId:h.proof.executionId,
  identify:async()=> 'synthetic-user',checkPrivate:async()=>true,
  extract:async()=>{extracts++;return {state:'synthetic'};},
  signal:AbortSignal.timeout(2000),pollMs:2});
 const [ctrl,ran]=await Promise.all([coordinator,worker]);
 assert.equal(ctrl.phase,'reversed');
 assert.equal(ctrl.synthetic,true);
 assert.equal(ran,true);
 assert.equal(extracts,1);
 assert.equal(h.state().phase,'reversed');
 assert.equal(await h.worker.claim(h.proof.executionId),null);
});
test('controller cancellation before identity closes permit and reverses',async()=>{
 const h=harness();await h.controller.initializing(h.proof);
 const stop=new AbortController();
 const coordinator=runPinnedTrialController({gate:h.controller,proof:h.proof,
  pollMs:2,cleanupReserveMs:1000,signal:stop.signal,verifySyntheticPreflight:async()=>true});
 setTimeout(()=>stop.abort(Error('OPERATOR_CANCELLED')),20);
 await assert.rejects(coordinator,/OPERATOR_CANCELLED|The operation was aborted/);
 assert.equal(h.state().phase,'reversed');
 assert.equal(h.state().admitted,false);
});
test('preflight refusal blocks simulated dispatch and leaves closed state',async()=>{
 const h=harness();await h.controller.initializing(h.proof);
 const coordinator=runPinnedTrialController({gate:h.controller,proof:h.proof,pollMs:2,cleanupReserveMs:1000,
  verifySyntheticPreflight:async()=>false});
 const worker=runControlledClient({gate:h.worker,executionId:h.proof.executionId,
  identify:async()=> 'synthetic-user',checkPrivate:async()=>true,
  extract:async()=>{throw Error('UNEXPECTED_DISPATCH');},
  signal:AbortSignal.timeout(1500),pollMs:2});
 await assert.rejects(coordinator,/TRIAL_SYNTHETIC_PREFLIGHT_REQUIRED/);
 await assert.rejects(worker,/TRIAL_CLOSED/);
 assert.equal(h.state().phase,'reversed');
 assert.equal(h.state().admitted,false);
});
test('stalled claimed dispatch cannot be marked reversed without reconciliation',async()=>{
 const h=harness();await h.controller.initializing(h.proof);
 const coordinator=runPinnedTrialController({gate:h.controller,proof:h.proof,pollMs:2,cleanupReserveMs:1000,
  dispatchWindowMs:300,drainWaitMs:100,verifySyntheticPreflight:async()=>true});
 const worker=runControlledClient({gate:h.worker,executionId:h.proof.executionId,
  identify:async()=> 'synthetic-user',checkPrivate:async()=>true,
  extract:async()=>new Promise(()=>{}),
  signal:AbortSignal.timeout(250),pollMs:2});
 const workerOutcome=assert.rejects(worker);
 await assert.rejects(coordinator,/TRIAL_CONTROLLER_RECONCILIATION_REQUIRED/);
 assert.equal(h.state().phase,'reconciling');
 await workerOutcome;
});
