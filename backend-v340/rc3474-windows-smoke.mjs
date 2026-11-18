import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {writeFile,readFile,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'node:net';
import {randomUUID} from 'node:crypto';
const root=resolve(process.argv[2]??'');
assert.equal(process.platform,'win32');
const ports=[19099,18080,15001,15003,4400,4500,9150];
const stopFile=resolve(root,'.rc3474-stop');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const free=port=>new Promise(resolve=>{
 const s=createServer();s.once('error',()=>resolve(false));s.listen(port,'127.0.0.1',()=>s.close(()=>resolve(true)));
});
for(const p of ports)assert.ok(await free(p),'preflight port '+p);
await rm(stopFile,{force:true});
const args=['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','RemoteSigned','-File',resolve(root,'iniciar-v3474.ps1')];
const proc=spawn('powershell.exe',args,{cwd:root,env:{...process.env,RAYTECH_RC_TEST:'1',RAYTECH_RC_NO_BROWSER:'1'},stdio:['ignore','pipe','pipe']});
let result,log='';const done=new Promise((resolve,reject)=>{proc.once('error',reject);proc.once('exit',(code,signal)=>{result={code,signal};resolve(result);});});
for(const stream of [proc.stdout,proc.stderr])stream.on('data',buf=>{log+=buf.toString();process.stdout.write(buf);});
const call=async(url,body,token,id)=>fetch(url,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{}),...(id?{'x-request-id':id}:{}),origin:'http://127.0.0.1:15003'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
const api='http://127.0.0.1:15003/api/';
try{
 let ready=false;
 for(let i=0;i<900;i++){
  if(result)throw Error('Launcher exited before ready '+JSON.stringify(result));
  try{const response=await fetch('http://127.0.0.1:15003/',{signal:AbortSignal.timeout(2000)});if(response.ok){assert.match(await response.text(),/Raytech CG/);ready=true;break;}}catch{}
  await delay(1000);
 }
 assert.ok(ready,'workspace startup timeout');console.log('PASS: Windows launcher and HTTP shell');
 const tokens={};
 for(const role of ['free','premium','admin','owner']){
  const res=await call('http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-v345',{email:role+'@example.invalid',password:'Raytech-Lab-3474!',returnSecureToken:true});
  assert.equal(res.status,200,role);tokens[role]=(await res.json()).idToken;assert.ok(tokens[role]);
  const auth=await call(api+'workspaceAuthorizeInvoice',{feature:'invoice-ai'},tokens[role]);
  assert.equal(auth.status,role==='free'?403:200,role);
  const admin=await call(api+'workspaceUsageAdmin',{action:'list',after:null},tokens[role]);
  assert.equal(admin.status,['owner','admin'].includes(role)?200:403,role);
  if(admin.ok)assert.equal((await admin.json()).rows.length,4);
  console.log('PASS: synthetic '+role+' login and permissions');
 }
 const extracted=await call(api+'workspaceExtractInvoice',{feature:'invoice-ai',mimeType:'application/pdf',data:Buffer.from('%PDF-1.4\n% synthetic\n%%EOF\n').toString('base64')},tokens.premium,randomUUID());
 assert.equal(extracted.status,200);const body=await extracted.json();assert.equal(body.simulated,true);assert.equal(body.requiresReview,true);assert.equal(body.items.length,2);
 const admin=await call(api+'workspaceUsageAdmin',{action:'list',after:null},tokens.owner);assert.equal(admin.status,200);const metrics=(await admin.json()).outcomes.month;assert.deepEqual(metrics,{reserved:1,completed:1,failed:0,pending:0});console.log('PASS: simulated extraction and server counters');
 await writeFile(stopFile,'stop\n',{flag:'wx'});
 const exit=await Promise.race([done,delay(120000).then(()=>{throw Error('shutdown timeout')})]);assert.equal(exit.code,0);
 let closed=false;for(let i=0;i<60;i++){if((await Promise.all(ports.map(free))).every(Boolean)){closed=true;break;}await delay(1000);}
 assert.ok(closed,'emulator ports still occupied');console.log('PASS: graceful shutdown and all ports released');
}finally{
 if(!result){await writeFile(stopFile,'stop\n').catch(()=>{});await Promise.race([done,delay(15000)]);if(!result){await new Promise(resolve=>spawn('taskkill.exe',['/PID',String(proc.pid),'/T','/F'],{stdio:'ignore'}).once('exit',resolve));}}
 await rm(stopFile,{force:true});
}
