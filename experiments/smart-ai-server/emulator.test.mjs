import assert from 'node:assert/strict';
import {test} from 'node:test';
import {initializeApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {assertLocalEmulators} from './legacy/emulator-guard.mjs';
import {USAGE_COLLECTION} from './legacy/usage.mjs';
import {BUDGET_COLLECTION} from './legacy/global-budget.mjs';
import {verifyEmulatorToken} from './auth.mjs';

assertLocalEmulators();
const app=initializeApp({projectId:'demo-raytech-v340'});
const db=getFirestore(app),auth=getAuth(app);
const endpoint='http://127.0.0.1:8787/v1/invoices';
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+nr7sAAAAASUVORK5CYII=';
const pdf=size=>{
  const text='BT /F1 17 Tf 45 740 Td (Mercado Ficticio | 2026-11-01 | BRL 25.00 | 1/1) Tj ET';
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>','<< /Length '+Buffer.byteLength(text)+' >>\nstream\n'+text+'\nendstream'];
  let content='%PDF-1.4\n';
  const offsets=objects.map((object,i)=>{
    const offset=Buffer.byteLength(content);
    content+=(i+1)+' 0 obj\n'+object+'\nendobj\n';
    return offset;
  });
  const end='xref\n0 6\n0000000000 65535 f \n'+offsets.map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+
    'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n';
  // Keep individual comment lines short so the padding fits the strict PDF syntax.
  function build(pad) {
    let padding='';
    while(pad>=2){const n=Math.min(pad,80);padding+='%'+'.'.repeat(n-2)+'\n';pad-=n;}
    if(pad===1)padding+='\n';
    const offset=Buffer.byteLength(content+padding);
    return content+padding+end+offset+'\n%%EOF\n';
  }
  let pad=size-Buffer.byteLength(build(0));
  let file=build(pad);
  pad+=size-Buffer.byteLength(file);
  file=build(pad);
  assert.equal(Buffer.byteLength(file),size);
  return Buffer.from(file).toString('base64');
};
const body=(data=png,mimeType='image/png')=>({feature:'invoice-ai',mimeType,data});

async function fixture(name,plan,role,blocked=false) {
  const uid=name+'_'+crypto.randomUUID(),email=uid+'@example.test',password='demo-only-passphrase';
  await auth.createUser({uid,email,password});
  await db.collection('raytechV345Accounts').doc(uid).set({uid,plan,blocked,limits:{minute:10,day:50,month:150}});
  if(role)await db.collection('raytechV345Roles').doc(uid).set({role,active:true});
  const r=await fetch('http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=synthetic',{
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true}),
  });
  assert.equal(r.status,200);
  const {idToken}=await r.json();
  assert.deepEqual(await verifyEmulatorToken(idToken),{uid});
  return {uid,idToken};
}
async function send(fixture,content=body(),id=crypto.randomUUID()) {
  const start=performance.now();
  const response=await fetch(endpoint,{method:'POST',headers:{authorization:'Bearer '+fixture.idToken,'content-type':'application/json','x-request-id':id},body:JSON.stringify(content)});
  return {status:response.status,ms:Math.round(performance.now()-start),result:await response.json(),id};
}

