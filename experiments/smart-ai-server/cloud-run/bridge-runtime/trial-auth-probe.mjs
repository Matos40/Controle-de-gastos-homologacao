import {pathToFileURL} from 'node:url';
import {requestIdentity} from '../gateway.mjs';
import {COMPUTE_PROJECT} from '../projects.mjs';
import {TRIAL_PATH} from './trial-control-channel.mjs';

// This entrypoint is intentionally separate from trial-job-runtime.mjs.
// One authenticated read; no controller, CAS, admission, Gemini, financial code
// or retry. Never pass a token to stdout, stderr or an error message.
export const PROBE_WORKER_EMAIL='raytech-ai-control-job-08645@raytech-3d.iam.gserviceaccount.com';
const METADATA_EMAIL='http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email';
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
const subject=x=>typeof x==='string'&&/^\d{1,30}$/.test(x);
const fail=code=>{throw Error(code);};

function safeIdentityClaims(jwt,{audience,email,sub,now}){
 try{
  if(typeof jwt!=='string'||jwt.length>8192||
     !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(jwt))
   return false;
  const [header,payload]=jwt.split('.');
  const h=JSON.parse(Buffer.from(header,'base64url').toString('utf8'));
  const p=JSON.parse(Buffer.from(payload,'base64url').toString('utf8'));
  return h?.alg==='RS256'&&p?.aud===audience&&p?.email===email&&
   p?.sub===sub&&['https://accounts.google.com','accounts.google.com'].includes(p?.iss)&&
   Number.isSafeInteger(p?.iat)&&Number.isSafeInteger(p?.exp)&&
   p.iat<=now+30&&p.exp>now&&p.exp>p.iat;
 }catch{return false;}
}

// JWT inspection here is only a local consistency preflight: the private
// service MUST verify the actual Google signature and exact principal.
export async function runSingleReadProbe({env=process.env,transport=fetch,
 identity=requestIdentity,clock=Date.now,
 signal=AbortSignal.timeout(15000)}={}){
 const deadline=Number(env.SMART_AI_TRIAL_ABSOLUTE_DEADLINE);
 let target;
 try{target=new URL(env.SMART_AI_TRIAL_CONTROL_ENDPOINT);}catch{
  return fail('TRIAL_PROBE_CONFIGURATION');
 }
 if(env.SMART_AI_TRIAL_PROBE_ONLY!=='true'||
    env.SMART_AI_TRIAL_SYNTHETIC_ONLY!=='true'||
    env.GOOGLE_CLOUD_PROJECT!==COMPUTE_PROJECT||
    env.GOOGLE_APPLICATION_CREDENTIALS||env.FIRESTORE_EMULATOR_HOST||
    env.CLOUD_RUN_JOB!=='raytech-ai-trial-worker'||!id(env.CLOUD_RUN_EXECUTION)||
    !subject(env.SMART_AI_TRIAL_JOB_SUB)||
    target.protocol!=='https:'||target.pathname!==TRIAL_PATH||
    target.search||target.hash||target.username||target.password||
    target.origin!==env.SMART_AI_TRIAL_CONTROL_AUDIENCE||
    !Number.isSafeInteger(deadline)||deadline<=clock())
  return fail('TRIAL_PROBE_CONFIGURATION');

 signal.throwIfAborted();
 const emailResponse=await transport(METADATA_EMAIL,{headers:{'Metadata-Flavor':'Google'},
  redirect:'error',signal});
 if(emailResponse.status!==200||emailResponse.headers.get('metadata-flavor')!=='Google')
  return fail('TRIAL_PROBE_METADATA_UNAVAILABLE');
 const email=(await emailResponse.text()).trim();
 if(email!==PROBE_WORKER_EMAIL)return fail('TRIAL_PROBE_WRONG_IDENTITY');
 if(clock()>=deadline)return fail('TRIAL_PROBE_DEADLINE');

 const token=await identity(target.origin,transport,signal);
 const now=Math.floor(clock()/1000);
 if(!safeIdentityClaims(token,{audience:target.origin,email,
  sub:env.SMART_AI_TRIAL_JOB_SUB,now}))
  return fail('TRIAL_PROBE_TOKEN_MISMATCH');
 if(clock()>=deadline)return fail('TRIAL_PROBE_DEADLINE');

 // Precisely ONE application request, even on 401/403/5xx or malformed JSON.
 // The handler implements 'read' through a read-only database transaction.
 const response=await transport(target.href,{method:'POST',redirect:'error',signal,
  headers:{'content-type':'application/json','x-raytech-trial-role':'job',
   'x-raytech-trial-proof':'Bearer '+token,
   'x-serverless-authorization':'Bearer '+token},
  body:JSON.stringify({action:'read'})});
 if(response.status!==200)return fail('TRIAL_PROBE_HTTP_'+
  (Number.isInteger(response.status)?response.status:'UNKNOWN'));
 let body;
 try{body=await response.json();}catch{return fail('TRIAL_PROBE_RESPONSE_INVALID');}
 if(!body||typeof body!=='object'||Array.isArray(body)||
    Object.keys(body).length!==1||!Object.hasOwn(body,'state')||
    body.state!==null)return fail('TRIAL_PROBE_RESPONSE_INVALID');
 return Object.freeze({result:'TRIAL_PROBE_READ_OK',status:200,
  executionId:env.CLOUD_RUN_EXECUTION,job:env.CLOUD_RUN_JOB,
  identity:email,audience:target.origin,controlState:'absent'});
}

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 runSingleReadProbe().then(outcome=>console.log(JSON.stringify(outcome)))
  .catch(error=>{
   const code=typeof error?.message==='string'&&
    /^TRIAL_PROBE_[A-Z0-9_]+$/.test(error.message)?
    error.message:'TRIAL_PROBE_UNAVAILABLE';
   process.stderr.write('TRIAL_PROBE_STOPPED: '+code+'\n');
   process.exitCode=1;
  });
}
