import {validRequestId} from '../../legacy/usage.mjs';
import {createMetadataAccess} from '../runtime.mjs';
import {requestIdentity} from '../gateway.mjs';
import {COMPUTE_PROJECT,REGION} from '../projects.mjs';
import {createRemoteTrialControlStore,TRIAL_PATH} from './trial-control-channel.mjs';
import {createTrialGate} from './trial-readiness.mjs';
import {pathToFileURL} from 'node:url';

// Controller-only, independently pinned approval. The job must never supply
// authority or the controller's expected execution UID.
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
const uid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(x);
const email=x=>typeof x==='string'&&/^[a-z][a-z0-9-]{2,60}@[a-z][a-z0-9-]+\.iam\.gserviceaccount\.com$/.test(x);
const keys=['executionId','jobName','jobEmail','executionUid','runId','requestId','absoluteDeadline','endpoint'];
function fields(binding){
 if(!binding||typeof binding!=='object'||Array.isArray(binding)||
    Object.keys(binding).some(k=>!keys.includes(k)&&k!=='verifiedAt')||
    !keys.every(k=>Object.hasOwn(binding,k)))return false;
 let url;
 try{url=new URL(binding.endpoint);}catch{return false;}
 return id(binding.executionId)&&id(binding.jobName)&&email(binding.jobEmail)&&
  uid(binding.executionUid)&&id(binding.runId)&&validRequestId(binding.requestId)&&
  Number.isSafeInteger(binding.absoluteDeadline)&&binding.absoluteDeadline>0&&
  url.protocol==='https:'&&url.pathname===TRIAL_PATH&&!url.search&&!url.hash&&
  url.username===''&&url.password==='';
}
export function validExecutionApproval(proof,{runId,requestId,absoluteDeadline,
 executionId,jobName,jobEmail,clock=Date.now}={}){
 if(!fields(proof)||!Number.isSafeInteger(proof.verifiedAt)||
    proof.verifiedAt<=0||proof.verifiedAt>clock()+30_000||
    proof.verifiedAt>=proof.absoluteDeadline)return false;
 return (runId===undefined||proof.runId===runId)&&
  (requestId===undefined||proof.requestId===requestId)&&
  (absoluteDeadline===undefined||proof.absoluteDeadline===absoluteDeadline)&&
  (executionId===undefined||proof.executionId===executionId)&&
  (jobName===undefined||proof.jobName===jobName)&&
  (jobEmail===undefined||proof.jobEmail===jobEmail);
}
export function matchesStoredExecutionApproval(stored,approved,{clock=Date.now}={}){
 if(!fields(approved)||!stored||!validExecutionApproval(stored,{clock}))return false;
 // verifiedAt is added only by the controller after a real Admin API GET.
 return keys.every(k=>stored[k]===approved[k]);
}
export async function verifyAndPinCloudRunExecution({approved,gate,accessToken,
 transport=fetch,clock=Date.now,signal=AbortSignal.timeout(8000)}={}){
 if(!fields(approved)||Object.hasOwn(approved,'verifiedAt')||!gate||
    typeof gate.initializing!=='function'||typeof accessToken!=='function'||
    clock()>=approved.absoluteDeadline)throw Error('TRIAL_APPROVAL_INVALID');
 const job='projects/'+COMPUTE_PROJECT+'/locations/'+REGION+'/jobs/'+approved.jobName;
 const name=job+'/executions/'+approved.executionId;
 const token=await accessToken(transport,signal);
 if(typeof token!=='string'||!token)throw Error('TRIAL_EXECUTION_UNVERIFIED');
 const response=await transport('https://run.googleapis.com/v2/'+name,{
  method:'GET',headers:{authorization:'Bearer '+token},redirect:'error',signal});
 if(!response.ok)throw Error('TRIAL_EXECUTION_UNVERIFIED');
 const execution=await response.json();
 const created=Date.parse(execution?.createTime);
 if(execution?.name!==name||execution.job!==job||
    execution.uid!==approved.executionUid||
    execution.template?.serviceAccount!==approved.jobEmail||
    execution.taskCount!==1||execution.parallelism!==1||
    execution.deleteTime||execution.completionTime||
    (execution.cancelledCount??0)>0||(execution.failedCount??0)>0||
    !Number.isFinite(created)||created>clock()+30_000||
    created>=approved.absoluteDeadline)throw Error('TRIAL_EXECUTION_MISMATCH');
 const proof=Object.freeze({...approved,verifiedAt:clock()});
 if(!await gate.initializing(proof,signal))throw Error('TRIAL_APPROVAL_ALREADY_USED');
 return proof;
}

// Runnable controller adapter. The approval JSON must be pinned by the trusted
// operator AFTER observing the Admin API UID, never populated from job env.
export async function bindControllerFromEnv({env=process.env,transport=fetch,
 clock=Date.now}={}){
 if(env.SMART_AI_TRIAL_CONTROLLER_ENABLED!=='true')
  throw Error('TRIAL_CONTROLLER_DISABLED');
 const account='raytech-ai-controller@'+COMPUTE_PROJECT+'.iam.gserviceaccount.com';
 if(env.SMART_AI_TRIAL_CONTROLLER_IDENTITY!==account||
    env.GOOGLE_CLOUD_PROJECT!==COMPUTE_PROJECT||
    env.FIRESTORE_EMULATOR_HOST||env.GOOGLE_APPLICATION_CREDENTIALS)
  throw Error('TRIAL_CONTROLLER_CONFIGURATION');
 let approved;
 try{approved=JSON.parse(env.SMART_AI_TRIAL_OPERATOR_APPROVAL_JSON??'');}
 catch{throw Error('TRIAL_CONTROLLER_CONFIGURATION');}
 if(!fields(approved)||Object.hasOwn(approved,'verifiedAt'))
  throw Error('TRIAL_CONTROLLER_CONFIGURATION');
 const accessToken=createMetadataAccess(account);
 const store=createRemoteTrialControlStore({endpoint:approved.endpoint,
  role:'controller',transport,identity:(audience,signal)=>requestIdentity(audience,transport,signal)});
 const gate=createTrialGate({store,runId:approved.runId,requestId:approved.requestId,
  absoluteDeadline:approved.absoluteDeadline,clock});
 return verifyAndPinCloudRunExecution({approved,gate,accessToken,transport,clock});
}

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 bindControllerFromEnv().then(proof=>{
  console.log(JSON.stringify({result:'TRIAL_EXECUTION_BOUND',executionId:proof.executionId,
   executionUid:proof.executionUid,jobName:proof.jobName}));
 }).catch(error=>{
  process.stderr.write('TRIAL_CONTROLLER_STOPPED: '+error.message+'\n');
  process.exitCode=1;
 });
}
