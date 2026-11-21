import {validRequestId} from '../../legacy/usage.mjs';
import {createPushVerifier} from '../security-guard.mjs';
import {validExecutionApproval} from './trial-execution-approval.mjs';

export const TRIAL_COLLECTION='raytechLabTrialControlV350';
export const TRIAL_PATH='/internal/smart-ai/trial-control';
const phases=new Set(['provisioning','initializing','identity-ready','private-ready','finance-verified','authorized','executing','reconciling','reversing','reversed']);
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const reject=(status,error)=>Response.json({error},{status,headers:{'cache-control':'no-store'}});
const end=new Set(['reconciling','reversing','reversed']);
const changed=(a,b)=>Object.keys({...a,...b}).filter(k=>!equal(a?.[k],b?.[k]));
const only=(a,b,keys)=>changed(a,b).every(k=>keys.includes(k));

function validState(s,runId,requestId,deadline){
 return s&&typeof s==='object'&&!Array.isArray(s)&&s.runId===runId&&s.requestId===requestId&&
 s.absoluteDeadline===deadline&&Number.isSafeInteger(s.revision)&&s.revision>=0&&
 phases.has(s.phase)&&typeof s.admitted==='boolean'&&
 (s.executionId===undefined||id(s.executionId))&&
 (s.uid===undefined||id(s.uid))&&
 (s.until===undefined||Number.isSafeInteger(s.until))&&
 (s.lateClaimRejected===undefined||s.lateClaimRejected===true);
}

// Caller identity is verified separately; role is never inferred from client-supplied claims.
export function authorizeTransition(before,next,{role,executionId,jobName,jobEmail,clock=Date.now}){
 if(!next||!Number.isSafeInteger(next.revision)||next.revision!==(before?.revision??0)+1)return false;
 if(!validExecutionApproval(next.executionApproval,{runId:next.runId,
  requestId:next.requestId,absoluteDeadline:next.absoluteDeadline,
  executionId,jobName,jobEmail,clock}))return false;
 if(next.admitted===true&&role!=='job'&&before?.admitted!==true)return false;
 if(before&&(!validState(before,next.runId,next.requestId,next.absoluteDeadline)||
   !only(before,next,['phase','revision','executionId','uid','profilePrepared','until','admitted','dispatchFinished','result','lateClaimRejected'])))return false;
 if(!before)return role==='controller'&&next.phase==='initializing'&&next.admitted===false&&
  next.profilePrepared===undefined&&next.until===undefined&&next.executionId===undefined&&
  only({runId:next.runId,requestId:next.requestId,absoluteDeadline:next.absoluteDeadline,
   phase:'provisioning',revision:0,admitted:false},next,['phase','revision','executionApproval']);
 if(!validExecutionApproval(before.executionApproval,{runId:before.runId,
  requestId:before.requestId,absoluteDeadline:before.absoluteDeadline,
  executionId,jobName,jobEmail,clock}))return false;
 // The late request is an actual rejected claim recorded inside this gate.
 // Only the same authenticated job can attempt it, after the controller closed
 // admissions and after the original synthetic dispatch was reported.
 if(role==='job'&&before.phase==='reconciling'&&next.phase==='reconciling'&&
    before.executionId===executionId&&before.admitted===true&&
    before.dispatchFinished===true&&before.result?.state==='synthetic'&&
    before.lateClaimRejected!==true&&next.lateClaimRejected===true)
  return only(before,next,['revision','lateClaimRejected']);
 if(end.has(before.phase)&&role==='job')return false;
 const now=clock();
 if(role==='controller'){
  if(next.phase==='reconciling'&&!end.has(before.phase))
   return next.until===0&&only(before,next,['revision','phase','until']);
  // Cleanup must remain possible after an expired absolute trial deadline.
  if(before.phase==='reconciling'&&next.phase==='reversing'||
     before.phase==='reversing'&&next.phase==='reversed')
   return only(before,next,['revision','phase']);
  if(now>=before.absoluteDeadline)return false;
  if(before.phase==='identity-ready'&&next.phase==='identity-ready')
   return next.profilePrepared===true&&only(before,next,['revision','profilePrepared']);
  if(before.phase==='private-ready'&&next.phase==='finance-verified')
   return only(before,next,['revision','phase']);
  if(before.phase==='finance-verified'&&next.phase==='authorized')
   return Number.isSafeInteger(next.until)&&now<next.until&&next.until<=before.absoluteDeadline&&
    only(before,next,['revision','phase','until']);
  return false;
 }
 if(role==='job'){
  if(before.executionId!==undefined&&before.executionId!==executionId)return false;
  if(before.phase==='initializing'&&next.phase==='identity-ready')
   return next.executionId===executionId&&id(next.uid)&&only(before,next,['revision','phase','executionId','uid']);
  if(before.phase==='identity-ready'&&before.profilePrepared===true&&next.phase==='private-ready')
   return only(before,next,['revision','phase']);
  if(before.phase==='authorized'&&next.phase==='executing')
   return now<before.until&&next.admitted===true&&only(before,next,['revision','phase','admitted']);
  if(['executing','reconciling'].includes(before.phase)&&next.phase===before.phase&&before.admitted&&
   before.dispatchFinished!==true&&next.dispatchFinished===true)
   return only(before,next,['revision','dispatchFinished','result'])&&
    next.result!==undefined&&JSON.stringify(next.result).length<=512;
 }
 return false;
}

