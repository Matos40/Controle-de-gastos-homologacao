const methods={'/v1/credits':'GET','/v1/invoices':'POST','/v1/admin/ai':'POST'};
const allowedHeaders=new Set(['authorization','content-type','x-request-id']);

export function trustedOrigin(value,configured){
 if(!value||value!==configured)return false;
 try{const url=new URL(configured);return url.protocol==='https:'&&url.origin===configured;}
 catch{return false;}
}

export function corsFor(req,configured){
 const origin=req.headers.origin,isApi=Object.hasOwn(methods,req.url);
 if(!isApi)return req.method==='OPTIONS'?{status:404,headers:{}}:{headers:{}};
 const headers={vary:'Origin'};
 if(origin!==undefined){
  if(!trustedOrigin(origin,configured))return {status:403,headers};
  headers['access-control-allow-origin']=origin;
 }
 if(req.method!=='OPTIONS')return {headers};
 headers.vary+=', Access-Control-Request-Method, Access-Control-Request-Headers';
 const requested=(req.headers['access-control-request-headers']??'').toLowerCase().split(',')
  .map(value=>value.trim()).filter(Boolean);
 if(!origin||req.headers['access-control-request-method']!==methods[req.url]||
    requested.some(value=>!allowedHeaders.has(value)))return {status:403,headers};
 return {status:204,headers:{...headers,'access-control-allow-methods':methods[req.url],
  'access-control-allow-headers':[...allowedHeaders].join(', '),'access-control-max-age':'300'}};
}
