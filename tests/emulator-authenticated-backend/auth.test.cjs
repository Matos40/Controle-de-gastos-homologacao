'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {initializeTestEnvironment}=require('@firebase/rules-unit-testing');
const {initializeApp,deleteApp}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const {getFirestore}=require('firebase-admin/firestore');
const {createAuthenticatedBackend}=require('../../js/services/emulatorAuthBackendLab.js');
const {paths}=require('../../js/services/trustedFinanceBackendLab.js');
const rules=fs.readFileSync(path.join(__dirname,'firestore.rules'),'utf8');
const project='demo-raytech-cg-auth-backend';
const initial={selectedMonth:'2026-11',months:{'2026-11':{
 salary:5000,expenses:[{id:'a',title:'Luz',amount:100}],
 cardExpenses:[],extraIncomes:[]}}};
const op=(key,expected,value)=>({key,ym:'2026-11',type:'expenses',id:'a',
 expected:{id:'a',title:'Luz',amount:expected},
 value:{id:'a',title:'Luz',amount:value}});
let passed=0;
async function test(name,fn){await fn();passed++;console.log('APROVADO:',name);}
async function signup(email){
 const response=await fetch('http://127.0.0.1:9098/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key',{
  method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({email,password:'teste-laboratorio-12345',returnSecureToken:true})
 });
 const body=await response.json();
 if(!response.ok||!body.idToken||!body.localId)throw Error('Auth Emulator: '+JSON.stringify(body));
 return {token:body.idToken,uid:body.localId};
}
async function main(){
 // Bloqueia uso acidental contra projeto ou servico real.
 if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8092'||
    process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9098')
  throw Error('Emuladores locais obrigatorios nas portas 8092 e 9098.');
 const env=await initializeTestEnvironment({projectId:project,
  firestore:{host:'127.0.0.1',port:8092,rules}});
 const app=initializeApp({projectId:project},'auth-backend-lab');
 try{
  await env.clearFirestore();
  const db=getFirestore(app),auth=getAuth(app);
  const service=createAuthenticatedBackend(db,auth);
  const a=await signup('lab-a@example.test');
  const b=await signup('lab-b@example.test');
  const pa=paths(db,a.uid),pb=paths(db,b.uid);
  const client=env.authenticatedContext(a.uid).firestore();
  await test('token A emitido pelo Auth Emulator',async()=>assert.equal((await auth.verifyIdToken(a.token)).uid,a.uid));
  await test('token B emitido pelo Auth Emulator',async()=>assert.equal((await auth.verifyIdToken(b.token)).uid,b.uid));
  await test('cliente nao grava diretamente',async()=>await assert.rejects(
   client.doc(pa.head.path).set({version:2}),e=>e.code==='permission-denied'));
  await test('cliente nao le diretamente',async()=>await assert.rejects(
   client.doc(pa.head.path).get(),e=>e.code==='permission-denied'));
  await test('sem token nao inicializa',async()=>await assert.rejects(service.initialize('',initial),/ausente/));
  await test('token inventado e rejeitado',async()=>await assert.rejects(service.initialize('token-falso',initial)));
  await test('token adulterado e rejeitado',async()=>await assert.rejects(service.initialize(a.token.slice(0,-5)+'abcde',initial)));
  await test('usuario A inicializa seus dados',async()=>assert.equal((await service.initialize(a.token,initial)).status,'initialized'));
  await test('usuario B nao recebe head de A',async()=>assert.equal((await pb.head.get()).exists,false));
  await test('usuario B tem espaco proprio',async()=>assert.equal((await service.initialize(b.token,initial)).status,'initialized'));
  await test('reenvio de inicializacao nao duplica',async()=>assert.equal((await service.initialize(a.token,initial)).status,'already_initialized'));
  await test('operacao autenticada A confirmada',async()=>assert.equal((await service.submit(a.token,op('auth1',100,120))).status,'committed'));
  await test('recibo A isolado de B',async()=>{
   assert.equal((await pa.receipts.doc('auth1').get()).exists,true);
   assert.equal((await pb.receipts.doc('auth1').get()).exists,false);
  });
  await test('usuario B nao altera operacao de A',async()=>assert.equal((await service.submit(b.token,op('auth1',100,140))).status,'committed'));
  await test('revisoes dos dois usuarios independentes',async()=>{
   assert.equal((await service.audit(a.token)).revisions,2);
   assert.equal((await service.audit(b.token)).revisions,2);
  });
  await test('reenvio autenticado e idempotente',async()=>assert.equal((await service.submit(a.token,op('auth1',100,120))).status,'duplicate'));
  await test('token adulterado nao confirma operacao',async()=>await assert.rejects(service.submit(a.token+'x',op('bad',120,130))));
  await test('auditoria autenticada A',async()=>assert.deepStrictEqual(await service.audit(a.token),
   {status:'audited',revisions:2,receipts:1}));
  await test('auditoria autenticada B',async()=>assert.deepStrictEqual(await service.audit(b.token),
   {status:'audited',revisions:2,receipts:1}));
  await test('dados ficticios originais preservados',async()=>assert.equal(initial.months['2026-11'].expenses[0].amount,100));
  console.log('RESULTADO: '+passed+'/20 TESTES APROVADOS');
 }finally{await deleteApp(app);await env.cleanup();}
}
main().catch(e=>{console.error('FALHA:',e);process.exitCode=1;});
