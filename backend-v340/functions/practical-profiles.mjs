import {randomUUID} from 'node:crypto';
import {initializeApp,getApps} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {ACCOUNT_COLLECTION,ROLE_COLLECTION} from './policy.mjs';
import {assertLocalEmulators,PROJECT} from './emulator-guard.mjs';
export const PROFILES=Object.freeze(['free','premium','admin','owner']);
export async function prepareProfiles(){
 assertLocalEmulators();
 const app=getApps()[0]??initializeApp({projectId:PROJECT});
 if(app.options.projectId!==PROJECT)throw Error('PROJECT_MISMATCH');
 const db=getFirestore(app),profiles=new Map(),session=randomUUID();
 for(const role of PROFILES){
  const res=await fetch('http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:role+'-'+session+'@example.invalid',password:randomUUID(),returnSecureToken:true}),signal:AbortSignal.timeout(10000)});
  if(!res.ok)throw Error('FIXTURE_FAILED');
  const u=await res.json(),batch=db.batch();
  batch.create(db.collection(ACCOUNT_COLLECTION).doc(u.localId),{uid:u.localId,plan:role==='premium'?'premium':'free',blocked:false});
  if(['admin','owner'].includes(role))batch.create(db.collection(ROLE_COLLECTION).doc(u.localId),{role,active:true});
  await batch.commit();profiles.set(role,{uid:u.localId,token:u.idToken});
 }
 return profiles;
}
