const routes=new Map([['/v1/credits','GET'],['/v1/invoices','POST'],['/v1/admin/ai','POST']]);
const invoiceCap=4*Math.ceil(10*1024*1024/3)+1024;

// The trusted transport owns IAM authentication. It is never passed to browser code.
export function createBridge({verifyFirebase,invoke,origin,clock=Date.now,limit=180,perUid=45}){
 let windowStart=clock(),requests=0;
 const users=new Map();
 return async request=>{
  const url=new URL(request.url);
  const deny=(status,error)=>Response.json({error},{status,headers:{'cache-control':'no-store'}});
  if(clock()-windowStart>=60000){windowStart=clock();requests=0;users.clear();}
  if(++requests>limit)return deny(429,'RATE_LIMIT');
  if(url.search||routes.get(url.pathname)!==request.method)return deny(404,'NOT_FOUND');
  if(request.headers.has('origin')&&request.headers.get('origin')!==origin)return deny(403,'ACCESS_DENIED');
  const token=request.headers.get('authorization')?.match(/^Bearer ([^\s,]{1,8192})$/)?.[1];
  if(!token)return deny(401,'ACCESS_DENIED');
  const signal=AbortSignal.any([request.signal,AbortSignal.timeout(30000)]);
  let identity;
  try{identity=await abortable(verifyFirebase(token,signal),signal);}catch{return deny(401,'ACCESS_DENIED');}
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(identity?.uid??''))return deny(401,'ACCESS_DENIED');
  const used=users.get(identity.uid)??0;
  if(used>=perUid)return deny(429,'RATE_LIMIT');
  users.set(identity.uid,used+1);
  const headers=new Headers({authorization:'Bearer '+token});
  let body;
  if(request.method==='POST'){
   const cap=url.pathname==='/v1/invoices'?invoiceCap:4096;
   const declared=request.headers.get('content-length');
   if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>cap))return deny(413,'FILE_TOO_LARGE');
   if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')??''))return deny(415,'INVALID_REQUEST');
   if(!request.body)return deny(400,'INVALID_REQUEST');
   const chunks=[],reader=request.body.getReader();
   let size=0;
   try{
    while(true){
     const {done,value}=await abortable(reader.read(),signal);
     if(done)break;
     size+=value.byteLength;
     if(size>cap)return deny(413,'FILE_TOO_LARGE');
     chunks.push(value);
    }
   }catch{return deny(400,'INVALID_REQUEST');}
   finally{void reader.cancel().catch(()=>{});}
   body=new Blob(chunks);
  }
  for(const key of ['content-type','x-request-id']){
   if(request.headers.has(key))headers.set(key,request.headers.get(key));
  }
  try{
   const result=await abortable(invoke(url.pathname,{method:request.method,headers,body,signal},identity),signal);
   if(result.status>=300&&result.status<400)return deny(502,'EXPERIMENT_UNAVAILABLE');
   return new Response(result.body,{status:result.status,headers:{'content-type':'application/json','cache-control':'no-store'}});
  }catch{return deny(503,'EXPERIMENT_UNAVAILABLE');}
 };
}
async function abortable(operation,signal){
 signal.throwIfAborted();
 let abort;
 try{return await Promise.race([operation,new Promise((_,reject)=>{
  abort=()=>reject(signal.reason);signal.addEventListener('abort',abort,{once:true});
 })]);}
 finally{if(abort)signal.removeEventListener('abort',abort);}
}
