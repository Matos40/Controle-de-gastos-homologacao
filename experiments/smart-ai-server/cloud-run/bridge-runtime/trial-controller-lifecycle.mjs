import {setTimeout as delay} from 'node:timers/promises';
import {validExecutionApproval,matchesStoredExecutionApproval} from './trial-execution-approval.mjs';

// Controller runs for the whole synthetic trial, not just the execution lookup.
// It has no Firestore permission and talks only to the authenticated private gate.
const closed=new Set(['reconciling','reversing','reversed']);
async function waitFor(gate,predicate,{signal,clock,deadline,pollMs}){
 for(;;){
  signal?.throwIfAborted();
  const state=await gate.read(signal);
  if(predicate(state))return state;
  if(closed.has(state.phase))throw Error('TRIAL_CLOSED');
  if(clock()>=deadline)throw Error('TRIAL_CONTROLLER_DEADLINE');
  await delay(pollMs,undefined,signal?{signal}:{});
 }
}
export async function runPinnedTrialController({gate,proof,
 verifySyntheticPreflight,clock=Date.now,signal,
 pollMs=200,dispatchWindowMs=15000,cleanupReserveMs=15000,
 drainWaitMs=7000}={}){
 if(!gate||typeof gate.read!=='function'||typeof verifySyntheticPreflight!=='function'||
    !validExecutionApproval(proof,{clock})||
    !Number.isSafeInteger(pollMs)||pollMs<1||pollMs>2000||
    !Number.isSafeInteger(dispatchWindowMs)||dispatchWindowMs<1||
    !Number.isSafeInteger(cleanupReserveMs)||cleanupReserveMs<1||
    !Number.isSafeInteger(drainWaitMs)||drainWaitMs<1||drainWaitMs>7000)
  throw Error('TRIAL_CONTROLLER_CONFIGURATION');
 const first=await gate.read(signal);
 if(first.phase!=='initializing'||!matchesStoredExecutionApproval(first.executionApproval,proof,{clock}))
  throw Error('TRIAL_EXECUTION_UNVERIFIED');
 const workDeadline=proof.absoluteDeadline-cleanupReserveMs;
 let result,failed,verified=false;
 try{
  if(workDeadline<=clock())throw Error('TRIAL_CONTROLLER_DEADLINE');
  const identity=await waitFor(gate,s=>s.phase==='identity-ready'&&
   s.executionId===proof.executionId,{signal,clock,deadline:workDeadline,pollMs});
  if(identity.executionId!==proof.executionId||!await gate.profilePrepared(proof.executionId,signal))
   throw Error('TRIAL_EXECUTION_MISMATCH');
  await waitFor(gate,s=>s.phase==='private-ready'&&s.executionId===proof.executionId,
   {signal,clock,deadline:workDeadline,pollMs});
  if(!await verifySyntheticPreflight())throw Error('TRIAL_SYNTHETIC_PREFLIGHT_REQUIRED');
  verified=true;
  if(!await gate.financeVerified(signal))throw Error('TRIAL_CLOSED');
  const until=Math.min(workDeadline,clock()+dispatchWindowMs);
  if(until<=clock()||!await gate.authorize(until,signal))throw Error('TRIAL_CONTROLLER_DEADLINE');
  result=await waitFor(gate,s=>s.phase==='executing'&&s.admitted===true&&
    s.dispatchFinished===true,{signal,clock,deadline:until,pollMs});
  if(result.result?.state!=='synthetic')throw Error('TRIAL_SYNTHETIC_RESULT_REQUIRED');
 }catch(error){failed=error;}
 // The same controller always closes admissions. A fresh cleanup signal
 // allows rollback even after the execution deadline or caller cancellation.
 const recovery=AbortSignal.timeout(10000);
 let state;
 try{
  state=await gate.block(recovery)??await gate.read(recovery);
  if(state?.admitted&&!state?.dispatchFinished){
   const deadline=Date.now()+drainWaitMs;
   while(Date.now()<deadline){
    await delay(pollMs,undefined,{signal:recovery});
    state=await gate.read(recovery);
    if(state.dispatchFinished)break;
   }
   if(!state.dispatchFinished)throw Error('TRIAL_DISPATCH_DRAIN_UNCONFIRMED');
  }
  if(state?.admitted&&state.result?.state!=='synthetic')
   throw Error('TRIAL_SYNTHETIC_RECONCILIATION_UNCONFIRMED');
  if(state.phase!=='reversing'&&state.phase!=='reversed'&&!await gate.reversing(recovery))
   throw Error('TRIAL_REVERSING_UNCONFIRMED');
  if(state.phase!=='reversed'&&!await gate.reversed(recovery))
   throw Error('TRIAL_REVERSED_UNCONFIRMED');
 }catch(reversalError){
  // A failure is not falsely reported as success. Keep the durable gate closed.
  throw new AggregateError(failed?[failed,reversalError]:[reversalError],
    'TRIAL_CONTROLLER_RECONCILIATION_REQUIRED');
 }
 if(failed)throw failed;
 return {executionId:proof.executionId,phase:'reversed',synthetic:verified,
  result:result.result};
}
