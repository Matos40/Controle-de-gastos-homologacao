'use strict';
const assert=require('node:assert/strict');
const {initializeApp,deleteApp}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const {getFirestore}=require('firebase-admin/firestore');
const {createHttpLab}=require('../../js/services/httpFinanceLab.js');
const project='demo-raytech-cg-http-lab';
const snapshot={selectedMonth:'2026-11',months:{'2026-11':{
 salary:5000,expenses:[{id:'a',title:'Luz',amount:100}],cardExpenses:[],extraIncomes:[]}}};
const op=(key,expected,value)=>({key,ym:'2026-11',type:'expenses',id:'a',
 expected:{id:'a',title:'Luz',amount:expected},value:{id:'a',title:'Luz',amount:value}});
let passed=0;
async function test(name,fn){await fn();passed++;console.log('APROVADO:',name);}
async function signup(email){
 const r=await fetch('http://127.0.0.1:9100/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key',{
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({email,password:'lab-password-123456',returnSecureToken:true})});
 const j=await r.json();if(!r.ok||!j.idToken)throw Error('Auth Emulator indisponivel');
 return j.idToken;
}
async function main(){
 if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8094'||
 process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9100')throw Error('Emuladores obrigatorios');
 const app=initializeApp({projectId:project},'http-lab');
 const server=createHttpLab(getFirestore(app),getAuth(app));
 try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const url='http://127.0.0.1:'+server.address().port;
  const a=await signup('http-a@example.test'),b=await signup('http-b@example.test');
  const request=async(route,token,data={},opts={})=>{
   const headers={'content-type':opts.type||'application/json'};
   if(token!==null)headers.authorization='Bearer '+token;
   const response=await fetch(url+route,{method:opts.method||'POST',headers,
    body:JSON.stringify(data)});
   return {status:response.status,body:await response.json()};
  };
  await test('rota desconhecida bloqueada',async()=>assert.equal((await request('/wrong',a)).status,404));
  await test('sem bearer bloqueado',async()=>assert.equal((await request('/v1/audit',null)).status,401));
  await test('token inventado bloqueado',async()=>assert.equal((await request('/v1/audit','invalid')).status,401));
  await test('tipo de conteudo incorreto bloqueado',async()=>assert.equal((await request('/v1/audit',a,{}, {type:'text/plain'})).status,415));
  await test('snapshot ausente rejeitado',async()=>assert.equal((await request('/v1/initialize',a,{})).status,400));
  await test('operacao ausente rejeitada',async()=>assert.equal((await request('/v1/submit',a,{})).status,400));
  await test('auditoria com campos extras rejeitada',async()=>assert.equal((await request('/v1/audit',a,{uid:'outro'})).status,400));
  await test('usuario A inicializa',async()=>assert.equal((await request('/v1/initialize',a,{snapshot})).body.status,'initialized'));
  await test('usuario B inicializa isolado',async()=>assert.equal((await request('/v1/initialize',b,{snapshot})).body.status,'initialized'));
  await test('inicializacao repetida idempotente',async()=>assert.equal((await request('/v1/initialize',a,{snapshot})).body.status,'already_initialized'));
  await test('A confirma operacao',async()=>assert.equal((await request('/v1/submit',a,{operation:op('http-a',100,120)})).body.status,'committed'));
  await test('A reenvia sem duplicar',async()=>assert.equal((await request('/v1/submit',a,{operation:op('http-a',100,120)})).body.status,'duplicate'));
  await test('chave reaproveitada com valor diferente bloqueada',async()=>assert.equal((await request('/v1/submit',a,{operation:op('http-a',100,150)})).body.status,'key_conflict'));
  await test('B opera sem alterar A',async()=>assert.equal((await request('/v1/submit',b,{operation:op('http-b',100,140)})).body.status,'committed'));
  await test('auditoria A consistente',async()=>assert.deepEqual((await request('/v1/audit',a)).body,{status:'audited',revisions:2,receipts:1}));
  await test('auditoria B consistente',async()=>assert.deepEqual((await request('/v1/audit',b)).body,{status:'audited',revisions:2,receipts:1}));
  await test('token adulterado nao confirma',async()=>assert.equal((await request('/v1/submit',a+'x',{operation:op('bad',120,160)})).status,401));
  await test('sem endpoint GET',async()=>{
   const r=await fetch(url+'/v1/audit');assert.equal(r.status,404);
  });
  await test('resposta sem cache',async()=>{
   const r=await fetch(url+'/v1/audit',{method:'POST',headers:{'content-type':'application/json'}});
   assert.equal(r.headers.get('cache-control'),'no-store');
  });
  await test('snapshot de origem preservado',async()=>assert.equal(snapshot.months['2026-11'].expenses[0].amount,100));
  console.log('RESULTADO: '+passed+'/20 TESTES APROVADOS');
 }finally{await new Promise(resolve=>server.close(resolve));await deleteApp(app);}
}
main().catch(e=>{console.error('FALHA:',e);process.exitCode=1;});
