import {setTimeout as delay} from 'node:timers/promises';
import {pathToFileURL} from 'node:url';
import {requestIdentity} from '../gateway.mjs';
import {createMetadataAccess} from '../runtime.mjs';
import {COMPUTE_PROJECT} from '../projects.mjs';
import {createRemoteTrialControlStore,TRIAL_PATH} from './trial-control-channel.mjs';
import {validExecutionApproval} from './trial-execution-approval.mjs';
import {createBoundTrialJob} from './trial-job-binding.mjs';

// This entrypoint is a deliberate fake dispatch. No Gemini client, financial
// repository, user invoice or credits module is imported.
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
export async function runSyntheticTrialJob({env=process.env,transport=fetch,
 identity=requestIdentity,metadataAccess=createMetadataAccess,
 bindJob=createBoundTrialJob,clock=Date.now,pollMs=200}={}){
 if(env.SMART_AI_TRIAL_SYNTHETIC_ONLY!=='true'||
    env.GOOGLE_CLOUD_PROJECT!==COMPUTE_PROJECT||env.GOOGLE_APPLICATION_CREDENTIALS||
    env.FIRESTORE_EMULATOR_HOST||!id(env.CLOUD_RUN_EXECUTION)||!id(env.CLOUD_RUN_JOB)||
    !id(env.SMART_AI_TRIAL_RUN_ID)||
    typeof env.SMART_AI_TRIAL_REQUEST_ID!=='string'||
    !Number.isSafeInteger(Number(env.SMART_AI_TRIAL_ABSOLUTE_DEADLINE))||
    !Number.isSafeInteger(pollMs)||pollMs<1||pollMs>2000)
  throw Error('TRIAL_WORKER_CONFIGURATION');
 const absoluteDeadline=Number(env.SMART_AI_TRIAL_ABSOLUTE_DEADLINE);
 const endpoint=env.SMART_AI_TRIAL_CONTROL_ENDPOINT;
 let url;
 try{url=new URL(endpoint);}catch{throw Error('TRIAL_WORKER_CONFIGURATION');}
 if(url.protocol!=='https:'||url.pathname!==TRIAL_PATH||url.search||
    url.hash||url.username||url.password||absoluteDeadline<=clock())
  throw Error('TRIAL_WORKER_CONFIGURATION');
 const store=createRemoteTrialControlStore({endpoint:url.href,role:'job',transport,
  identity:(audience,signal)=>identity(audience,transport,signal)});
 const stop=Math.min(absoluteDeadline,clock()+120000);
 let approved;
 while(clock()<stop){
  const state=await store.read(AbortSignal.timeout(4000));
  if(state?.phase==='initializing'&&
     validExecutionApproval(state.executionApproval,{clock,
      runId:env.SMART_AI_TRIAL_RUN_ID,requestId:env.SMART_AI_TRIAL_REQUEST_ID,
      absoluteDeadline,executionId:env.CLOUD_RUN_EXECUTION,
      jobName:env.CLOUD_RUN_JOB})){
   approved=state.executionApproval;break;
  }
  if(state&&state.phase!=='provisioning')throw Error('TRIAL_EXECUTION_UNVERIFIED');
  await delay(pollMs);
 }
 if(!approved)throw Error('TRIAL_EXECUTION_UNVERIFIED');
 const {gate,executionId}=await bindJob({env,approved,transport,identity,metadataAccess,clock});
 const maxWait=async(predicate)=>{
  while(clock()<absoluteDeadline){
   const current=await gate.read(AbortSignal.timeout(4000));
   if(predicate(current))return current;
   if(['reconciling','reversing','reversed'].includes(current.phase))throw Error('TRIAL_CLOSED');
   await delay(pollMs);
  }
  throw Error('TRIAL_WORKER_DEADLINE');
 };
 const uid='synthetic-user';
 if(!await gate.identityReady(executionId,uid))throw Error('TRIAL_EXECUTION_UNVERIFIED');
 await maxWait(s=>s.phase==='identity-ready'&&s.profilePrepared===true);
 if(!await gate.privateReady(executionId))throw Error('TRIAL_CLOSED');
 await maxWait(s=>s.phase==='authorized');
 const [first,second]=await Promise.all([gate.claim(executionId),gate.claim(executionId)]);
 if(Number(Boolean(first))+Number(Boolean(second))!==1)
  throw Error('TRIAL_DOUBLE_CLAIM_INTEGRITY');
 if(!await gate.report(executionId,{state:'synthetic'}))throw Error('TRIAL_REPORT_UNCONFIRMED');
 return {state:'synthetic',executionId,accepted:1,rejected:1};
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 runSyntheticTrialJob().then(outcome=>{
  console.log(JSON.stringify({result:'TRIAL_SYNTHETIC_DISPATCH_RECORDED',...outcome}));
 }).catch(error=>{
  process.stderr.write('TRIAL_SYNTHETIC_WORKER_STOPPED: '+error.message+'\n');
  process.exitCode=1;
 });
}
