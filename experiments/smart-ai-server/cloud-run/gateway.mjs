import {createServer} from 'node:http';
import {Readable,Transform} from 'node:stream';
import {pathToFileURL} from 'node:url';
import {createFirebaseSignatureVerifier} from '../remote/auth.mjs';
import {corsFor} from './cors.mjs';
import {MAX_BYTES} from './invoice.mjs';
import {invalidLimiter} from './security-guard.mjs';
import {BACKEND_AUDIENCE,COMPUTE_PROJECT_NUMBER,FIREBASE_PROJECT} from './projects.mjs';
import {mountDiagnostic} from './integration/diagnostic-runtime.mjs';

const methods={'/v1/credits':'GET','/v1/invoices':'POST','/v1/admin/ai':'POST'};
const metadata='http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity';
const maxInvoiceBody=4*Math.ceil(MAX_BYTES/3)+1024;

export function backendAudience(number){
 if(number!==COMPUTE_PROJECT_NUMBER)throw Error('INVALID_COMPUTE_PROJECT');
 return BACKEND_AUDIENCE;
}

export async function requestIdentity(audience,transport,signal){
 const url=new URL(metadata);
 url.searchParams.set('audience',audience);url.searchParams.set('format','full');
 const response=await transport(url.href,{headers:{'Metadata-Flavor':'Google'},redirect:'manual',signal});
 if(!response.ok||response.headers.get('metadata-flavor')!=='Google')throw Error('IAM_IDENTITY_UNAVAILABLE');
 const token=(await response.text()).trim();
 if(!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)||token.length>8192)throw Error('IAM_IDENTITY_UNAVAILABLE');
 return token;
}

export function makeGateway({env=process.env,transport=fetch,
 verifySignature=createFirebaseSignatureVerifier(FIREBASE_PROJECT),identity=requestIdentity,
 security=event=>console.log(JSON.stringify(event))}={}){
 const configured=env.SMART_AI_GATEWAY_ENABLED==='true';
 const invalid=invalidLimiter();
 const audience=configured?backendAudience(env.SMART_AI_COMPUTE_PROJECT_NUMBER):null;
 const diagnostic=mountDiagnostic('gateway',env,{transport,identity});
 return createServer({requestTimeout:35000,headersTimeout:10000,maxHeaderSize:16384},async(req,res)=>{
  try{if(await diagnostic(req,res))return;}
  catch{if(!res.headersSent)res.writeHead(503,{'cache-control':'no-store'});res.end();return;}
  const cors=corsFor(req,env.SMART_AI_UI_ORIGIN);
  const fail=(status,error)=>{
   if([400,401,403,404,405,413,415].includes(status)&&invalid.record()===30)security({event:'smart_ai_security',code:'GATEWAY_INVALID_RATE'});
   res.writeHead(status,{'content-type':'application/json','cache-control':'no-store',...cors.headers});
   res.end(error?JSON.stringify({error}):undefined);
  };
  if(!configured)return fail(503,'EXPERIMENT_UNAVAILABLE');
  if(invalid.blocked())return fail(429,'RATE_LIMIT');
  if(cors.status)return fail(cors.status);
  if(!Object.hasOwn(methods,req.url))return fail(404,'NOT_FOUND');
  if(req.method!==methods[req.url])return fail(405,'METHOD_NOT_ALLOWED');
  const bearer=req.headers.authorization;
  if(!bearer||bearer.length>8192||!/^Bearer [^\s,]+$/.test(bearer))return fail(401,'ACCESS_DENIED');
  const isPost=req.method==='POST',cap=req.url==='/v1/admin/ai'?4096:maxInvoiceBody;
  if(isPost){
   if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']??''))return fail(415,'INVALID_REQUEST');
   const length=req.headers['content-length'];
   if(length!==undefined&&(!/^\d+$/.test(length)||Number(length)>cap))return fail(413,'FILE_TOO_LARGE');
  }
  const abort=new AbortController();
  res.on('close',()=>{if(!res.writableFinished)abort.abort();});
  const signal=AbortSignal.any([abort.signal,AbortSignal.timeout(35000)]);
  try{await verifySignature(bearer.slice(7),transport,signal);}
  catch{return fail(401,'ACCESS_DENIED');}
  let tooLarge=false;
  try{
   const serviceToken=await identity(audience,transport,signal);
   const headers={authorization:bearer,'x-serverless-authorization':'Bearer '+serviceToken};
   for(const key of ['content-type','content-length','x-request-id','origin']){
    if(req.headers[key]!==undefined)headers[key]=req.headers[key];
   }
   let size=0;
   const limiter=isPost?new Transform({transform(chunk,_encoding,callback){
    size+=chunk.length;
    if(size>cap){tooLarge=true;callback(Error('BODY_LIMIT'));return;}
    callback(null,chunk);
   }}):null;
   const body=isPost?Readable.toWeb(req.pipe(limiter)):undefined;
   const upstream=await transport(audience+req.url,{method:req.method,headers,signal,redirect:'manual',
    ...(body?{body,duplex:'half'}:{})});
   if([400,401,403,413,415].includes(upstream.status)&&invalid.record()===30)security({event:'smart_ai_security',code:'GATEWAY_INVALID_RATE'});
   if(upstream.status>=300&&upstream.status<400)return fail(502,'GATEWAY_UNAVAILABLE');
   const content=await upstream.text();
   res.writeHead(upstream.status,{'content-type':'application/json','cache-control':'no-store',...cors.headers});
   res.end(content);
  }catch{
   if(!res.destroyed)fail(tooLarge?413:signal.aborted?504:502,tooLarge?'FILE_TOO_LARGE':'GATEWAY_UNAVAILABLE');
  }
 });
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const port=Number(process.env.PORT??8080);
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('INVALID_PORT');
 makeGateway().listen(port,'0.0.0.0');
}
