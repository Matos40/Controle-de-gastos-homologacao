'use strict';
const assert=require('node:assert/strict');
const {initializeApp,deleteApp}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const {getFirestore}=require('firebase-admin/firestore');
const {createHttpLab}=require('../../js/services/httpFinanceLab.js');
const project='demo-raytech-cg-http-lab';
const initial={selectedMonth:'2026-11',months:{'2026-11':{
 salary:5000,expenses:[{id:'a',title:'Luz',amount:100}],cardExpenses:[],extraIncomes:[]}}};
const op=(key,expected,value)=>({key,ym:'2026-11',type:'expenses',id:'a',
 expected:{id:'a',title:'Luz',amount:expected},
 value:{id:'a',title:'Luz',amount:value}});
let passed=0;
async function test(name,fn){await fn();passed++;console.log('APROVADO:',name);}
async function signup(email){
 const response=await fetch('http://127.0.0.1:9100/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key',{
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({email,password:'lab-password-123456',returnSecureToken:true})});
 const data=await response.json();
 if(!response.ok||!data.idToken)throw Error('Auth Emulator indisponivel');
 return data.idToken;
}
async function main(){
 if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8094'||
    process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9100')
  throw Error('Somente emuladores locais');
 const app=initializeApp({projectId:project},'http-resilience-lab');
 const server=createHttpLab(getFirestore(app),getAuth(app));
 try{
  await new Promise((resolve,reject)=>{
   server.once('error',reject);server.listen(0,'127.0.0.1',resolve);
  });
  const base='http://127.0.0.1:'+server.address().port;
  const a=await signup('stress-a@example.test');
  const b=await signup('stress-b@example.test');
  const call=async(route,token,body,options={})=>{
   const headers={'content-type':options.contentType||'application/json'};
   if(token!==null)headers.authorization='Bearer '+token;
   const response=await fetch(base+route,{method:'POST',headers,
    body:typeof body==='string'?body:JSON.stringify(body)});
   return {code:response.status,body:await response.json(),
    headers:response.headers};
  };
  await test('JSON incompleto retorna 400',async()=>{
   assert.equal((await call('/v1/initialize',a,'{"snapshot":')).code,400);
  });
  await test('JSON nulo retorna 400',async()=>{
   assert.equal((await call('/v1/initialize',a,'null')).code,400);
  });
  await test('JSON array retorna 400',async()=>{
   assert.equal((await call('/v1/initialize',a,'[]')).code,400);
  });
  await test('payload acima de 128 KiB retorna 413',async()=>{
   const r=await call('/v1/initialize',a,{snapshot:{noise:'x'.repeat(140*1024)}});
   assert.equal(r.code,413);
  });
  await test('servidor continua apos payload grande',async()=>{
   assert.equal((await call('/v1/initialize',a,{snapshot:initial})).body.status,'initialized');
  });
  await test('usuario B inicializa isoladamente',async()=>{
   assert.equal((await call('/v1/initialize',b,{snapshot:initial})).body.status,'initialized');
  });
  await test('token ausente nao envia operacao',async()=>{
   assert.equal((await call('/v1/submit',null,{operation:op('missing',100,110)})).code,401);
  });
  await test('token falsificado nao envia operacao',async()=>{
   assert.equal((await call('/v1/submit',a+'x',{operation:op('fake',100,110)})).code,401);
  });
  await test('UID no corpo nao altera identidade',async()=>{
   const r=await call('/v1/audit',a,{uid:'outro'});
   assert.equal(r.code,400);
  });
  await test('envios simultaneos com mesma chave sao idempotentes',async()=>{
   const requests=Array.from({length:8},()=>call('/v1/submit',a,{operation:op('parallel',100,120)}));
   const results=await Promise.all(requests);
   assert.equal(results.filter(x=>x.body.status==='committed').length,1);
   assert.equal(results.filter(x=>x.body.status==='duplicate').length,7);
   assert(results.every(x=>x.code===200));
  });
  await test('auditoria apos concorrencia registra uma revisao',async()=>{
   assert.deepEqual((await call('/v1/audit',a,{})).body,
    {status:'audited',revisions:2,receipts:1});
  });
  await test('mesma chave com payload distinto bloqueada',async()=>{
   assert.equal((await call('/v1/submit',a,{operation:op('parallel',100,180)})).body.status,'key_conflict');
  });
  await test('operacoes concorrentes conflitantes nao corrompem cadeia',async()=>{
   const [x,y]=await Promise.all([
    call('/v1/submit',a,{operation:op('conflict-a',120,130)}),
    call('/v1/submit',a,{operation:op('conflict-b',120,140)})]);
   const statuses=[x.body.status,y.body.status].sort();
   assert.deepEqual(statuses,['committed','conflict']);
  });
  await test('auditoria apos conflito preserva integridade',async()=>{
   assert.deepEqual((await call('/v1/audit',a,{})).body,
    {status:'audited',revisions:3,receipts:2});
  });
  await test('B usa mesma chave sem interferir em A',async()=>{
   assert.equal((await call('/v1/submit',b,{operation:op('parallel',100,150)})).body.status,'committed');
  });
  await test('auditoria B isolada',async()=>{
   assert.deepEqual((await call('/v1/audit',b,{})).body,
    {status:'audited',revisions:2,receipts:1});
  });
  await test('auditoria A nao incorpora dados B',async()=>{
   assert.deepEqual((await call('/v1/audit',a,{})).body,
    {status:'audited',revisions:3,receipts:2});
  });
  await test('resposta de erro nao vaza token',async()=>{
   const r=await call('/v1/audit','token-secreto-falso',{});
   assert.equal(r.code,401);
   assert(!JSON.stringify(r.body).includes('token-secreto-falso'));
  });
  await test('respostas nao sao armazenadas em cache',async()=>{
   assert.equal((await call('/v1/audit',a,{})).headers.get('cache-control'),'no-store');
  });
  await test('snapshot original permanece intacto',async()=>{
   assert.equal(initial.months['2026-11'].expenses[0].amount,100);
  });
  console.log('RESULTADO: '+passed+'/20 TESTES APROVADOS');
 }finally{
  await new Promise(resolve=>server.close(resolve));
  await deleteApp(app);
 }
}
main().catch(e=>{console.error('FALHA:',e);process.exitCode=1;});
