import {setTimeout as delay} from 'node:timers/promises';
import {validRequestId} from '../../legacy/usage.mjs';
import {validExecutionApproval,matchesStoredExecutionApproval} from './trial-execution-approval.mjs';

// The gate is scoped to one run. In separate processes the store must provide a
// durable compare-and-set, with the client bound to the actual execution identity.
export function createTrialGate({store,runId,requestId,absoluteDeadline,clock=Date.now}){
 if(!runId||!validRequestId(requestId)||!Number.isSafeInteger(absoluteDeadline))throw Error('INVALID_TRIAL');
 const initial={runId,requestId,absoluteDeadline,phase:'provisioning',revision:0,admitted:false};
 async function read(signal){
  signal?.throwIfAborted();
  const state=await store.read(signal)??initial;
  if(state.runId!==runId||state.requestId!==requestId||state.absoluteDeadline!==absoluteDeadline)throw Error('TRIAL_MISMATCH');
  return state;
 }
 async function change(update,signal){
  for(let retry=0;retry<8;retry++){
   const before=await read(signal);
   const patch=update(before);
   if(!patch)return null;
   const next={...before,...patch,revision:before.revision+1};
   signal?.throwIfAborted();
   if(await store.compareAndSet(before.revision,next,signal))return next;
  }
  throw Error('TRIAL_STATE_CONFLICT');
 }
 function advance(from,to,details={},signal){
  return change(s=>s.phase===from&&(clock()<absoluteDeadline||['reversing','reversed'].includes(to))?{phase:to,...details}:null,signal);
 }
 return {
  read,
  initializing:(approval,signal)=>validExecutionApproval(approval,{runId,requestId,absoluteDeadline,clock})
   ?advance('provisioning','initializing',{executionApproval:approval},signal):Promise.resolve(null),
  identityReady:(executionId,uid,signal)=>advance('initializing','identity-ready',{executionId,uid},signal),
  profilePrepared:(executionId,signal)=>change(s=>
   s.phase==='identity-ready'&&s.executionId===executionId&&clock()<absoluteDeadline?{profilePrepared:true}:null,signal),
  privateReady:(executionId,signal)=>change(s=>
   s.phase==='identity-ready'&&s.profilePrepared&&s.executionId===executionId&&clock()<absoluteDeadline?{phase:'private-ready'}:null,signal),
  financeVerified:(signal)=>advance('private-ready','finance-verified',{},signal),
  authorize:(until,signal)=>change(s=>
   s.phase==='finance-verified'&&clock()<until&&until<=absoluteDeadline?{phase:'authorized',until}:null,signal),
  claim:(executionId,signal)=>change(s=>
   s.phase==='authorized'&&s.executionId===executionId&&clock()<s.until?{phase:'executing',admitted:true}:null,signal),
  report:(executionId,result,signal)=>change(s=>
   ['executing','reconciling'].includes(s.phase)&&s.admitted&&s.executionId===executionId&&!s.dispatchFinished
    ?{dispatchFinished:true,result}:null,signal),
  block:(signal)=>change(s=>['reconciling','reversing','reversed'].includes(s.phase)
   ?null:{phase:'reconciling',until:0},signal),
  reversing:(signal)=>advance('reconciling','reversing',{},signal),
  reversed:(signal)=>advance('reversing','reversed',{},signal),
 };
}

function bounded(operation,signal){
 signal.throwIfAborted();
 let abort;
 const cancelled=new Promise((_,reject)=>{
  abort=()=>reject(signal.reason);
  signal.addEventListener('abort',abort,{once:true});
 });
 return Promise.race([Promise.resolve().then(()=>{signal.throwIfAborted();return operation(signal);}),cancelled])
  .finally(()=>signal.removeEventListener('abort',abort));
}
const closing=new Set(['reconciling','reversing','reversed']);
async function waitPhase(gate,accept,signal,pollMs){
 for(;;){
  const state=await bounded(s=>gate.read(s),signal);
  if(accept(state))return state;
  if(closing.has(state.phase))throw Error('TRIAL_CLOSED');
  try{await delay(pollMs,undefined,{signal});}
  catch(error){signal.throwIfAborted();throw error;}
 }
}
const at=(deadline,clock)=>AbortSignal.timeout(Math.max(0,deadline-clock()));

