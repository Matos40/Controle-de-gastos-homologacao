import {validRequestId} from '../../legacy/usage.mjs';

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
 (s.until===undefined||Number.isSafeInteger(s.until));
}

// Caller identity is verified separately; role is never inferred from client-supplied claims.
export function authorizeTransition(before,next,{role,executionId,clock=Date.now}){
 if(!next||!Number.isSafeInteger(next.revision)||next.revision!==(before?.revision??0)+1)return false;
 if(next.admitted===true&&role!=='job'&&before?.admitted!==true)return false;
 if(before&&(!validState(before,next.runId,next.requestId,next.absoluteDeadline)||
   !only(before,next,['phase','revision','executionId','uid','profilePrepared','until','admitted','dispatchFinished','result'])))return false;
 if(!before)return role==='controller'&&next.phase==='initializing'&&next.admitted===false&&
  next.profilePrepared===undefined&&next.until===undefined&&next.executionId===undefined&&
  only({runId:next.runId,requestId:next.requestId,absoluteDeadline:next.absoluteDeadline,
   phase:'provisioning',revision:0,admitted:false},next,['phase','revision']);
 if(end.has(before.phase)&&role==='job')return false;
 const now=clock();
 if(role==='controller'){
  if(next.phase==='reconciling'&&!end.has(before.phase))
   return next.until===0&&only(before,next,['revision','phase','until']);
  if(now>=before.absoluteDeadline)return false;
  if(before.phase==='identity-ready'&&next.phase==='identity-ready')
   return next.profilePrepared===true&&only(before,next,['revision','profilePrepared']);
  if(before.phase==='private-ready'&&next.phase==='finance-verified')
   return only(before,next,['revision','phase']);
  if(before.phase==='finance-verified'&&next.phase==='authorized')
   return Number.isSafeInteger(next.until)&&now<next.until&&next.until<=before.absoluteDeadline&&
    only(before,next,['revision','phase','until']);
  if(before.phase==='reconciling'&&next.phase==='reversing'||
     before.phase==='reversing'&&next.phase==='reversed')
   return only(before,next,['revision','phase']);
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
  async read(){const snap=await ref.get();return snap.exists?snap.data():null;},
  async compareAndSet(revision,next,guard){
   return db.runTransaction(async tx=>{
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
  controller,job,executionId,verifyGoogle,clock=Date.now}={}){
 if(!id(runId)||!validRequestId(requestId)||!Number.isSafeInteger(absoluteDeadline)||
  !id(executionId)||!controller?.email||!controller?.subject||!job?.email||!job?.subject||
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
   const principal=await verifyGoogle(proof,request.signal);
   const allowed=expected[role];
   if(principal?.email!==allowed.email||principal?.subject!==allowed.subject||
    principal?.audience!==allowed.audience)return reject(403,'ACCESS_DENIED');
  }catch{return reject(401,'ACCESS_DENIED');}
  let command;
  try{
   const raw=await request.text();
   if(raw.length>8192)throw Error('TOO_LARGE');
   command=JSON.parse(raw);
  }catch{return reject(400,'INVALID_REQUEST');}
  if(!command||typeof command!=='object'||Array.isArray(command)||!['read','cas'].includes(command.action))
   return reject(400,'INVALID_REQUEST');
  if(clock()>=absoluteDeadline&&command.action==='cas'&&command.next?.phase!=='reconciling')
   return reject(409,'TRIAL_CLOSED');
  try{
   if(command.action==='read'){
    if(Object.keys(command).length!==1)return reject(400,'INVALID_REQUEST');
    const state=await store.read();
    return Response.json({state},{headers:{'cache-control':'no-store'}});
   }
   if(Object.keys(command).sort().join(',')!=='action,next,revision'||
    !Number.isSafeInteger(command.revision)||command.revision<0||
    !validState(command.next,runId,requestId,absoluteDeadline))
    return reject(400,'INVALID_REQUEST');
   const applied=await store.compareAndSet(command.revision,command.next,
    (before,next)=>authorizeTransition(before,next,{role,executionId,clock}));
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
 };
}
