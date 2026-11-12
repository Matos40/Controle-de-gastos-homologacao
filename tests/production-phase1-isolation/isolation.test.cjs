'use strict';
// Testes dinamicos de isolamento, SOMENTE Auth e Firestore Emulators locais.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {initializeTestEnvironment}=require('@firebase/rules-unit-testing');
const {initializeApp,deleteApp}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
const {getFirestore}=require('firebase-admin/firestore');
const {createAuthenticatedBackend}=require('../../js/services/emulatorAuthBackendLab.js');
const {paths}=require('../../js/services/trustedFinanceBackendLab.js');
const {assertOwner}=require('../../js/services/productionDataContractLab.js');
const project='demo-raytech-cg-auth-backend';
const rules=fs.readFileSync(path.join(__dirname,'firestore.rules'),'utf8');
const initial={selectedMonth:'2026-11',months:{'2026-11':{
 salary:5000,expenses:[{id:'a',title:'Conta',amount:100}],
 cardExpenses:[],extraIncomes:[]}}};
const op=(key,expected,value)=>({key,ym:'2026-11',type:'expenses',id:'a',
 expected:{id:'a',title:'Conta',amount:expected},
 value:{id:'a',title:'Conta',amount:value}});
let count=0;
async function test(name,fn){await fn();count++;console.log('APROVADO:',name);}
async function signup(email){
 const r=await fetch('http://127.0.0.1:9098/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key',{
 method:'POST',headers:{'Content-Type':'application/json'},
 body:JSON.stringify({email,password:'laboratorio-123456',returnSecureToken:true})});
 const j=await r.json();
 if(!r.ok||!j.idToken||!j.localId)throw Error('Auth Emulator indisponivel');
 return {uid:j.localId,token:j.idToken};
}
async function main(){
 if(process.env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:8092'||
 process.env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:9098'||
 process.env.GOOGLE_CLOUD_PROJECT!==project||
 process.env.GCLOUD_PROJECT!==project)throw Error('Ambiente de laboratorio obrigatorio');
 const env=await initializeTestEnvironment({projectId:project,
 firestore:{host:'127.0.0.1',port:8092,rules}});
 const app=initializeApp({projectId:project},'phase1-isolation-lab');
 try{
  await env.clearFirestore();
  const db=getFirestore(app),auth=getAuth(app),service=createAuthenticatedBackend(db,auth);
  const a=await signup('isolation-a@example.test');
  const b=await signup('isolation-b@example.test');
  const pa=paths(db,a.uid),pb=paths(db,b.uid);
  const ca=env.authenticatedContext(a.uid).firestore();
  const cb=env.authenticatedContext(b.uid).firestore();
  const guest=env.unauthenticatedContext().firestore();
  const denied=promise=>assert.rejects(promise,e=>e.code==='permission-denied');
  await test('token A autenticado',async()=>assert.equal((await auth.verifyIdToken(a.token)).uid,a.uid));
  await test('token B autenticado',async()=>assert.equal((await auth.verifyIdToken(b.token)).uid,b.uid));
  await test('UIDs distintos',async()=>assert.notEqual(a.uid,b.uid));
  await test('A inicializa exclusivamente A',async()=>assert.equal((await service.initialize(a.token,initial)).status,'initialized'));
  await test('B ainda nao tem estado',async()=>assert.equal((await pb.head.get()).exists,false));
  await test('B inicializa exclusivamente B',async()=>assert.equal((await service.initialize(b.token,initial)).status,'initialized'));
  await test('paths separados',async()=>assert.notEqual(pa.head.path,pb.head.path));
  await test('cliente A nao le seu proprio head diretamente',async()=>denied(ca.doc(pa.head.path).get()));
  await test('cliente A nao le head B',async()=>denied(ca.doc(pb.head.path).get()));
  await test('cliente B nao le head A',async()=>denied(cb.doc(pa.head.path).get()));
  await test('anonimo nao le head A',async()=>denied(guest.doc(pa.head.path).get()));
  await test('cliente A nao escreve head B',async()=>denied(ca.doc(pb.head.path).set({number:999})));
  await test('cliente B nao escreve head A',async()=>denied(cb.doc(pa.head.path).set({number:999})));
  await test('cliente A nao escreve proprio head',async()=>denied(ca.doc(pa.head.path).set({number:999})));
  await test('anonimo nao escreve head B',async()=>denied(guest.doc(pb.head.path).set({number:999})));
  await test('cliente B nao apaga head A',async()=>denied(cb.doc(pa.head.path).delete()));
  await test('cliente A nao cria recibo B',async()=>denied(ca.doc(pb.receipts.doc('forged').path).set({key:'forged'})));
  await test('cliente B nao consulta revisoes A',async()=>denied(cb.collection(pa.revisions.path).get()));
  await test('cliente A nao consulta recibos B',async()=>denied(ca.collection(pb.receipts.path).get()));
  await test('usuario A envia operacao legitima',async()=>assert.equal((await service.submit(a.token,op('isola',100,120))).status,'committed'));
  await test('recibo A nao aparece em B',async()=>assert.equal((await pb.receipts.doc('isola').get()).exists,false));
  await test('B com mesma chave so altera B',async()=>assert.equal((await service.submit(b.token,op('isola',100,140))).status,'committed'));
  await test('auditoria A independente',async()=>assert.deepEqual(await service.audit(a.token),{status:'audited',revisions:2,receipts:1}));
  await test('auditoria B independente',async()=>assert.deepEqual(await service.audit(b.token),{status:'audited',revisions:2,receipts:1}));
  await test('token adulterado nao cria recibo',async()=>{
   await assert.rejects(service.submit(a.token+'x',op('fake',120,999)));
   assert.equal((await pa.receipts.doc('fake').get()).exists,false);
  });
  await test('UID de B nao e aceito como propriedade de A',async()=>assert.throws(()=>assertOwner(b.uid,a.uid),e=>e.code==='forbidden'));
  await test('UID manipulado com barra rejeitado',async()=>assert.throws(()=>assertOwner(a.uid,'../'+a.uid),e=>e.code==='forbidden'));
  await test('head A preservado apos ataques',async()=>assert.equal((await pa.head.get()).data().number,2));
  await test('head B preservado apos ataques',async()=>assert.equal((await pb.head.get()).data().number,2));
  await test('recibos legitimos intactos',async()=>{
   assert.equal((await pa.receipts.doc('isola').get()).exists,true);
   assert.equal((await pb.receipts.doc('isola').get()).exists,true);
  });
  await test('nenhum recibo forjado B',async()=>assert.equal((await pb.receipts.doc('forged').get()).exists,false));
  console.log('RESULTADO: '+count+'/31 TESTES APROVADOS');
 }finally{await deleteApp(app);await env.cleanup();}
}
main().catch(e=>{console.error('FALHA:',e);process.exitCode=1;});
