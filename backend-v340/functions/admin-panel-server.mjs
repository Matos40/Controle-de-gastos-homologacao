import {createServer} from 'node:http';
import {prepareProfiles} from './practical-profiles.mjs';
import {readFile} from 'node:fs/promises';
import {assertLocalEmulators,PROJECT} from './emulator-guard.mjs';
assertLocalEmulators();
const practical=process.env.RAYTECH_PRACTICAL==='1';
const profiles=practical?await prepareProfiles():new Map();
export const server=createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
 try{
  if(req.headers.host!=='127.0.0.1:15002'){res.writeHead(403).end();return;}
  if(practical&&req.method==='POST'&&req.url==='/api/lab-profile'){
   if(req.headers.origin!=='http://127.0.0.1:15002'){res.writeHead(403).end();return;}
   let body='';for await(const chunk of req){body+=chunk;if(body.length>256){res.writeHead(413).end();return;}}
   let role;try{role=JSON.parse(body).role;}catch{res.writeHead(400).end();return;}
   if(!profiles.has(role)){res.writeHead(400).end();return;}
   res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify(profiles.get(role)));return;
  }
  if(req.method==='GET'&&req.url==='/api/lab-enabled'){res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify({enabled:practical}));return;}
  if(practical&&req.method==='GET'&&Object.hasOwn({'/app':'index.html','/app-assets/app.js':'app.js','/app-assets/app.css':'app.css','/app-assets/smart-login.css':'smart-login.css','/app-assets/neon-scene.svg':'neon-scene.svg','/app-assets/logo.png':'logo.png','/app-assets/smartLoginView.mjs':'smartLoginView.mjs','/app-assets/smartAdminIdentity.mjs':'smartAdminIdentity.mjs'},req.url)){
   const file=({'/app':'index.html','/app-assets/app.js':'app.js','/app-assets/app.css':'app.css','/app-assets/smart-login.css':'smart-login.css','/app-assets/neon-scene.svg':'neon-scene.svg','/app-assets/logo.png':'logo.png','/app-assets/smartLoginView.mjs':'smartLoginView.mjs','/app-assets/smartAdminIdentity.mjs':'smartAdminIdentity.mjs'})[req.url];
   res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':file.endsWith('.html')?'text/html; charset=utf-8':'text/javascript; charset=utf-8');res.end(await readFile(new URL('./app-ux/'+file,import.meta.url)));return;
  }
  if(req.method==='GET'&&['/','/admin-panel.js','/rc','/rc.js'].includes(req.url)){const script=req.url.endsWith('.js');const file=({'/':'admin-panel.html','/admin-panel.js':'admin-panel.js','/rc':'rc.html','/rc.js':'rc.js'})[req.url];res.setHeader('Content-Type',script?'text/javascript; charset=utf-8':'text/html; charset=utf-8');res.end(await readFile(new URL('./'+file,import.meta.url)));return;}
  if(req.method==='POST'&&['/api/usageAdmin','/api/authorizePremiumFeature','/api/extractPremiumInvoice'].includes(req.url)){
   if(req.headers.origin&&req.headers.origin!=='http://127.0.0.1:15002'){res.writeHead(403).end();return;}
   const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>(req.url.endsWith('extractPremiumInvoice')?14*1024*1024:4096)){res.writeHead(413).end();return;}chunks.push(chunk);}
   const response=await fetch('http://127.0.0.1:15001/'+PROJECT+'/us-central1/'+req.url.slice(5),{method:'POST',headers:{authorization:req.headers.authorization||'','x-request-id':req.headers['x-request-id']||'','content-type':'application/json'},body:Buffer.concat(chunks),signal:AbortSignal.timeout(30000)});
   res.writeHead(response.status,{'Content-Type':'application/json'}).end(await response.text());return;
  }
  res.writeHead(404).end();
 }catch{res.writeHead(503).end('Unavailable');}
});
server.listen(15002,'127.0.0.1');