test('Wrangler + Firebase emulators: profile access, UID isolation, revocation, duplicates and quotas', {timeout:85000}, async()=>{
  const [free,premium,owner,admin,blocked]=await Promise.all([
    fixture('free','free'),fixture('premium','premium'),fixture('owner','free','owner'),
    fixture('admin','free','admin'),fixture('blocked','premium',null,true),
  ]);
  assert.equal((await send(free)).status,403);
  assert.equal((await send(blocked)).status,403);
  assert.equal((await send({idToken:'not-a-token'})).status,401);
  assert.equal((await send(owner)).status,200);
  assert.equal((await send(admin)).status,200);
  assert.equal((await send(premium,body(png,'application/pdf'))).status,400);
  const id=crypto.randomUUID();
  const simultaneous=await Promise.all([send(premium,body(),id),send(premium,body(),id)]);
  assert.equal(simultaneous.filter(x=>x.status===200).length,1,JSON.stringify(simultaneous));
  assert.ok(simultaneous.some(x=>[409,503].includes(x.status)));
  assert.equal((await send(premium,body(),id)).status,409);
  assert.equal((await send(owner,body(),id)).status,200);
  const attempt=await db.collection(USAGE_COLLECTION).doc(premium.uid).collection('attempts').doc(id).get();
  assert.equal(attempt.get('status'),'completed');
  for(let i=0;i<2;i++)assert.equal((await send(premium)).status,200);
  await db.collection(USAGE_COLLECTION).doc(premium.uid).update({
    minute:{count:3,period:new Date().toISOString().slice(0,16)},lastAt:Date.now(),
  });
  assert.equal((await send(premium)).status,429);
  await new Promise(r=>setTimeout(r,1100));
  await auth.revokeRefreshTokens(premium.uid);
  assert.equal((await send(premium)).status,401);
});

test('Wrangler synthetic image and PDF payload sizes, limit and measured REST operations',{timeout:85000},async()=>{
  const image=await fixture('image','premium');
  const sample=await send(image);
  assert.equal(sample.status,200,JSON.stringify(sample));
  assert.equal(sample.result.simulated,true);
  console.log(JSON.stringify({size:Buffer.from(png,'base64').length,mime:'image/png',ms:sample.ms,...sample.result.metrics}));
  for(const count of [100*1024,500*1024,1024*1024,2*1024*1024]) {
    const user=await fixture('pdf','premium');
    const data=pdf(count);
    const r=await send(user,body(data,'application/pdf'));
    assert.equal(r.status,200,JSON.stringify(r));
    console.log(JSON.stringify({size:Buffer.from(data,'base64').length,mime:'application/pdf',ms:r.ms,...r.result.metrics}));
  }
  const big=await fixture('too_large','premium');
  const rejected=await send(big,body(pdf(2*1024*1024+1),'application/pdf'));
  assert.equal(rejected.status,413,JSON.stringify(rejected));
  for(const size of [5*1024*1024,10*1024*1024]){
    const denied=await send(big,body(pdf(size),'application/pdf'));
    assert.equal(denied.status,413,JSON.stringify(denied));
    console.log(JSON.stringify({size,mime:'application/pdf',status:denied.status,ms:denied.ms}));
  }
  assert.equal((await db.collection(USAGE_COLLECTION).doc(big.uid).get()).exists,false);
});

test('global cap rejects before any reservation for a new user',async()=>{
  const ref=db.collection(BUDGET_COLLECTION).doc('global');
  const now=Date.now(),iso=new Date(now).toISOString();
  await ref.set({lastAt:now,day:{period:iso.slice(0,10),attempts:100,reserved:100},
    month:{period:iso.slice(0,7),attempts:100,reserved:100}});
  const user=await fixture('global_cap','premium');
  const r=await send(user);
  assert.equal(r.status,429);
  assert.equal(r.result.error,'GLOBAL_BUDGET_EXCEEDED');
  assert.equal((await db.collection(USAGE_COLLECTION).doc(user.uid).get()).exists,false);
});

test('Gemini real: synthetic extraction in isolation',{skip:process.env.RAYTECH_RUN_REAL_GEMINI!=='1',timeout:50000},async()=>{
  const user=await fixture('real_gemini','premium');
  const r=await send(user,body(pdf(100*1024),'application/pdf'));
  assert.equal(r.status,200);
  assert.equal(r.result.simulated,false);
  const row=r.result.items[0]??{};
  console.log(JSON.stringify({size:100*1024,ms:r.ms,...r.result.metrics,fieldMatches:{
    title:/mercado fict[iÃ­]cio/i.test(row.title??''),date:row.date==='2026-11-01',
    amount:row.installmentValue===25,installments:row.installments===1&&row.currentInstallment===1,
  }}));
});
