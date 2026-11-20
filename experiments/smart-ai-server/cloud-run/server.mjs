import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {Readable} from 'node:stream';
import {pathToFileURL} from 'node:url';
import {createCloudRunHandler} from './handler.mjs';
import {corsFor} from './cors.mjs';
const assets={
 '/smart-ai/smart-ai.mjs':['smart-ai.mjs','text/javascript; charset=utf-8'],
 '/smart-ai/smart-ai.css':['smart-ai.css','text/css; charset=utf-8'],
 '/smart-ai/smart-admin-ai.mjs':['smart-admin-ai.mjs','text/javascript; charset=utf-8'],
};
export function makeServer({handler=createCloudRunHandler(),env=process.env}={}){
 return createServer({requestTimeout:35000,headersTimeout:10000,maxHeaderSize:16384},async(req,res)=>{
  const abort=new AbortController();
  res.on('close',()=>{if(!res.writableFinished)abort.abort();});
  try{
   if(env.SMART_AI_EXPERIMENT_ENABLED!=='true'){
    res.writeHead(503,{'cache-control':'no-store'});res.end();return;
   }
   const cors=corsFor(req,env.SMART_AI_UI_ORIGIN);
   if(cors.status){res.writeHead(cors.status,{'cache-control':'no-store',...cors.headers});res.end();return;}
   if(req.method==='GET'&&Object.hasOwn(assets,req.url)){
    const [file,type]=assets[req.url];
    const content=await readFile(new URL('./ux/'+file,import.meta.url));
    res.writeHead(200,{'content-type':type,'cache-control':'no-store','x-content-type-options':'nosniff'});
    res.end(content);return;
   }
   const routes={'/v1/invoices':'POST','/v1/credits':'GET','/v1/admin/ai':'POST'};
   if(!Object.hasOwn(routes,req.url)||req.method!==routes[req.url]){
    res.writeHead(Object.hasOwn(routes,req.url)?405:404);res.end();return;
   }
   const request=new Request('https://smart-ai.invalid'+req.url,{method:req.method,headers:Object.entries(req.headers).flatMap(([k,v])=>Array.isArray(v)?v.map(x=>[k,x]):[[k,v]]),...(req.method==='POST'?{body:Readable.toWeb(req),duplex:'half'}:{}),signal:abort.signal});
   const result=await handler.fetch(request,env);
   res.writeHead(result.status,{...Object.fromEntries(result.headers),...cors.headers});
   res.end(await result.text());
  }catch{if(!res.headersSent)res.writeHead(503,{'cache-control':'no-store'});res.end();}
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const port=Number(process.env.PORT??8080);
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('INVALID_PORT');
 makeServer().listen(port,'0.0.0.0');
}
