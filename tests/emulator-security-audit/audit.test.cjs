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
const security=require('../../js/services/securityAuditLab.js');
const rules=fs.readFileSync(path.join(__dirname,'firestore.rules'),'utf8');
const project='demo-raytech-cg-security';
const snapshot={selectedMonth:'2026-11',months:{'2026-11':{
 salary:5000,expenses:[{id:'a',title:'Luz',amount:100}],cardExpenses:[],extraIncomes:[]}}};
const operation={key:'security1',ym:'2026-11',type:'expenses',id:'a',
 expected:{id:'a',title:'Luz',amount:100},value:{id:'a',title:'Luz',amount:120}};
let passed=0;
async function test(name,fn){await fn();passed++;console.log('APROVADO:',name);}
async function signup(email){
 const response=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key',{
  method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({email,password:'teste-seguranca-12345',returnSecureToken:true})
 });
 const body=await response.json();
 if(!response.ok)throw Error(JSON.stringify(body));
 return {uid:body.localId,token:body.idToken};
}
async function main(){
 security.ensureEmulators();
 const env=await initializeTestEnvironment({projectId:project,firestore:{host:'127.0.0.1',port:8093,rules}});
 const app=initializeApp({projectId:project},'security-audit-lab');
 try{
  await env.clearFirestore();
  const db=getFirestore(app),auth=getAuth(app),service=createAuthenticatedBackend(db,auth);
  const a=await signup('security-a@example.test'),b=await signup('security-b@example.test');
  const p=paths(db,a.uid);
  const client=env.authenticatedContext(a.uid).firestore();
  const outsider=env.authenticatedContext(b.uid).firestore();
  await test('hosts de emulador obrigatorios',async()=>assert.throws(()=>{
   const old=process.env.FIRESTORE_EMULATOR_HOST;process.env.FIRESTORE_EMULATOR_HOST='firestore.googleapis.com:443';
   try{security.ensureEmulators();}finally{process.env.FIRESTORE_EMULATOR_HOST=old;}
  },/emuladores locais/));
  await test('credencial ambiente identificada como risco',async()=>assert.equal(
   security.inspectEnvironment({GOOGLE_APPLICATION_CREDENTIALS:'secret.json'}).length,1));
  await test('projeto nao demo identificado',async()=>assert.equal(
   security.inspectEnvironment({GOOGLE_CLOUD_PROJECT:'production-project'}).length,1));
  await test('token real do emulador verificado',async()=>assert.equal((await auth.verifyIdToken(a.token)).uid,a.uid));
  await test('token falso bloqueado',async()=>await assert.rejects(service.initialize('fake',snapshot)));
  await test('token adulterado bloqueado',async()=>await assert.rejects(service.initialize(a.token+'x',snapshot)));
  await test('cliente nao cria revisao',async()=>await assert.rejects(
   client.doc(p.revisions.doc('1').path).set({number:1}),e=>e.code==='permission-denied'));
  await test('cliente nao cria recibo',async()=>await assert.rejects(
   client.doc(p.receipts.doc('fake').path).set({version:1}),e=>e.code==='permission-denied'));
  await test('cliente nao le head',async()=>await assert.rejects(
   client.doc(p.head.path).get(),e=>e.code==='permission-denied'));
  await test('outro usuario nao le head',async()=>await assert.rejects(
   outsider.doc(p.head.path).get(),e=>e.code==='permission-denied'));
  await test('inicializacao autenticada',async()=>assert.equal((await service.initialize(a.token,snapshot)).status,'initialized'));
  await test('commit autenticado',async()=>assert.equal((await service.submit(a.token,operation)).status,'committed'));
  await test('auditoria independente aprovada',async()=>assert.deepStrictEqual(
   await security.auditReceipts(db,a.uid),{status:'audited',revisions:2,receipts:1}));
  await test('recibo corresponde a operacao',async()=>assert.equal(
   security.verifyReceiptForOperation((await p.receipts.doc(operation.key).get()).data(),operation),true));
  await test('recibo nao corresponde a operacao adulterada',async()=>assert.equal(
   security.verifyReceiptForOperation((await p.receipts.doc(operation.key).get()).data(),
    {...operation,value:{...operation.value,amount:999}}),false));
  await test('reenvio nao cria revisao',async()=>assert.equal((await service.submit(a.token,operation)).status,'duplicate'));
  await test('erro de token nao grava recibo',async()=>{
   await assert.rejects(service.submit('fake',{...operation,key:'invalid-token'}));
   assert.equal((await p.receipts.doc('invalid-token').get()).exists,false);
  });
  await test('corrupcao de recibo detectada',async()=>{
   const target=p.receipts.doc(operation.key),original=(await target.get()).data();
   await target.update({checksum:'0'.repeat(64)});
   await assert.rejects(security.auditReceipts(db,a.uid),/Recibo inconsistente/);
   await target.set(original);
  });
  await test('corrupcao de revisao detectada',async()=>{
   const target=p.revisions.doc('2'),original=(await target.get()).data();
   await target.update({parent:'0'.repeat(64)});
   await assert.rejects(security.auditReceipts(db,a.uid),/Cadeia inconsistente/);
   await target.set(original);
  });
  await test('recuperacao apos falha de confirmacao simulada',async()=>{
   // Simula commit remoto bem sucedido com perda da resposta do cliente.
   assert.equal((await service.submit(a.token,operation)).status,'duplicate');
   assert.equal((await security.auditReceipts(db,a.uid)).revisions,2);
  });
  await test('usuario B isolado',async()=>{
   assert.equal((await service.initialize(b.token,snapshot)).status,'initialized');
   assert.equal((await service.audit(b.token)).receipts,0);
  });
  await test('auditoria final consistente',async()=>assert.deepStrictEqual(
   await security.auditReceipts(db,a.uid),{status:'audited',revisions:2,receipts:1}));
  console.log('RESULTADO: '+passed+'/22 TESTES APROVADOS');
 }finally{await deleteApp(app);await env.cleanup();}
}
main().catch(e=>{console.error('FALHA:',e);process.exitCode=1;});
