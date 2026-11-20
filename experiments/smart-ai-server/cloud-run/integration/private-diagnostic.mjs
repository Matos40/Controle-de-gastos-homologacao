import {validRequestId} from '../../legacy/usage.mjs';

const statuses=new Map([[401,'authentication_rejected'],[403,'authorization_rejected'],
 [404,'route_or_ingress_unavailable'],[429,'rate_limited'],[503,'service_unavailable']]);

export async function probeLocalCredits({endpoint,origin,token,fetcher=fetch,timeoutMs=3000,clock=performance.now.bind(performance)}){
 const base=new URL(endpoint);
 if(base.origin!==endpoint||base.protocol!=='http:'||base.hostname!=='127.0.0.1'||!base.port)
  throw Error('LOOPBACK_REQUIRED');
 const start=clock(),signal=AbortSignal.timeout(timeoutMs);
 const observation=(outcome,status)=>({outcome,status,elapsedMs:Math.max(0,Math.round(clock()-start))});
 try{
  const response=await fetcher(base.origin+'/v1/credits',{headers:{origin,...(token?{authorization:'Bearer '+token}:{})},
   signal,cache:'no-store',redirect:'error'});
  if(!response.ok){await response.body?.cancel();return observation(statuses.get(response.status)??'rejected',response.status);}
  if(response.status!==200||!response.headers.get('content-type')?.startsWith('application/json')){
   await response.body?.cancel();return observation('invalid_response',response.status);
  }
  const balance=await response.json();
  const cap=balance?.plan==='premium'?15:2;
  if(!['free','premium'].includes(balance?.plan)||!Number.isInteger(balance.remaining)||
   balance.remaining<0||balance.remaining>cap||typeof balance.busy!=='boolean'){
   return observation('invalid_response',200);
  }
  return observation('credits_verified',200);
 }catch{return observation(signal.aborted?'deadline':'transport_or_response_error',null);}
}

// An HTTP timeout cannot establish whether admission occurred or settlement finished.
export function assessInterruptedExtraction({requestId,ledgerStatus}){
 if(!validRequestId(requestId))
  throw Error('REQUEST_ID_REQUIRED');
 if(ledgerStatus==='completed'||ledgerStatus==='failed')return {requestId,outcome:ledgerStatus,action:'refresh_balance'};
 if(ledgerStatus==='pending')return {requestId,outcome:'pending',action:'wait_for_settlement'};
 return {requestId,outcome:'unknown',action:'reconcile_before_retry'};
}

export const diagnosticPath='/internal/smart-ai/diagnostic';
const syntheticReply={status:'ok',mode:'diagnostic',provider:'none'};
const result=(status,body)=>Response.json(body,{status,headers:{'cache-control':'no-store'}});

// The caller is supplied by the authenticated transport, never by request headers.
// This candidate is intentionally not mounted by any service entry point.
export function createPrivateDiagnostic({
 enabled=false,expectedCaller,verifyFirebase,forward,
}={}){
 return async (request,caller)=>{
  const url=new URL(request.url);
  if(url.pathname!==diagnosticPath||url.search)return result(404,{error:'NOT_FOUND'});
  if(request.method!=='GET')return result(405,{error:'METHOD_NOT_ALLOWED'});
  if(!enabled)return result(503,{error:'DIAGNOSTIC_DISABLED'});
  if(!expectedCaller||caller!==expectedCaller)return result(403,{error:'ACCESS_DENIED'});
  const token=request.headers.get('authorization')?.match(/^Bearer ([^\s,]{1,8192})$/)?.[1];
  if(!token)return result(401,{error:'ACCESS_DENIED'});
  try{
   const identity=await verifyFirebase(token,request.signal);
   if(!/^[A-Za-z0-9_-]{1,128}$/.test(identity?.uid??''))return result(401,{error:'ACCESS_DENIED'});
  }catch{return result(401,{error:'ACCESS_DENIED'});}
  if(!forward)return result(200,syntheticReply);
  try{
   const upstream=await forward(diagnosticPath,{method:'GET',headers:new Headers({authorization:'Bearer '+token}),signal:request.signal});
   if([401,403,404,503].includes(upstream.status)){await upstream.body?.cancel();return result(upstream.status,{error:'DIAGNOSTIC_REJECTED'});}
   if(upstream.status!==200){await upstream.body?.cancel();return result(502,{error:'DIAGNOSTIC_UNAVAILABLE'});}
   const payload=await upstream.json();
   if(payload?.status==='ok'&&payload.mode==='diagnostic'&&payload.provider==='none')return result(200,syntheticReply);
  }catch{}
  return result(502,{error:'DIAGNOSTIC_UNAVAILABLE'});
 };
}

export function createExtractionReconciliation(requestId){
 if(!validRequestId(requestId))throw Error('REQUEST_ID_REQUIRED');
 return {
  async check(candidateId,lookup){
   if(candidateId!==requestId)throw Error('REQUEST_ID_CHANGED');
   const ledgerStatus=await lookup(requestId);
   return assessInterruptedExtraction({requestId,ledgerStatus});
  },
 };
}
