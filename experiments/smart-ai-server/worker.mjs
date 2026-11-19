import {Buffer} from 'node:buffer';
import {authorizePremium,FEATURE} from './legacy/policy.mjs';
import {extractInvoice} from './legacy/invoice.mjs';
import {createUsageStore,validRequestId} from './legacy/usage.mjs';
import {createOutcomeStore} from './legacy/outcome.mjs';
import {simulatedGemini} from './legacy/gemini-provider.mjs';
import {assertLocalEmulators} from './legacy/emulator-guard.mjs';
import {createEmulatorStore} from './firestore.mjs';
import {verifyEmulatorToken} from './auth.mjs';
import {geminiProvider} from './gemini.mjs';

const fileCap=2*1024*1024, encodedCap=4*Math.ceil(fileCap/3), requestCap=encodedCap+1024;
const origin='http://127.0.0.1:8787';
const reply=(status,body,cors={})=>Response.json(body,{status,headers:{...cors,'cache-control':'no-store','x-content-type-options':'nosniff'}});

async function boundedJson(request,signal) {
  const declared=request.headers.get('content-length');
  if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>requestCap))throw Error('FILE_TOO_LARGE');
  const reader=request.body?.getReader();
  if(!reader)throw Error('INVALID_FILE');
  const chunks=[];
  let length=0;
  const stop=()=>{void reader.cancel().catch(()=>{});};
  signal.addEventListener('abort',stop,{once:true});
  try {
    while(true){
      signal.throwIfAborted();
      const {done,value}=await reader.read();
      if(done)break;
      length+=value.length;
      if(length>requestCap)throw Error('FILE_TOO_LARGE');
      chunks.push(value);
    }
    signal.throwIfAborted();
    return JSON.parse(Buffer.concat(chunks,length).toString('utf8'));
  } finally {
    signal.removeEventListener('abort',stop);
    await reader.cancel().catch(()=>{});
  }
}

export function createWorker(transport=fetch) {
  return {async fetch(request,env) {
    const url=new URL(request.url);
    try{assertLocalEmulators(env);}catch{return reply(503,{error:'EXPERIMENT_UNAVAILABLE'});}
    if(url.origin!==origin||url.pathname!=='/v1/invoices'||url.search) return reply(404,{error:'NOT_FOUND'});
    const source=request.headers.get('origin');
    if(source!==null&&source!==origin)return reply(403,{error:'ACCESS_DENIED'});
    const cors=source?{'access-control-allow-origin':origin,vary:'Origin'}:{};
    if(request.method==='OPTIONS'&&source)return new Response(null,{status:204,headers:{...cors,
      'access-control-allow-methods':'POST','access-control-allow-headers':'authorization, content-type, x-request-id'}});
    if(request.method!=='POST')return reply(405,{error:'METHOD_NOT_ALLOWED'},cors);
    const headers={authorization:request.headers.get('authorization'),'x-request-id':request.headers.get('x-request-id')};
    const deadline=AbortSignal.any([AbortSignal.timeout(30000),request.signal]);
    const start=Date.now();
    const counts={subrequests:0,requestedFirestoreReads:0,confirmedFirestoreWrites:0};
    const counted=async(url,options)=>{
      counts.subrequests++;
      if(url.endsWith(':batchGet'))counts.requestedFirestoreReads+=JSON.parse(options.body).documents.length;
      const response=await transport(url,options);
      if(response.ok&&url.endsWith(':commit'))counts.confirmedFirestoreWrites+=JSON.parse(options.body).writes.length;
      return response;
    };
    const db=createEmulatorStore(deadline,counted);
    const verifyToken=token=>verifyEmulatorToken(token,deadline,counted);
    const readPermissions=uid=>db.runTransaction(async tx=>{
      const [account,role]=await tx.getAll(db.collection('raytechV345Accounts').doc(uid),db.collection('raytechV345Roles').doc(uid));
      return {account:account.data(),role:role.data()};
    },{readOnly:true});
    try {
      const auth=await authorizePremium({method:'POST',headers,body:{feature:FEATURE}},{verifyToken,readPermissions});
      if(auth.status!==200)return reply(auth.status,{error:'ACCESS_DENIED'},cors);
      if(!validRequestId(headers['x-request-id']))return reply(400,{error:'INVALID_REQUEST_ID'},cors);
      if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')??''))return reply(415,{error:'INVALID_FILE'},cors);
      let body;
      try{body=await boundedJson(request,deadline);}catch(e){
        return reply(deadline.aborted?504:e.message==='FILE_TOO_LARGE'?413:400,
          {error:deadline.aborted?'TIMEOUT':e.message==='FILE_TOO_LARGE'?'FILE_TOO_LARGE':'INVALID_FILE'},cors);
      }
      const value=body?.data;
      if(typeof value==='string'&&(value.length>encodedCap||value.length/4*3-(value.endsWith('==')?2:value.endsWith('=')?1:0)>fileCap))
        return reply(413,{error:'FILE_TOO_LARGE'},cors);
      const real=env.PROVIDER==='gemini-local';
      const configured=Number(env.GEMINI_CONFIRMED_FREE_DAILY_LIMIT);
      if(real&&(!Number.isInteger(configured)||configured<1||configured>100))return reply(503,{error:'PROVIDER_UNAVAILABLE'},cors);
      if(!real&&env.PROVIDER!=='simulated')return reply(503,{error:'PROVIDER_UNAVAILABLE'},cors);
      const day=real?configured:100;
      let metrics;
      const provider=real?geminiProvider(env.RAYTECH_GEMINI_API_KEY,counted,m=>{metrics=m;}):simulatedGemini;
      const reserveUsage=createUsageStore(db,{budget:{day,month:day*31,perAttempt:1},trackOutcomes:true,workspace:true});
      const result=await extractInvoice({method:'POST',headers,body},{verifyToken,readPermissions,reserveUsage,
        finishOutcome:createOutcomeStore(db),provider:file=>provider({...file,signal:AbortSignal.any([file.signal,deadline])})},
        {timeoutMs:27000});
      if(result.status===200){
        result.body.simulated=!real;
        result.body.metrics={...counts,...metrics,wallMs:Date.now()-start};
      }
      return reply(result.status,result.body,cors);
    }catch{return reply(deadline.aborted?504:503,{error:deadline.aborted?'TIMEOUT':'EXPERIMENT_UNAVAILABLE'},cors);}
  }};
}

export default createWorker();
