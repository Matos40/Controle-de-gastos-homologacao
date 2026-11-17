import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {assertLocalEmulators,PROJECT} from './emulator-guard.mjs';
assertLocalEmulators();
export const server=createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
 try{
  if(req.method==='GET'&&['/','/admin-panel.js'].includes(req.url)){const script=req.url!=='/';res.setHeader('Content-Type',script?'text/javascript; charset=utf-8':'text/html; charset=utf-8');res.end(await readFile(new URL(script?'./admin-panel.js':'./admin-panel.html',import.meta.url)));return;}
  if(req.method==='POST'&&req.url==='/api/usageAdmin'){
   if(req.headers.origin&&req.headers.origin!=='http://127.0.0.1:15002'){res.writeHead(403).end();return;}
   const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>4096){res.writeHead(413).end();return;}chunks.push(chunk);}
   const response=await fetch('http://127.0.0.1:15001/'+PROJECT+'/us-central1/usageAdmin',{method:'POST',headers:{authorization:req.headers.authorization||'','content-type':'application/json'},body:Buffer.concat(chunks),signal:AbortSignal.timeout(30000)});
   res.writeHead(response.status,{'Content-Type':'application/json'}).end(await response.text());return;
  }
  res.writeHead(404).end();
 }catch{res.writeHead(503).end('Unavailable');}
});
server.listen(15002,'127.0.0.1');
