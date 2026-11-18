import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {assertLocalEmulators,PROJECT} from './emulator-guard.mjs';
export const profiles=['free','premium','admin','owner'];
export const password='Raytech-Lab-3474!';
export async function seed(){
 assertLocalEmulators();
 const app=initializeApp({projectId:PROJECT},'rc3474-seed'),db=getFirestore(app);
 try{
 for(const name of profiles){
 const email=name+'@example.invalid';
 const response=await fetch('http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-v345',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true}),signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error('FIXTURE_CREATION_FAILED');
 const {localId:uid}=await response.json();
 const batch=db.batch();
 batch.create(db.collection('raytechV345Accounts').doc(uid),{uid,name:'Laboratorio '+name,plan:name==='premium'?'premium':'free',blocked:false});
 if(['admin','owner'].includes(name))batch.create(db.collection('raytechV345Roles').doc(uid),{role:name,active:true});
 await batch.commit();
 }
 }finally{await deleteApp(app);}
}
