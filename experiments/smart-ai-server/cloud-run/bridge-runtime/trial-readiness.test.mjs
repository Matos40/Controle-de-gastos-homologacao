import assert from 'node:assert/strict';
import test from 'node:test';
import {createTrialGate,createControlledTrial,runControlledClient} from './trial-readiness.mjs';

const requestId='00000000-0000-4000-8000-000000000864';
const executionId='synthetic-execution';
function deferred(){
 let resolve;
 const promise=new Promise(done=>{resolve=done;});
 return {promise,resolve};
}
function setup({work=500,cleanup=500,executionMs=30,clock=Date.now}={}){
 const absoluteDeadline=clock()+work+cleanup;
 let record,calls=0;
 const events=[],ledger=new Map();
 const store={
  async read(){return structuredClone(record);},
  async compareAndSet(revision,next){
   if((record?.revision??0)!==revision)return false;
   record=structuredClone(next);
   events.push(record.phase);
   return true;
  },
 };
 const gate=createTrialGate({store,runId:'synthetic-run',requestId,absoluteDeadline,clock});
 const started=deferred(),ready=deferred();
 const ops={
  async provision(){events.push('provision');},
  async start(){started.resolve();return executionId;},
  async prepareIdentity(){events.push('profile');},
  async verifyFinance(){events.push('finance');return true;},
  async blockAdmissions(){events.push('blocked');return true;},
  async drainDispatch(){events.push('drained');return true;},
  async reconcile(id){assert.equal(id,requestId);events.push('ledger-read');return true;},
  async restore(){events.push('restored');return true;},
 };
 const trial=createControlledTrial({gate,ops,absoluteDeadline,cleanupReserveMs:cleanup,executionMs,clock,pollMs:1});
 const client=overrides=>runControlledClient({gate,executionId,clock,pollMs:1,signal:AbortSignal.timeout(1200),
  identify:()=>ready.promise,checkPrivate:async()=>true,async extract(id){
   calls++;ledger.set(id,'completed');return {http:200};
  },...overrides});
 return {trial,gate,client,started,ready,ops,events,ledger,get calls(){return calls;}};
}
test('readiness and separate finance confirmation precede the execution clock and one claim',async()=>{
 let now=Date.now();
 const h=setup({clock:()=>now,executionMs:100});
 const run=h.trial.run(),client=h.client();
 await h.started.promise;
 now+=200; // The time spent starting is outside the dispatch window.
 h.ready.resolve('synthetic-free');
 assert.deepEqual(await run,{http:200});
 assert.equal(await client,true);
 assert.equal(h.calls,1);
 assert.deepEqual([...h.ledger],[[requestId,'completed']]);
 for(const [first,second] of [['initializing','identity-ready'],['identity-ready','private-ready'],
  ['private-ready','finance-verified'],['finance-verified','authorized'],['authorized','executing'],
  ['blocked','drained'],['drained','ledger-read'],['ledger-read','restored']]){
  assert.ok(h.events.indexOf(first)<h.events.indexOf(second),first+' before '+second);
 }
 assert.equal(await h.gate.claim(executionId),null);
});

test('a client ready after the preparation deadline cannot post a file or reserve a credit',async()=>{
 const h=setup({work:75});
 const client=h.client();
 await assert.rejects(h.trial.run(),{name:'TimeoutError'});
 h.ready.resolve('late-user');
 assert.equal(await client,false);
 assert.equal(h.calls,0);
 assert.equal(h.ledger.size,0);
 assert.equal((await h.gate.read()).phase,'reversed');
});

test('operator cancellation and reversal before identity both close the permit permanently',async()=>{
 for(const action of ['cancel','reverse']){
  const h=setup();
  const abort=new AbortController();
  const run=assert.rejects(h.trial.run(abort.signal));
  const client=h.client();
  await h.started.promise;
  if(action==='cancel')abort.abort();
  else await h.trial.reverse();
  await run;
  h.ready.resolve('late-user');
  assert.equal(await client,false);
  assert.equal(h.calls,0);
  assert.equal(h.ledger.size,0);
  await Promise.all([h.trial.reverse(),h.trial.reverse()]);
  assert.deepEqual(h.events.filter(event=>event==='restored'),['restored']);
 }
});

test('503 during rollback does not settle the ledger; reconcile only the admitted UUID, once',async()=>{
 const h=setup({executionMs:100});
 const dispatch=deferred(),result=deferred();
 const abort=new AbortController();
 const run=assert.rejects(h.trial.run(abort.signal));
 const client=h.client({async extract(id){
  h.ledger.set(id,'pending');
  dispatch.resolve();
  return result.promise;
 }});
 h.ops.drainDispatch=async()=>{await result.promise;h.events.push('drained');return true;};
 h.ops.reconcile=async id=>{assert.equal(id,requestId);assert.equal(h.ledger.get(id),'pending');h.events.push('ledger-read');return false;};
 await h.started.promise;
 h.ready.resolve('synthetic-free');
 await dispatch.promise;
 abort.abort();
 result.resolve({http:503});
 await Promise.all([run,client]);
 assert.equal(h.ledger.get(requestId),'pending');
 assert.equal(h.events.filter(event=>event==='ledger-read').length,1);
 assert.equal(h.events.filter(event=>event==='restored').length,0);
 assert.equal((await h.gate.read()).phase,'reconciling');
});

test('the absolute deadline also bounds a stalled preparation or rollback',async t=>{
 const keepAlive=setTimeout(()=>{},1000);
 t.after(()=>clearTimeout(keepAlive));
 const h=setup({work:55,cleanup:35});
 const hung=deferred();
 h.ops.provision=()=>hung.promise;
 h.ops.restore=()=>hung.promise;
 await assert.rejects(h.trial.run(),{name:'TimeoutError'});
 assert.equal((await h.gate.read()).phase,'reversing');
 assert.equal(h.calls,0);
 assert.equal(h.ledger.size,0);
});
