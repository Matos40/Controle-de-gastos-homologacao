import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import {pathToFileURL} from 'node:url';
import {createRestStore} from '../../firestore.mjs';
import {createMetadataAccess} from '../runtime.mjs';
import {COMPUTE_PROJECT,FIREBASE_PROJECT} from '../projects.mjs';
import {createAuthenticatedTrialChannel,createFirestoreTrialControlStore,TRIAL_PATH} from './trial-control-channel.mjs';

const principal=x=>typeof x==='string'&&/^[a-z][a-z0-9-]{2,60}@[a-z][a-z0-9-]+\.iam\.gserviceaccount\.com$/.test(x);
const subject=x=>typeof x==='string'&&/^\d{1,30}$/.test(x);
const runId=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
const fail=(res,status)=>{res.writeHead(status,{'cache-control':'no-store','x-content-type-options':'nosniff'});res.end();};
const envKey=(env,key)=>{const value=env[key];if(typeof value!=='string'||!value)throw Error('TRIAL_CONTROL_CONFIGURATION');return value;};

// This entrypoint is separate from the commercial bridge/gateway/backend.
// The controller must pin an execution ID obtained independently from Cloud Run,
// and the job must use a dedicated, single-execution service account.
// An execution ID supplied only by the job is NOT sufficient proof.
export function trialControlConfig(env){
 if(env.SMART_AI_TRIAL_CONTROL_ENABLED!=='true')throw Error('TRIAL_CONTROL_DISABLED');
 if(env.FIRESTORE_EMULATOR_HOST||env.FIREBASE_AUTH_EMULATOR_HOST||env.GOOGLE_APPLICATION_CREDENTIALS||
    env.FIREBASE_PROJECT_ID!==FIREBASE_PROJECT||env.GOOGLE_CLOUD_PROJECT!==COMPUTE_PROJECT)
  throw Error('TRIAL_CONTROL_CONFIGURATION');
 const audience=envKey(env,'SMART_AI_TRIAL_CONTROL_AUDIENCE');
 const controllerEmail=envKey(env,'SMART_AI_TRIAL_CONTROLLER_EMAIL');
 const jobEmail=envKey(env,'SMART_AI_TRIAL_JOB_EMAIL');
 const self=envKey(env,'SMART_AI_TRIAL_CONTROL_IDENTITY');
 const controllerSub=envKey(env,'SMART_AI_TRIAL_CONTROLLER_SUB');
 const jobSub=envKey(env,'SMART_AI_TRIAL_JOB_SUB');
 const executionId=envKey(env,'SMART_AI_TRIAL_EXECUTION_ID');
 const absoluteDeadline=Number(envKey(env,'SMART_AI_TRIAL_ABSOLUTE_DEADLINE'));
 const project=envKey(env,'SMART_AI_TRIAL_FIRESTORE_PROJECT');
 const run=envKey(env,'SMART_AI_TRIAL_RUN_ID'),requestId=envKey(env,'SMART_AI_TRIAL_REQUEST_ID');
 if(!principal(controllerEmail)||!principal(jobEmail)||!principal(self)||
    controllerEmail===jobEmail||controllerEmail===self||jobEmail===self||
    !subject(controllerSub)||!subject(jobSub)||controllerSub===jobSub||
    !runId(run)||!runId(executionId)||!/^projects\/[^/]+\/databases\/\(default\)$/.test(project)||
    project!=='projects/'+FIREBASE_PROJECT+'/databases/(default)'||
    !/^https:\/\/[a-zA-Z0-9.-]+$/.test(audience)||
    !Number.isSafeInteger(absoluteDeadline)||absoluteDeadline<=Date.now())
  throw Error('TRIAL_CONTROL_CONFIGURATION');
 return {audience,controller:{email:controllerEmail,subject:controllerSub,audience},
  job:{email:jobEmail,subject:jobSub,audience},self,executionId,absoluteDeadline,
  project,runId:run,requestId};
}

export function makeTrialControlServer({handler,enabled=false}={}){
 return createServer({requestTimeout:10000,headersTimeout:5000,maxHeaderSize:12288},async(req,res)=>{
  if(!enabled||!handler)return fail(res,503);
  if(req.url!==TRIAL_PATH)return fail(res,404);
  if(req.method!=='POST')return fail(res,405);
  if(req.headers['transfer-encoding']||Number(req.headers['content-length']??0)>8192)return fail(res,413);
  const signal=AbortSignal.timeout(9000);
  try{
   const request=new Request('https://trial.internal.invalid'+TRIAL_PATH,
    {method:'POST',headers:new Headers(req.headers),body:Readable.toWeb(req),duplex:'half',signal});
   const response=await handler(request);
   res.writeHead(response.status,Object.fromEntries(response.headers));
   res.end(await response.text());
  }catch{if(!res.headersSent)fail(res,503);else res.end();}
 });
}

export function createTrialControlHandler({config,db,verifyGoogle,transport=fetch,clock=Date.now}){
 const store=createFirestoreTrialControlStore(db,{runId:config.runId});
 return createAuthenticatedTrialChannel({store,runId:config.runId,requestId:config.requestId,
  absoluteDeadline:config.absoluteDeadline,controller:config.controller,job:config.job,
  executionId:config.executionId,verifyGoogle,transport,clock});
}

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 const env=process.env;
 if(env.SMART_AI_TRIAL_CONTROL_ENABLED!=='true'){
  makeTrialControlServer().listen(Number(env.PORT??8080),'0.0.0.0');
 }else{
  const config=trialControlConfig(env);
  const access=createMetadataAccess(config.self);
  const base='https://firestore.googleapis.com/v1/'+config.project+'/documents';
  const db=createRestStore(config.project,base,()=>access(fetch,AbortSignal.timeout(9000)),undefined,fetch,{abortedRetries:3});
  const handler=createTrialControlHandler({config,db});
  makeTrialControlServer({handler,enabled:true}).listen(Number(env.PORT??8080),'0.0.0.0');
 }
}