export function createFirestoreTrialControlStore(db,{runId}={}){
 if(!id(runId))throw Error('INVALID_TRIAL_RUN');
 const ref=db.collection(TRIAL_COLLECTION).doc(runId);
 return {
  async read(signal){signal?.throwIfAborted();return db.runTransaction(async tx=>{
   signal?.throwIfAborted();const snap=await tx.get(ref);return snap.exists?snap.data():null;
  },{readOnly:true});},
  async compareAndSet(revision,next,guard,signal){
   signal?.throwIfAborted();return db.runTransaction(async tx=>{
    signal?.throwIfAborted();
    const snap=await tx.get(ref),before=snap.exists?snap.data():null;
    if((before?.revision??0)!==revision||!guard(before,next))return false;
    if(before)tx.set(ref,next);else tx.create(ref,next);
    return true;
   });
  },
 };
}

// Must be mounted behind private Cloud Run IAM. verifyGoogle validates a signed
// audience-bound ID token and returns the verified service account principal.
export function createAuthenticatedTrialChannel({store,runId,requestId,absoluteDeadline,
  controller,job,jobName,executionId,verifyGoogle=createPushVerifier(),transport=fetch,clock=Date.now}={}){
 if(!id(runId)||!validRequestId(requestId)||!Number.isSafeInteger(absoluteDeadline)||
  !id(executionId)||!id(jobName)||!controller?.email||!controller?.subject||!job?.email||!job?.subject||
  typeof verifyGoogle!=='function')throw Error('INVALID_TRIAL_CHANNEL');
 const expected={controller,job};
 return async function handle(request){
  const url=new URL(request.url);
  if(url.pathname!==TRIAL_PATH||url.search)return reject(404,'NOT_FOUND');
  if(request.method!=='POST')return reject(405,'METHOD_NOT_ALLOWED');
  if(request.headers.get('content-type')!=='application/json')return reject(415,'INVALID_REQUEST');
  const role=request.headers.get('x-raytech-trial-role');
  if(!Object.hasOwn(expected,role))return reject(403,'ACCESS_DENIED');
  const proof=request.headers.get('x-raytech-trial-proof')?.match(/^Bearer ([^\s,]{1,8192})$/)?.[1];
  if(!proof)return reject(401,'ACCESS_DENIED');
  try{
   const allowed=expected[role];
   await verifyGoogle(proof,{audience:allowed.audience,email:allowed.email,
    subject:allowed.subject},transport,request.signal);
  }catch{return reject(401,'ACCESS_DENIED');}
  let command;
  try{
   const raw=await request.text();
   if(raw.length>8192)throw Error('TOO_LARGE');
   command=JSON.parse(raw);
  }catch{return reject(400,'INVALID_REQUEST');}
  if(!command||typeof command!=='object'||Array.isArray(command)||!['read','cas','late-claim'].includes(command.action))
   return reject(400,'INVALID_REQUEST');
  if(clock()>=absoluteDeadline&&command.action==='cas'&&
     !end.has(command.next?.phase))
   return reject(409,'TRIAL_CLOSED');
  try{
   if(command.action==='read'){
    if(Object.keys(command).length!==1)return reject(400,'INVALID_REQUEST');
    const state=await store.read();
    return Response.json({state},{headers:{'cache-control':'no-store'}});
   }
   if(command.action==='late-claim'){
    if(role!=='job')return reject(403,'ACCESS_DENIED');
    if(Object.keys(command).sort().join(',')!=='action,executionId'||
       command.executionId!==executionId)return reject(400,'INVALID_REQUEST');
    // This is a real attempt against the closed control gate, not an
    // unaudited job-side boolean. A successful attempt is never accepted.
    for(let attempt=0;attempt<8;attempt++){
     const before=await store.read();
     if(!before||before.phase!=='reconciling'||before.admitted!==true||
        before.dispatchFinished!==true||before.result?.state!=='synthetic'||
        before.executionId!==executionId||before.lateClaimRejected===true)
      return reject(409,'TRIAL_LATE_CLAIM_NOT_ELIGIBLE');
     const next={...before,lateClaimRejected:true,revision:before.revision+1};
     if(await store.compareAndSet(before.revision,next,
       (previous,candidate)=>authorizeTransition(previous,candidate,{
        role,executionId,jobName,jobEmail:job.email,clock})))
      return Response.json({accepted:false,rejectionRecorded:true},
       {headers:{'cache-control':'no-store'}});
    }
    return reject(409,'TRIAL_LATE_CLAIM_CONFLICT');
   }
   if(Object.keys(command).sort().join(',')!=='action,next,revision'||
    !Number.isSafeInteger(command.revision)||command.revision<0||
    !validState(command.next,runId,requestId,absoluteDeadline))
    return reject(400,'INVALID_REQUEST');
   const applied=await store.compareAndSet(command.revision,command.next,
    (before,next)=>authorizeTransition(before,next,{role,executionId,jobName,jobEmail:job.email,clock}));
   return Response.json({applied},{headers:{'cache-control':'no-store'}});
  }catch{return reject(503,'TRIAL_STORE_UNAVAILABLE');}
 };
}

