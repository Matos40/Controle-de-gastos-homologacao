import {randomUUID} from 'node:crypto';
import {USAGE_COLLECTION,createUsageStore} from './usage.mjs';
import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getFirestore} from 'firebase-admin/firestore';
import {assertLocalEmulators,PROJECT} from './emulator-guard.mjs';
import {ACCOUNT_COLLECTION,ROLE_COLLECTION} from './policy.mjs';
assertLocalEmulators();
const app=initializeApp({projectId:PROJECT}),db=getFirestore(app),auth=getAuth(app);
after(()=>deleteApp(app));
const endpoint='http://127.0.0.1:15001/'+PROJECT+'/us-central1/authorizePremiumFeature';
const call=async(token,body={feature:'invoice-ai'},method='POST')=>{const res=await fetch(endpoint,{method,headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},...(method==='POST'?{body:JSON.stringify(body)}:{})});assert.equal(res.headers.get('cache-control'),'no-store');return {status:res.status,body:await res.json()};};
async function fixture(name,plan='free',blocked=false,role=null){
 const res=await fetch('http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:name+'@example.invalid',password:'fictional-pass-123',returnSecureToken:true})});
 assert.equal(res.status,200);const u=await res.json();
 const profile=db.collection(ACCOUNT_COLLECTION).doc(u.localId),operator=db.collection(ROLE_COLLECTION).doc(u.localId);
 await profile.set({uid:u.localId,plan,blocked});if(role)await operator.set(role);
 return {token:u.idToken,uid:u.localId,profile,operator};
}
test('HTTP Firebase Auth and Firestore emulators: permission matrix and immediate changes',async()=>{
 const f=await fixture('free');const p=await fixture('premium','premium');const o=await fixture('owner','free',false,{role:'owner',active:true});const a=await fixture('admin','free',false,{role:'admin',active:true});const b=await fixture('blocked','premium',true);const i=await fixture('inactive','free',false,{role:'admin',active:false});
 for(const [u,status] of [[f,403],[p,200],[o,200],[a,200],[b,403],[i,403]])assert.equal((await call(u.token)).status,status);
 assert.equal((await call(null)).status,401);assert.equal((await call('not-a-token')).status,401);assert.equal((await call(f.token,{feature:'invoice-ai',uid:p.uid})).status,400);assert.equal((await call(f.token,{feature:'invoice-ai',plan:'premium'})).status,400);assert.equal((await call(p.token,undefined,'GET')).status,405);
 await f.profile.update({plan:'premium'});assert.equal((await call(f.token)).status,200);
 await f.profile.update({plan:'free'});assert.equal((await call(f.token)).status,403);
 await a.operator.update({active:false});assert.equal((await call(a.token)).status,403);
 await o.profile.update({blocked:true});assert.equal((await call(o.token)).status,403);
 await p.profile.delete();assert.equal((await call(p.token)).status,403);
 assert.deepEqual((await f.profile.get()).data(),{uid:f.uid,plan:'free',blocked:false});
});

test('V34.1 HTTP extraction authorizes within request and never writes financial data',async()=>{
 const f=await fixture('v341-free');const p=await fixture('v341-premium','premium');const a=await fixture('v341-admin','free',false,{role:'admin',active:true});
 const body={feature:'invoice-ai',mimeType:'application/pdf',data:Buffer.from('%PDF-1.4\n% synthetic\n%%EOF\n').toString('base64')};
 const extract=async(u,b=body)=>{const res=await fetch(endpoint.replace('authorizePremiumFeature','extractPremiumInvoice'),{method:'POST',headers:{'content-type':'application/json','x-request-id':randomUUID(),...(u?{authorization:'Bearer '+u.token}:{})},body:JSON.stringify(b)});assert.equal(res.headers.get('cache-control'),'no-store');return {status:res.status,body:await res.json()};};
 assert.equal((await extract(null)).status,401);assert.equal((await extract(f)).status,403);assert.equal((await extract(f,{...body,uid:p.uid})).status,403);
 const success=await extract(p);assert.equal(success.status,200);assert.equal(success.body.simulated,true);assert.equal(success.body.requiresReview,true);assert.equal(success.body.items.length,1);
 assert.equal((await extract(a)).status,200);assert.equal((await extract(p,{...body,data:'bad'})).status,400);
 await f.profile.update({plan:'premium'});assert.equal((await extract(f)).status,200);await f.profile.update({plan:'free'});assert.equal((await extract(f)).status,403);
 await a.operator.update({active:false});assert.equal((await extract(a)).status,403);
 assert.deepEqual((await p.profile.get()).data(),{uid:p.uid,plan:'premium',blocked:false});
 const collections=await db.listCollections();assert.ok(collections.every(c=>[ACCOUNT_COLLECTION,ROLE_COLLECTION,USAGE_COLLECTION].includes(c.id)));
});

test('V34.2 real HTTP concurrent requests never exceed per-UID minute quota and duplicates do not count',async()=>{
 const p=await fixture('v342-premium','premium');const q=await fixture('v342-other','premium');
 const body={feature:'invoice-ai',mimeType:'application/pdf',data:Buffer.from('%PDF-1.4\n% synthetic\n%%EOF\n').toString('base64')};
 const run=async(u,id)=>{const res=await fetch(endpoint.replace('authorizePremiumFeature','extractPremiumInvoice'),{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+u.token,...(id?{'x-request-id':id}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});return res.status;};
 assert.equal(await run(p,null),400);
 const id=randomUUID();assert.equal(await run(p,id),200);assert.equal(await run(p,id),409);
 const statuses=await Promise.all(Array.from({length:5},()=>run(p,randomUUID())));
 // Minute boundary can legitimately reset the minute cap; verify exact hard limit separately with fixed clock.
 assert.ok(statuses.every(x=>[200,429].includes(x)));
 const usage=await db.collection(USAGE_COLLECTION).doc(p.uid).get();
 assert.equal(usage.data().day.count,1+statuses.filter(x=>x===200).length);
 assert.equal((await db.collection(USAGE_COLLECTION).doc(p.uid).collection('attempts').get()).size,usage.data().day.count);
 assert.equal(await run(q,id),200);
 assert.equal((await db.collection(USAGE_COLLECTION).doc(q.uid).get()).data().day.count,1);
});
test('V34.2 real Firestore atomic reserve, fixed clock, concurrent duplicate, downgrade and rollover',async()=>{
 const p=await fixture('v342-fixed','premium');let now=Date.parse('2026-11-17T12:00:00Z');
 const reserve=createUsageStore(db,{limits:{minute:2,day:3,month:4},clock:()=>now});
 const id=randomUUID();const duplicate=await Promise.all([reserve({uid:p.uid,requestId:id}),reserve({uid:p.uid,requestId:id})]);
 assert.deepEqual(duplicate.map(x=>x.status).sort(),[200,409]);
 const statuses=await Promise.all(Array.from({length:4},()=>reserve({uid:p.uid,requestId:randomUUID()})));
 assert.equal(statuses.filter(x=>x.status===200).length,1);assert.equal(statuses.filter(x=>x.status===429).length,3);
 now+=60000;assert.equal((await reserve({uid:p.uid,requestId:randomUUID()})).status,200);
 now+=60000;assert.equal((await reserve({uid:p.uid,requestId:randomUUID()})).status,429);
 now+=86400000;assert.equal((await reserve({uid:p.uid,requestId:randomUUID()})).status,200);
 now+=86400000;assert.equal((await reserve({uid:p.uid,requestId:randomUUID()})).status,429);
 now=Date.parse('2026-12-01T00:00:00Z');assert.equal((await reserve({uid:p.uid,requestId:id})).status,409);
 await p.profile.update({plan:'free'});assert.equal((await reserve({uid:p.uid,requestId:randomUUID()})).status,403);
 await p.profile.update({plan:'premium'});assert.equal((await reserve({uid:p.uid,requestId:randomUUID()})).status,200);
 const usage=await db.collection(USAGE_COLLECTION).doc(p.uid).get();assert.equal(usage.data().month.count,1);
 assert.equal((await db.collection(USAGE_COLLECTION).doc(p.uid).collection('attempts').get()).size,5);
 // Isolate the synthetic future-clock fixture from subsequent wall-clock admin queries.
 await db.recursiveDelete(db.collection(USAGE_COLLECTION).doc(p.uid));
 await p.profile.delete();
});

test('V34.3 administrative authorization, transactional quota update, audit and real enforcement',async()=>{
 const {LIMITS_COLLECTION}=await import('./usage.mjs');const {AUDIT_COLLECTION}=await import('./usage-admin.mjs');
 const o=await fixture('v343-owner','free',false,{role:'owner',active:true}),a=await fixture('v343-admin','free',false,{role:'admin',active:true}),p=await fixture('v343-premium','premium'),b=await fixture('v343-blocked','free',true,{role:'admin',active:true});
 const admin=async(u,body)=>{const res=await fetch(endpoint.replace('authorizePremiumFeature','usageAdmin'),{method:'POST',headers:{'content-type':'application/json',...(u?{authorization:'Bearer '+u.token}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(45000)});assert.equal(res.headers.get('cache-control'),'no-store');return {status:res.status,body:await res.json()};};
 const list={action:'list',after:null},get={action:'get',uid:p.uid},set={action:'set',uid:p.uid,limits:{minute:1,day:1,month:1},expectedVersion:0};
 for(const [u,status] of [[null,401],[p,403],[b,403],[a,200],[o,200]])assert.equal((await admin(u,list)).status,status);
 assert.equal((await admin(a,get)).body.row.version,0);
 assert.equal((await admin(a,{...set,uid:a.uid})).status,403);
 assert.equal((await admin(a,{...set,uid:o.uid})).status,403);
 const race=await Promise.all([admin(a,set),admin(a,set)]);assert.deepEqual(race.map(x=>x.status).sort(),[200,409]);
 const doc=await db.collection(LIMITS_COLLECTION).doc(p.uid).get();assert.equal(doc.data().version,1);
 const audits=await db.collection(AUDIT_COLLECTION).where('targetUid','==',p.uid).get();assert.equal(audits.size,1);assert.equal(audits.docs[0].data().actorUid,a.uid);assert.deepEqual(audits.docs[0].data().after,set.limits);
 const reserve=createUsageStore(db);
 assert.equal((await reserve({uid:p.uid,requestId:randomUUID()})).status,200);
 assert.equal((await reserve({uid:p.uid,requestId:randomUUID()})).status,429);
 const row=(await admin(o,get)).body.row;assert.equal(row.used.month,1);assert.ok(row.reached.includes('month'));
 assert.equal((await admin(o,{...set,expectedVersion:1,limits:{minute:2,day:2,month:2}})).status,200);
 assert.equal((await reserve({uid:p.uid,requestId:randomUUID()})).status,200);
 await a.operator.update({active:false});assert.equal((await admin(a,get)).status,403);
 const page=await admin(o,list);assert.equal(page.status,200);assert.ok(page.body.rows.length<=25);assert.equal(page.body.totals.month,page.body.rows.reduce((sum,x)=>sum+x.used.month,0));
 if(page.body.next){const next=await admin(o,{action:'list',after:page.body.next});assert.equal(next.status,200);assert.ok(next.body.rows.every(x=>!page.body.rows.some(y=>y.uid===x.uid)));}
});
