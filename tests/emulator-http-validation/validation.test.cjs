'use strict';
const assert=require('node:assert/strict');
const {initializeApp,deleteApp}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const {getFirestore}=require('firebase-admin/firestore');
const {createHttpLab}=require('../../js/services/httpFinanceLab.js');
const project='demo-raytech-cg-http-lab';
const initial={selectedMonth:'2026-11',months:{'2026-11':{
 salary:5000,expenses:[{id:'a',title:'Luz',amount:100}],cardExpenses:[],extraIncomes:[]}}};
const operation=(key,expected,value)=>({key,ym:'2026-11',type:'expenses',id:'a',
 expected:{id:'a',title:'Luz',amount:expected},value:{id:'a',title:'Luz',amount:value}});
let passed=0;
async function test(name,fn){await fn();passed++;console.log('APROVADO:',name);}
async function signup(){
 const r=await fetch('http://127.0.0.1:9100/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key',{
 method:'POST',headers:{'content-type':'application/json'},
 body:JSON.stringify({email:'stage26@example.test',password:'lab-password-123456',returnSecureToken:true})});
 const data=await r.json();if(!r.ok||!data.idToken)throw Error('Auth Emulator indisponivel');
 return data.idToken;
}
async function main(){
 if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8094'||
 process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9100')throw Error('Emuladores obrigatorios');
 const app=initializeApp({projectId:project},'http-validation-lab');
 const server=createHttpLab(getFirestore(app),getAuth(app));
 try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const url='http://127.0.0.1:'+server.address().port;
  const token=await signup();
  const call=async(route,body,authorization=token)=>{
   const headers={'content-type':'application/json'};
   if(authorization!==null)headers.authorization='Bearer '+authorization;
   const r=await fetch(url+route,{method:'POST',headers,
    body:typeof body==='string'?body:JSON.stringify(body)});
   return {status:r.status,body:await r.json()};
  };
  const bad=async(name,route,body,error)=>test(name,async()=>{
   const r=await call(route,body);assert.equal(r.status,400);assert.equal(r.body.error,error);
  });
  await bad('JSON malformado','/v1/audit','{','invalid_json');
  await bad('auditoria com dados extras','/v1/audit',{uid:'other'},'invalid_request');
  await bad('snapshot ausente','/v1/initialize',{},'invalid_snapshot');
  await bad('snapshot array','/v1/initialize',{snapshot:[]},'invalid_snapshot');
  await bad('snapshot sem meses','/v1/initialize',{snapshot:{selectedMonth:'2026-11',months:{}}},'invalid_snapshot');
  await bad('snapshot mes invalido','/v1/initialize',{snapshot:{selectedMonth:'2026-13',months:{}}},'invalid_snapshot');
  await bad('snapshot salario texto','/v1/initialize',{snapshot:{selectedMonth:'2026-11',months:{'2026-11':{
   salary:'5000',expenses:[],cardExpenses:[],extraIncomes:[]}}}},'invalid_snapshot');
  await bad('snapshot campo extra na raiz','/v1/initialize',{snapshot:initial,uid:'other'},'invalid_request');
  await bad('operacao sem key','/v1/submit',{operation:{ym:'2026-11',type:'salary',expected:1,value:2}},'invalid_operation');
  await bad('operacao chave com barra','/v1/submit',{operation:{key:'a/b',ym:'2026-11',type:'salary',expected:1,value:2}},'invalid_operation');
  await bad('operacao mes invalido','/v1/submit',{operation:{key:'bad',ym:'2026-00',type:'salary',expected:1,value:2}},'invalid_operation');
  await bad('operacao tipo invalido','/v1/submit',{operation:{key:'bad',ym:'2026-11',type:'admin',expected:1,value:2}},'invalid_operation');
  await bad('salario string','/v1/submit',{operation:{key:'bad',ym:'2026-11',type:'salary',expected:1,value:'200'}},'invalid_operation');
  await bad('registro ID divergente','/v1/submit',{operation:{...operation('bad',100,120),id:'b'}},'invalid_operation');
  await bad('operacao campo extra','/v1/submit',{operation:{...operation('bad',100,120),uid:'other'}},'invalid_operation');
  await bad('registro com construtor perigoso','/v1/submit','{"operation":{"key":"bad","ym":"2026-11","type":"salary","expected":100,"value":120,"constructor":{}}}','invalid_payload');
  await test('token invalido gera erro padronizado',async()=>{
   const r=await call('/v1/audit',{},'fake');assert.equal(r.status,401);
   assert.deepEqual(r.body,{error:'unauthorized'});
  });
  await test('inicializacao valida continua funcional',async()=>{
   assert.equal((await call('/v1/initialize',{snapshot:initial})).body.status,'initialized');
  });
  await test('operacao valida continua funcional',async()=>{
   assert.equal((await call('/v1/submit',{operation:operation('stage26',100,120)})).body.status,'committed');
  });
  await test('auditoria valida continua consistente',async()=>{
   assert.deepEqual((await call('/v1/audit',{})).body,{status:'audited',revisions:2,receipts:1});
  });
  console.log('RESULTADO: '+passed+'/20 TESTES APROVADOS');
 }finally{await new Promise(resolve=>server.close(resolve));await deleteApp(app);}
}
main().catch(e=>{console.error('FALHA:',e);process.exitCode=1;});
