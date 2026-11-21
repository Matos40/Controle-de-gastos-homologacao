import {requestIdentity} from '../gateway.mjs';
import {createMetadataAccess} from '../runtime.mjs';
import {createTrialGate} from './trial-readiness.mjs';
import {createRemoteTrialControlStore,TRIAL_PATH} from './trial-control-channel.mjs';
import {matchesStoredExecutionApproval} from './trial-execution-approval.mjs';
import {setTimeout as delay} from 'node:timers/promises';

const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);

// approved is controller-originated and must come from an independently checked
// Cloud Run Execution description, NOT from job-provided environment alone.
// A dedicated per-execution SA + Cloud Run IAM is required to bind proof to run.
export async function createBoundTrialJob({env,approved,verifyApproval,
 transport=fetch,identity=requestIdentity,metadataAccess=createMetadataAccess}={}){
 if(!approved)throw Error('TRIAL_EXECUTION_UNVERIFIED');
 const executionId=env?.CLOUD_RUN_EXECUTION,jobName=env?.CLOUD_RUN_JOB;
 if(!id(executionId)||!id(jobName)||executionId!==approved.executionId||
  jobName!==approved.jobName||!id(approved.runId)||!id(approved.requestId)||
  typeof approved.jobEmail!=='string'||typeof approved.endpoint!=='string'||
  !Number.isSafeInteger(approved.absoluteDeadline)||approved.absoluteDeadline<=Date.now())
  throw Error('TRIAL_EXECUTION_MISMATCH');
 const endpoint=new URL(approved.endpoint);
 if(endpoint.protocol!=='https:'||endpoint.pathname!==TRIAL_PATH||endpoint.search)
  throw Error('TRIAL_CONTROL_ENDPOINT');
 // Verify actual Google service account from metadata; a textual env email alone
 // never grants an execution permit.
 const access=metadataAccess(approved.jobEmail);
 await access(transport,AbortSignal.timeout(8000));
 const store=createRemoteTrialControlStore({endpoint:endpoint.href,role:'job',transport,
  identity:(audience,signal)=>identity(audience,transport,signal)});
 // The job is never allowed to self-certify: only the controller can persist
 // this immutable binding after its independently authenticated Admin API GET.
 let state;
 const deadline=Math.min(approved.absoluteDeadline,Date.now()+8000);
 for(;;){
  state=await store.read(AbortSignal.timeout(4000));
  if(state?.phase==='initializing'&&matchesStoredExecutionApproval(state.executionApproval,approved))break;
  if(state?.phase!=='provisioning'||Date.now()>=deadline)
   throw Error('TRIAL_EXECUTION_UNVERIFIED');
  await delay(100);
 }
 if(typeof verifyApproval==='function'&&!await verifyApproval(approved,state.executionApproval))
  throw Error('TRIAL_EXECUTION_UNVERIFIED');
 return {executionId,gate:createTrialGate({store,runId:approved.runId,
  requestId:approved.requestId,absoluteDeadline:approved.absoluteDeadline})};
}
