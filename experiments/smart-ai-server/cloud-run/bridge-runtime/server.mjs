import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import {pathToFileURL} from 'node:url';
import {cloudBridge,firebaseAdminVerifier} from '../integration/cloud-bridge.mjs';
import {FIREBASE_PROJECT} from '../projects.mjs';
import {requestIdentity} from '../gateway.mjs';
import {mountDiagnostic} from '../integration/diagnostic-runtime.mjs';

const methods={'/v1/credits':'GET','/v1/invoices':'POST','/v1/admin/ai':'POST'};
const allowedHeaders=new Set(['authorization','content-type','x-request-id']);
export function makeBridgeServer({handler,origin,env=process.env,diagnosticTransport=fetch}={}){
 const diagnostic=mountDiagnostic('bridge',env,{transport:diagnosticTransport,identity:requestIdentity});
 return createServer({requestTimeout:30000,headersTimeout:5000,maxHeaderSize:24576},async(req,res)=>{
  res.setHeader('cache-control','no-store');
  res.setHeader('x-content-type-options','nosniff');
  res.setHeader('vary','Origin');
  const reject=(status,error)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify({error}));};
  try{if(await diagnostic(req,res))return;}catch{return reject(503,'DIAGNOSTIC_UNAVAILABLE');}
  if(!handler)return reject(503,'EXPERIMENT_UNAVAILABLE');
  if(!Object.hasOwn(methods,req.url))return reject(404,'NOT_FOUND');
  if(req.headers.origin!==origin)return reject(403,'ACCESS_DENIED');
  res.setHeader('access-control-allow-origin',origin);
  if(req.method==='OPTIONS'){
   const requested=String(req.headers['access-control-request-headers']??'').toLowerCase().split(',').map(h=>h.trim()).filter(Boolean);
   if(req.headers['access-control-request-method']!==methods[req.url]||requested.some(h=>!allowedHeaders.has(h)))return reject(403,'ACCESS_DENIED');
   res.writeHead(204,{'access-control-allow-methods':methods[req.url],
    'access-control-allow-headers':[...allowedHeaders].join(', '),'access-control-max-age':'300'});res.end();return;
  }
  if(req.method!==methods[req.url])return reject(405,'NOT_FOUND');
  const abort=new AbortController();
  res.on('close',()=>{if(!res.writableFinished)abort.abort();});
  try{
   const request=new Request(origin+req.url,{method:req.method,headers:new Headers(req.headers),signal:abort.signal,
    ...(req.method==='POST'?{body:Readable.toWeb(req),duplex:'half'}:{})});
   const response=await handler(request);
   res.writeHead(response.status,{'content-type':'application/json'});
   res.end(await response.text());
  }catch{if(!res.headersSent)reject(503,'EXPERIMENT_UNAVAILABLE');else res.end();}
 });
}

if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 const env=process.env;
 let handler;
 if(env.SMART_AI_BRIDGE_ENABLED==='true'){
  if(env.FIREBASE_AUTH_EMULATOR_HOST||env.FIRESTORE_EMULATOR_HOST||env.GOOGLE_APPLICATION_CREDENTIALS||
     env.FIREBASE_PROJECT_ID!==FIREBASE_PROJECT)throw Error('INVALID_BRIDGE_CONFIGURATION');
  const {initializeApp,applicationDefault}=await import('firebase-admin/app');
  const {getAuth}=await import('firebase-admin/auth');
  const auth=getAuth(initializeApp({projectId:FIREBASE_PROJECT,credential:applicationDefault()}));
  handler=cloudBridge({origin:env.SMART_AI_UI_ORIGIN,ownerUid:env.SMART_AI_OWNER_UID,verifyFirebase:firebaseAdminVerifier(auth)});
 }
 makeBridgeServer({handler,origin:env.SMART_AI_UI_ORIGIN}).listen(Number(env.PORT??8080),'0.0.0.0');
}
