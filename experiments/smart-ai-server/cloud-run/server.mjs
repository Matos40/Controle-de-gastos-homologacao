import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import {pathToFileURL} from 'node:url';
import {createCloudRunHandler} from './handler.mjs';
export function makeServer({handler=createCloudRunHandler(),env=process.env}={}){
 return createServer({requestTimeout:35000,headersTimeout:10000,maxHeaderSize:16384},async(req,res)=>{
  const abort=new AbortController();
  res.on('close',()=>{if(!res.writableFinished)abort.abort();});
  try{
   if(env.SMART_AI_EXPERIMENT_ENABLED!=='true'){
    res.writeHead(503,{'cache-control':'no-store'});res.end();return;
   }
   if(req.url!=='/v1/invoices'||req.method!=='POST'){
    res.writeHead(req.url==='/v1/invoices'?405:404);res.end();return;
   }
   const request=new Request('https://smart-ai.invalid/v1/invoices',{method:'POST',headers:Object.entries(req.headers).flatMap(([k,v])=>Array.isArray(v)?v.map(x=>[k,x]):[[k,v]]),body:Readable.toWeb(req),duplex:'half',signal:abort.signal});
   const result=await handler.fetch(request,env);
   res.writeHead(result.status,Object.fromEntries(result.headers));
   res.end(await result.text());
  }catch{if(!res.headersSent)res.writeHead(503,{'cache-control':'no-store'});res.end();}
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const port=Number(process.env.PORT??8080);
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('INVALID_PORT');
 makeServer().listen(port,'0.0.0.0');
}
