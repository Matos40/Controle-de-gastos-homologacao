import {COMPUTE_PROJECT,COMPUTE_PROJECT_NUMBER,FIREBASE_PROJECT,REGION} from '../projects.mjs';
import {requestIdentity} from '../gateway.mjs';
import {createBridge} from './bridge.mjs';
import {decodeInvoice} from '../invoice.mjs';
import {validRequestId} from '../../legacy/usage.mjs';
import {recentlyAuthenticated} from '../security-guard.mjs';

export const gatewayAudience='https://raytech-smart-ai-gateway-exp-'+COMPUTE_PROJECT_NUMBER+'.'+REGION+'.run.app';
export const bridgePrincipal='raytech-smart-ai-bridge@'+COMPUTE_PROJECT+'.iam.gserviceaccount.com';
const metadata='http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email';
const allowedAdmin=new Set(['overview','search','directory','credits','configure','reactivateFinance']);
const errors=new Set(['ACCESS_DENIED','REAUTH_REQUIRED','INVALID_REQUEST','INVALID_FILE','FILE_TOO_LARGE','RATE_LIMIT',
 'QUOTA_EXCEEDED','ACTIVE_REQUEST','DUPLICATE_REQUEST','GLOBAL_LIMIT','GLOBAL_BUDGET_EXCEEDED','USAGE_UNAVAILABLE',
 'EXPERIMENT_UNAVAILABLE','FINANCE_SUSPENDED','PROCESSING_FAILED','INVALID_REQUEST_ID','TIMEOUT','VERSION_CONFLICT','NOT_FOUND','ADMIN_UNAVAILABLE']);
const success={
 '/v1/credits':['plan','remaining','busy','nextRenewalDate','operational'],
 '/v1/invoices':['schemaVersion','entries','reconciliation','requiresReview'],
 '/v1/admin/ai':['settings','role','finance','security','periods','day','month','attemptsUtc','monthlyAverage','rows','nextCursor','uid','plan','remaining','busy','nextRenewalDate','audit','auditCount'],
};
const reply=(status,body)=>Response.json(body,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
const entryFields=['kind','title','date','amountCents','currentInstallment','installments'];
const reconciliationFields=['statementTotalCents','identifiedEntriesCents','priorBalanceCents','priorPaymentsCents',
 'balanceBasis','creditsAndRefundsCents','calculatedTotalCents','differenceCents','status','warnings','possibleDuplicateIndexes'];
function pick(data,keys){return Object.fromEntries(keys.filter(key=>Object.hasOwn(data,key)).map(key=>[key,data[key]]));}
const uidPattern=/^[A-Za-z0-9_-]{1,128}$/;

export function firebaseAdminVerifier(auth,{clock=Date.now}={}){
 return async token=>{
  const claims=await auth.verifyIdToken(token,true);
  const now=Math.floor(clock()/1000);
  if(claims.aud!==FIREBASE_PROJECT||claims.iss!=='https://securetoken.google.com/'+FIREBASE_PROJECT||
     !uidPattern.test(claims.uid??'')||claims.sub!==claims.uid||
     !Number.isSafeInteger(claims.exp)||claims.exp<=now||
     !Number.isSafeInteger(claims.iat)||claims.iat>now||
     !Number.isSafeInteger(claims.auth_time)||claims.auth_time<=0||claims.auth_time>claims.iat)throw Error('INVALID_TOKEN');
  return {uid:claims.uid,authTime:claims.auth_time,smartAiAdmin:claims.smartAiAdmin===true};
 };
}

async function gatewayIdentity(transport,signal){
 const response=await transport(metadata,{headers:{'Metadata-Flavor':'Google'},redirect:'manual',signal});
 if(!response.ok||response.headers.get('metadata-flavor')!=='Google'||(await response.text()).trim()!==bridgePrincipal)
  throw Error('WRONG_RUNTIME_IDENTITY');
 const token=await requestIdentity(gatewayAudience,transport,signal);
 const claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString());
 if(claims.aud!==gatewayAudience||!Number.isSafeInteger(claims.exp)||claims.exp<=Math.floor(Date.now()/1000))
  throw Error('INVALID_IAM_AUDIENCE');
 return token;
}

async function sanitize(path,upstream){
 if(!upstream.headers.get('content-type')?.startsWith('application/json'))return reply(502,{error:'EXPERIMENT_UNAVAILABLE'});
 const reader=upstream.body?.getReader(),chunks=[];
 let length=0;
 try{
  while(reader){
   const {done,value}=await reader.read();
   if(done)break;
   length+=value.byteLength;
   if(length>2*1024*1024)return reply(502,{error:'EXPERIMENT_UNAVAILABLE'});
   chunks.push(value);
  }
  const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if(!data||typeof data!=='object'||Array.isArray(data))throw Error('INVALID_RESPONSE');
  if(!upstream.ok)return reply(upstream.status,{error:errors.has(data.error)?data.error:'EXPERIMENT_UNAVAILABLE',
   ...(data.creditRefunded===true?{creditRefunded:true}:{})});
  if(path==='/v1/invoices'&&(data.requiresReview!==true||!Array.isArray(data.entries)||!data.reconciliation))
   return reply(502,{error:'EXPERIMENT_UNAVAILABLE'});
  const clean=pick(data,success[path]);
  if(path==='/v1/invoices'){
   clean.entries=data.entries.map(entry=>pick(entry,entryFields));
   clean.reconciliation=pick(data.reconciliation,reconciliationFields);
  }
  return reply(upstream.status,clean);
 }catch{return reply(502,{error:'EXPERIMENT_UNAVAILABLE'});}
 finally{void reader?.cancel().catch(()=>{});}
}

// Identity metadata and the HTTPS target are server-owned. The browser token remains distinct from IAM.
export function cloudBridge({origin,ownerUid,verifyFirebase,transport=fetch,identity=gatewayIdentity,clock=Date.now}){
 if(!uidPattern.test(ownerUid??''))throw Error('OWNER_CONFIGURATION_REQUIRED');
 const allowedOrigin=new URL(origin);
 if(allowedOrigin.origin!==origin||allowedOrigin.protocol!=='https:')throw Error('INVALID_UI_ORIGIN');
 return createBridge({origin,verifyFirebase,clock,limit:60,perUid:20,
  async invoke(path,options,caller){
   if(path==='/v1/invoices'){
    if(!validRequestId(options.headers.get('x-request-id')))return reply(400,{error:'INVALID_REQUEST_ID'});
    try{const file=decodeInvoice(JSON.parse(await options.body.text()));file.bytes.fill(0);}
    catch(error){return reply(error.message==='FILE_TOO_LARGE'?413:400,{error:error.message==='FILE_TOO_LARGE'?'FILE_TOO_LARGE':'INVALID_FILE'});}
   }
   if(path==='/v1/admin/ai'){
    let body;
    try{body=JSON.parse(await options.body.text());}catch{return reply(400,{error:'INVALID_REQUEST'});}
    if(!allowedAdmin.has(body?.action))return reply(400,{error:'INVALID_REQUEST'});
    const critical=['configure','reactivateFinance'].includes(body.action);
    if(caller.uid!==ownerUid&&(critical||caller.smartAiAdmin!==true))return reply(403,{error:'ACCESS_DENIED'});
    if(critical&&!recentlyAuthenticated(caller.authTime,clock()))return reply(403,{error:'REAUTH_REQUIRED'});
   }
   const token=await identity(transport,options.signal);
   options.headers.set('x-serverless-authorization','Bearer '+token);
   const upstream=await transport(gatewayAudience+path,{...options,redirect:'manual'});
   return sanitize(path,upstream);
  },
 });
}