export function createControlledTrial({gate,ops,absoluteDeadline,cleanupReserveMs,executionMs,clock=Date.now,pollMs=250}){
 if(!Number.isSafeInteger(cleanupReserveMs)||cleanupReserveMs<=0||!Number.isSafeInteger(executionMs)||executionMs<=0)
  throw Error('INVALID_TRIAL_BUDGET');
 const absolute=at(absoluteDeadline,clock);
 const workEnd=absoluteDeadline-cleanupReserveMs;
 let cleanup;
 function reverse(){
  return cleanup??=(async()=>{
   const current=await bounded(async s=>await gate.block(s)??await gate.read(s),absolute);
   if(current.phase==='reversed')return current;
   // An independent ingress/admission fence also covers dispatch that already claimed a permit.
   if(!await bounded(s=>ops.blockAdmissions(s),absolute))throw Error('ADMISSION_BLOCK_UNCONFIRMED');
   if(current.admitted&&current.phase!=='reversing'){
    if(!await bounded(s=>ops.drainDispatch(current,s),absolute))throw Error('DISPATCH_DRAIN_UNCONFIRMED');
    if(!await bounded(s=>ops.reconcile(current.requestId,s),absolute))throw Error('RECONCILIATION_UNCONFIRMED');
   }
   if(current.phase!=='reversing'&&!await bounded(s=>gate.reversing(s),absolute))throw Error('REVERSAL_NOT_CONFIRMED');
   if(!await bounded(s=>ops.restore(s),absolute))throw Error('RESTORATION_UNCONFIRMED');
   return bounded(s=>gate.reversed(s),absolute);
  })().catch(error=>{cleanup=undefined;throw error;});
 }
 return {reverse,async run(cancel=new AbortController().signal){
  const prepare=AbortSignal.any([absolute,at(workEnd-executionMs,clock),cancel]);
  let result;
  try{
   await bounded(s=>ops.provision(s),prepare);
   const executionId=await bounded(s=>ops.start(s),prepare);
   if(typeof ops.verifyExecution!=='function')throw Error('TRIAL_EXECUTION_UNVERIFIED');
   const proof=await bounded(s=>ops.verifyExecution(executionId,s),prepare);
   if(!validExecutionApproval(proof,{executionId,clock}))throw Error('TRIAL_EXECUTION_UNVERIFIED');
   // verifyExecution must persist an approval via the trusted controller.
   // It is not sufficient to return an untrusted object supplied by a job.
   const pinned=await bounded(s=>gate.read(s),prepare);
   if(pinned.phase!=='initializing'||!matchesStoredExecutionApproval(pinned.executionApproval,proof))
    throw Error('TRIAL_EXECUTION_UNVERIFIED');
   const identity=await waitPhase(gate,s=>s.phase==='identity-ready',prepare,pollMs);
   if(!executionId||identity.executionId!==executionId)throw Error('EXECUTION_MISMATCH');
   await bounded(s=>ops.prepareIdentity(identity,s),prepare);
   if(!await bounded(s=>gate.profilePrepared(identity.executionId,s),prepare))throw Error('TRIAL_CLOSED');
   const ready=await waitPhase(gate,s=>s.phase==='private-ready',prepare,pollMs);
   if(!await bounded(s=>ops.verifyFinance(ready,s),prepare))throw Error('FINANCE_NOT_VERIFIED');
   if(!await bounded(s=>gate.financeVerified(s),prepare))throw Error('TRIAL_CLOSED');
   const until=Math.min(workEnd,clock()+executionMs);
   if(!await bounded(s=>gate.authorize(until,s),prepare))throw Error('TRIAL_CLOSED');
   const executing=AbortSignal.any([absolute,cancel,at(until,clock)]);
   result=await waitPhase(gate,s=>s.phase==='executing'&&s.dispatchFinished,executing,pollMs);
  }finally{await reverse();}
  return result?.result;
 }};
}

export async function runControlledClient({gate,executionId,identify,checkPrivate,extract,signal,clock=Date.now,pollMs=250}){
 const uid=await bounded(identify,signal);
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(uid))return false;
 // The job can start before Cloud Run's Admin API confirms the execution.
 // Wait only for the controller's durable approval; cancellation stays final.
 try{await waitPhase(gate,s=>s.phase==='initializing'&&
   validExecutionApproval(s.executionApproval,{executionId,clock}),signal,pollMs);}
 catch(error){if(error.message==='TRIAL_CLOSED')return false;throw error;}
 if(!await bounded(s=>gate.identityReady(executionId,uid,s),signal))return false;
 await waitPhase(gate,s=>s.phase==='identity-ready'&&s.profilePrepared&&s.executionId===executionId,signal,pollMs);
 if(!await bounded(s=>checkPrivate(uid,s),signal))throw Error('PRIVATE_PATH_NOT_READY');
 if(!await bounded(s=>gate.privateReady(executionId,s),signal))return false;
 await waitPhase(gate,s=>s.phase==='authorized',signal,pollMs);
 const permit=await bounded(s=>gate.claim(executionId,s),signal);
 if(!permit)return false;
 const execution=AbortSignal.any([signal,at(permit.until,clock)]);
 let result={state:'unknown'};
 try{result=await bounded(s=>extract(permit.requestId,s),execution);}
 finally{await bounded(s=>gate.report(executionId,result,s),signal);}
 return true;
}

// Explicit, operator-authorized recovery after the absolute deadline. Never
// reopen admission; a failed read leaves the durable gate closed.
export async function recoverClosedTrial({gate,ops,signal}={}){
 if(!signal||typeof gate?.block!=='function')throw Error('RECOVERY_SIGNAL_REQUIRED');
 signal.throwIfAborted();
 const current=await gate.block(signal)??await gate.read(signal);
 if(current.phase==='reversed')return current;
 if(!await ops.blockAdmissions(signal))throw Error('ADMISSION_BLOCK_UNCONFIRMED');
 if(current.admitted){
  if(!await ops.drainDispatch(current,signal))throw Error('DISPATCH_DRAIN_UNCONFIRMED');
  if(!await ops.reconcile(current.requestId,signal))throw Error('RECONCILIATION_UNCONFIRMED');
 }
 if(current.phase!=='reversing'&&!await gate.reversing(signal))throw Error('REVERSAL_NOT_CONFIRMED');
 if(!await ops.restore(signal))throw Error('RESTORATION_UNCONFIRMED');
 return gate.reversed(signal);
}
