import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {ACCOUNT_COLLECTION,ROLE_COLLECTION} from './policy.mjs';
import {PROJECT,assertLocalEmulators} from './emulator-guard.mjs';
assertLocalEmulators();
const app=initializeApp({projectId:PROJECT}),db=getFirestore(app);
let server;
after(async()=>{server?.kill();await deleteApp(app);});
test('local panel serves CSP and proxies authorized synthetic requests',async()=>{
 const res=await fetch('http://127.0.0.1:19099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'v343-panel@example.invalid',password:'fictional-pass-123',returnSecureToken:true})});
 assert.equal(res.status,200);const u=await res.json();
 await db.collection(ACCOUNT_COLLECTION).doc(u.localId).set({uid:u.localId,plan:'free',blocked:false});
 await db.collection(ROLE_COLLECTION).doc(u.localId).set({role:'admin',active:true});
 server=spawn(process.execPath,['functions/admin-panel-server.mjs'],{stdio:'ignore'});
 const root='http://127.0.0.1:15002';let page;
 for(let i=0;i<50;i++){try{page=await fetch(root);break;}catch{await new Promise(r=>setTimeout(r,100));}}
 assert.ok(page);assert.equal(page.status,200);assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.match(await page.text(),/Raytech CG/);
 assert.equal((await fetch(root+'/admin-panel.js')).status,200);
 const call=(token,origin=root)=>fetch(root+'/api/usageAdmin',{method:'POST',headers:{origin,'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify({action:'get',uid:u.localId})});
 assert.equal((await call(null)).status,401);assert.equal((await call(u.idToken,'https://example.invalid')).status,403);
 const data=await call(u.idToken);assert.equal(data.status,200);assert.equal((await data.json()).row.uid,u.localId);
});
