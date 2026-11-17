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
