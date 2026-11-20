import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {Readable} from 'node:stream';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {fullAppAsset} from './full-app-assets.mjs';
import {createLab} from './lab.mjs';

const assets=new Map(Object.entries({
 '/':'integration/index.html','/integration/native-invoice.mjs':'integration/native-invoice.mjs','/integration/review-store.mjs':'integration/review-store.mjs','/integration/full-app-ui.mjs':'integration/full-app-ui.mjs',
 '/integration/full-app-scripts.mjs':'integration/full-app-scripts.mjs','/integration/lab.css':'integration/lab.css',
 '/integration/lab-ui.mjs':'integration/lab-ui.mjs','/integration/mount.mjs':'integration/mount.mjs',
 '/integration/review.mjs':'integration/review.mjs','/ux/smart-ai.css':'ux/smart-ai.css',
 '/ux/budget.mjs':'ux/budget.mjs',
 '/ux/smart-ai.mjs':'ux/smart-ai.mjs','/ux/smart-admin-ai.mjs':'ux/smart-admin-ai.mjs',
}));
const types={html:'text/html',css:'text/css',mjs:'text/javascript'};
export async function startLab({port=0,recovery=false,mode='reconciled',observedCents,vendorRoot=process.env.RAYTECH_APP_VENDOR??fileURLToPath(new URL('../../../../vendor/',import.meta.url))}={}){
 if(!['reconciled','divergent','incomplete','duplicates','failed','unavailable','suspended'].includes(mode))throw Error('INVALID_MODE');
 let origin,lab;
 const tokenLabs=new Map(),scenarios=new Map();
 const scenarioOptions={ 'free-1':{usedFree:1},'free-0':{usedFree:2},'premium-partial':{usedPremium:7},'premium-0':{usedPremium:15},
  unavailable:{mode:'unavailable'},administrative:{mode:'administrative'},suspended:{mode:'suspended',observedCents:750},
  'cost-0':{observedCents:0},'cost-15':{observedCents:150},'cost-25':{observedCents:250},
  'cost-50':{observedCents:500},'cost-75':{observedCents:750},'cost-100':{observedCents:1000},'cost-125':{observedCents:1250}};
 async function scenarioLab(name){
  if(!Object.hasOwn(scenarioOptions,name))return lab;
  if(!scenarios.has(name)){
   const isolated=createLab({origin,...scenarioOptions[name]});
   scenarios.set(name,isolated);
  }
  const isolated=scenarios.get(name);await isolated.ready;return isolated;
 }
 const server=createServer({requestTimeout:35000,headersTimeout:10000,maxHeaderSize:16384},async(req,res)=>{
  res.setHeader('cache-control','no-store');
  res.setHeader('x-content-type-options','nosniff');
  res.setHeader('content-security-policy',"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
  const send=(status,body)=>{
   res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(body));
  };
  try{
   if(!lab||req.headers.host!==new URL(origin).host||req.headers.origin&&req.headers.origin!==origin)return send(403,{error:'ACCESS_DENIED'});
   if(req.url==='/integration/recovery-invoice.mjs'&&req.method==='GET'){
    if(!recovery)return send(404,{error:'NOT_FOUND'});
    const data=await readFile(new URL('./recovery-invoice.mjs',import.meta.url));
    res.writeHead(200,{'content-type':'text/javascript'});return res.end(data);
   }
   if(req.method==='GET'&&req.url.startsWith('/app/')){
    const path=new URL(req.url,origin).pathname;
    const asset=await fullAppAsset(path,vendorRoot,new URL(req.url,origin).searchParams.get('reference')==='1',recovery);
    if(!asset)return send(404,{error:'NOT_FOUND'});
    res.setHeader('content-security-policy',"default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; font-src 'self'; manifest-src 'self'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'");
    res.writeHead(200,{'content-type':asset.type});
    return res.end(asset.data);
   }
   if(!recovery&&req.url==='/'&&req.method==='GET'){res.writeHead(302,{location:'/app/'});return res.end();}
   if(!recovery&&['/integration/lab-ui.mjs','/integration/mount.mjs'].includes(req.url))return send(404,{error:'NOT_FOUND'});
   if(assets.has(req.url)&&req.method==='GET'){
    const path=assets.get(req.url);
    const data=await readFile(new URL('../'+path,import.meta.url));
    res.writeHead(200,{'content-type':types[path.split('.').at(-1)]+'; charset=utf-8'});
    return res.end(data);
   }
   if(!['/lab/session','/v1/credits','/v1/admin/ai','/v1/invoices'].includes(req.url))return send(404,{error:'NOT_FOUND'});
   const abort=new AbortController();
   res.on('close',()=>{if(!res.writableFinished)abort.abort();});
   const signal=AbortSignal.any([abort.signal,AbortSignal.timeout(30000)]);
   const headers=new Headers(req.headers);
   const options={method:req.method,headers,signal};
   if(req.method==='POST'){
    if(!/^application\/json(?:;|$)/i.test(headers.get('content-type')??''))return send(415,{error:'INVALID_REQUEST'});
    const cap=req.url==='/v1/invoices'?4*Math.ceil(10*1024*1024/3)+1024:4096;
    if(Number(headers.get('content-length'))>cap)return send(413,{error:'FILE_TOO_LARGE'});
    let bytes=0;
    options.body=Readable.toWeb(req).pipeThrough(new TransformStream({transform(chunk,output){
     signal.throwIfAborted();bytes+=chunk.length;
     if(bytes>cap)throw Error('FILE_TOO_LARGE');output.enqueue(chunk);
    }}));
    options.duplex='half';
   }
   const request=new Request(origin+req.url,options);
   if(req.url==='/lab/session'){
    if(req.method!=='POST'||req.headers.origin!==origin)return send(403,{error:'ACCESS_DENIED'});
    const {action,profile,scenario}=await request.json();
    const old=headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1];
    const active=action==='login'?await scenarioLab(scenario):tokenLabs.get(old)??lab;
    if(action==='logout'){active.logout(old);tokenLabs.delete(old);return send(200,{});}
    const token=action==='login'?active.login(profile):action==='reauthenticate'&&old?active.login('owner',old):null;
    if(token){
     if(old)tokenLabs.delete(old);
     if(tokenLabs.size>=1000)tokenLabs.delete(tokenLabs.keys().next().value);
     tokenLabs.set(token,active);
    }
    return token?send(200,{token}):send(401,{error:'ACCESS_DENIED'});
   }
   const bearer=headers.get('authorization')?.slice(7);
   const result=await (tokenLabs.get(bearer)??lab).bridge(request);
   res.writeHead(result.status,{'content-type':'application/json'});
   res.end(await result.text());
  }catch{if(!res.headersSent)send(400,{error:'INVALID_REQUEST'});else res.end();}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
 origin='http://127.0.0.1:'+server.address().port;
 lab=createLab({origin,mode,observedCents});
 await lab.ready;
 return {origin,close:()=>new Promise(resolve=>server.close(resolve))};
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 const {origin}=await startLab({port:8784,mode:process.argv[2]});
 console.log('Laboratório Smart AI · '+origin);
}