// The remote client receives no Firestore credentials or direct financial writes.
export function createRemoteTrialControlStore({endpoint,role,identity,transport=fetch}={}){
 const url=new URL(endpoint);
 if(url.protocol!=='https:'||url.pathname!==TRIAL_PATH||url.search||!['controller','job'].includes(role)||
  typeof identity!=='function')throw Error('INVALID_TRIAL_ENDPOINT');
 const call=async(body,signal)=>{
  const token=await identity(url.origin,signal);
  const response=await transport(url.href,{method:'POST',redirect:'error',signal,
   headers:{'content-type':'application/json','x-raytech-trial-role':role,
    'x-raytech-trial-proof':'Bearer '+token,'x-serverless-authorization':'Bearer '+token},
   body:JSON.stringify(body)});
  if(!response.ok)throw Error('TRIAL_CHANNEL_UNAVAILABLE');
  return response.json();
 };
 return {
  async read(signal){return (await call({action:'read'},signal)).state;},
  async compareAndSet(revision,next,signal){
   return (await call({action:'cas',revision,next},signal)).applied===true;
  },
  async attemptLateClaim(executionId,signal){
   const outcome=await call({action:'late-claim',executionId},signal);
   return outcome.accepted===false&&outcome.rejectionRecorded===true;
  },
 };
}
