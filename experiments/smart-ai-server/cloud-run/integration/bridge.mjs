const routes=new Map([['/v1/credits','GET'],['/v1/invoices','POST'],['/v1/admin/ai','POST']]);

// The trusted transport owns IAM authentication. It is never passed to browser code.
export function createBridge({verifyFirebase,invoke,origin}){
 return async request=>{
  const url=new URL(request.url);
  const deny=(status,error)=>Response.json({error},{status,headers:{'cache-control':'no-store'}});
  if(url.search||routes.get(url.pathname)!==request.method)return deny(404,'NOT_FOUND');
  if(request.headers.has('origin')&&request.headers.get('origin')!==origin)return deny(403,'ACCESS_DENIED');
  const token=request.headers.get('authorization')?.match(/^Bearer ([^\s,]{1,8192})$/)?.[1];
  if(!token)return deny(401,'ACCESS_DENIED');
  let identity;
  try{identity=await verifyFirebase(token,request.signal);}catch{return deny(401,'ACCESS_DENIED');}
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(identity?.uid??''))return deny(401,'ACCESS_DENIED');
  const headers=new Headers({authorization:'Bearer '+token});
  for(const key of ['content-type','x-request-id']){
   if(request.headers.has(key))headers.set(key,request.headers.get(key));
  }
  try{
   const result=await invoke(url.pathname,{method:request.method,headers,body:request.body,signal:request.signal},identity);
   if(result.status>=300&&result.status<400)return deny(502,'EXPERIMENT_UNAVAILABLE');
   return new Response(result.body,{status:result.status,headers:{'content-type':'application/json','cache-control':'no-store'}});
  }catch{return deny(503,'EXPERIMENT_UNAVAILABLE');}
 };
}
