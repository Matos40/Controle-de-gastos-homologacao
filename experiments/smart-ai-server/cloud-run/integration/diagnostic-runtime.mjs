import {createFirebaseVerifier} from '../../remote/auth.mjs';
import {FIREBASE_PROJECT,COMPUTE_PROJECT,COMPUTE_PROJECT_NUMBER,REGION,BACKEND_AUDIENCE,RUNTIME_IDENTITY} from '../projects.mjs';
import {createRuntimeAccess,createMetadataAccess} from '../runtime.mjs';
import {createPushVerifier} from '../security-guard.mjs';
import {createPrivateDiagnostic,diagnosticPath} from './private-diagnostic.mjs';

const origin=name=>'https://raytech-smart-ai-'+name+'-exp-'+COMPUTE_PROJECT_NUMBER+'.'+REGION+'.run.app';
const bridge='raytech-smart-ai-bridge@'+COMPUTE_PROJECT+'.iam.gserviceaccount.com';
const gateway='raytech-ai-gateway@'+COMPUTE_PROJECT+'.iam.gserviceaccount.com';
const client='raytech-smart-ai-diagnostic@'+COMPUTE_PROJECT+'.iam.gserviceaccount.com';
const services={
 bridge:{audience:origin('bridge'),caller:client,self:bridge,next:origin('gateway')},
 gateway:{audience:origin('gateway'),caller:bridge,self:gateway,next:BACKEND_AUDIENCE},
 backend:{audience:BACKEND_AUDIENCE,caller:gateway,self:RUNTIME_IDENTITY},
};
const proofHeader='x-raytech-diagnostic-proof';
const status=(res,code)=>{
 res.writeHead(code,{'cache-control':'no-store','x-content-type-options':'nosniff'});
 res.end();
};

export function mountDiagnostic(stage,env,{transport=fetch,identity}={}){
 const enabled=env.SMART_AI_PRIVATE_DIAGNOSTIC_ENABLED==='true';
 const {audience,caller,self,next}=services[stage];
 const email=stage==='bridge'?(env.SMART_AI_DIAGNOSTIC_CLIENT_EMAIL??caller):caller;
 const subject=env.SMART_AI_DIAGNOSTIC_CALLER_SUB;
 const verifyCaller=createPushVerifier();
 const verifyFirebase=createFirebaseVerifier(FIREBASE_PROJECT);
 const access=stage==='backend'?createRuntimeAccess(self):createMetadataAccess(self);
 const handler=createPrivateDiagnostic({
  enabled,expectedCaller:email,
  verifyFirebase:(token,signal)=>verifyFirebase(token,()=>access(transport,signal),transport,signal),
  forward:next&& (async(path,options)=>{
   const proof=await identity(next,transport,options.signal);
   options.headers.set('x-serverless-authorization','Bearer '+proof);
   options.headers.set(proofHeader,'Bearer '+proof);
   return transport(next+path,{...options,redirect:'error'});
  }),
 });

 return async(req,res)=>{
  if(req.url!==diagnosticPath&&!req.url.startsWith(diagnosticPath+'?'))return false;
  if(!enabled){status(res,503);return true;}
  if(req.url!==diagnosticPath){status(res,404);return true;}
  if(req.method!=='GET'){status(res,405);return true;}
  if(req.headers['transfer-encoding']||(req.headers['content-length']??'0')!=='0'||
   Object.keys(req.headers).some(name=>/^(x-goog-authenticated-|x-raytech-(caller|principal|iam)(-|$))/i.test(name))){
   status(res,400);return true;
  }
  const proofs=req.headersDistinct[proofHeader]??[];
  const proof=proofs.length===1?proofs[0].match(/^Bearer ([^\s,]{1,8192})$/)?.[1]:null;
  const abort=new AbortController();
  res.once('close',()=>abort.abort());
  const signal=AbortSignal.any([abort.signal,AbortSignal.timeout(8000)]);
  try{
   if(!proof||!/^\d{1,30}$/.test(subject??'')||!email.endsWith('@'+COMPUTE_PROJECT+'.iam.gserviceaccount.com'))
    throw Error('INVALID_DIAGNOSTIC_CALLER');
   // Cloud Run verifies the platform token. The container independently verifies the signed copy.
   await verifyCaller(proof,{audience,email,subject},transport,signal);
  }catch{status(res,403);return true;}
  const request=new Request(audience+diagnosticPath,{headers:new Headers(req.headers),signal});
  const response=await handler(request,email);
  res.writeHead(response.status,Object.fromEntries(response.headers));
  res.end(await response.text());
  return true;
 };
}
