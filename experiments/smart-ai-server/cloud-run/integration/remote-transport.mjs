const allowed=new Map([['/v1/credits','GET'],['/v1/invoices','POST'],['/v1/admin/ai','POST']]);

// The trusted bootstrap supplies configuration. No storage, URL or query flags are read here.
export function createSmartAiTransport({remoteEnabled=false,endpoint,expectedOrigin,fetcher=fetch,timeoutMs=30000}={}){
 let base='';
 if(remoteEnabled){
  const url=new URL(endpoint);
  if(url.protocol!=='https:'||url.origin!==expectedOrigin||url.pathname!=='/'||url.search||url.hash||url.username||url.password)
   throw Error('INVALID_BRIDGE_ORIGIN');
  base=url.origin;
 }
 return async(path,options={})=>{
  if(allowed.get(path)!==(options.method??'GET'))throw Error('INVALID_REMOTE_OPERATION');
  const signal=AbortSignal.any([AbortSignal.timeout(timeoutMs),...(options.signal?[options.signal]:[])]);
  const headers=new Headers();
  for(const key of ['authorization','content-type','x-request-id']){
   const value=new Headers(options.headers).get(key);
   if(value)headers.set(key,value);
  }
  let body=options.body;
  if(base&&path==='/v1/admin/ai'&&typeof body==='string'){
   const request=JSON.parse(body);
   if(request.action==='search'){
    const term=request.prefix.trim();
    const field=term.startsWith('uid:')?'uid':term.includes('@')?'email':'name';
    body=JSON.stringify({action:'directory',field,term:field==='uid'?term.slice(4).trim():term,cursor:request.cursor??null});
   }
  }
  try{
   const response=await fetcher(base+path,{method:options.method,body,headers,signal,
    cache:'no-store',credentials:'omit',redirect:'error'});
   if(!response.headers.get('content-type')?.startsWith('application/json'))throw Error('INVALID_RESPONSE');
   return response;
  }catch(error){
   if(signal.aborted&&!options.signal?.aborted)throw Error('TIMEOUT');
   throw error;
  }
 };
}
