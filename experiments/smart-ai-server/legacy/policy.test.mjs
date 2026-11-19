import {test} from 'node:test';
import assert from 'node:assert/strict';
import {authorizePremium,decidePremium} from './policy.mjs';
import {assertLocalEmulators} from './emulator-guard.mjs';
const account=(plan='free',blocked=false)=>({uid:'fixture',plan,blocked});
const role=(role,active=true)=>({role,active});
const request={method:'POST',headers:{authorization:'Bearer fictional-token'},body:{feature:'invoice-ai'},query:{}};
const run=(req=request,a=account(),r=null,verifyToken=async()=>({uid:'fixture'}))=>authorizePremium(req,{verifyToken,readPermissions:async uid=>{assert.equal(uid,'fixture');return {account:a,role:r};}});
for(const [name,a,r,expected] of [
 ['free',account(),null,403],['premium',account('premium'),null,200],['owner',account(),role('owner'),200],['admin',account(),role('admin'),200],['blocked premium',account('premium',true),null,403],['blocked owner',account('free',true),role('owner'),403],['inactive admin',account(),role('admin',false),403],['unknown role',account(),role('superuser'),403],['missing profile',null,role('owner'),403],['wrong UID',{...account('premium'),uid:'other'},null,403],['invalid plan',account('gold'),role('admin'),403],['missing blocked flag',{uid:'fixture',plan:'premium'},null,403]
])test(name,async()=>assert.equal((await run(request,a,r)).status,expected));
for(const [name,req,expected] of [
 ['GET',{...request,method:'GET'},405],['no token',{...request,headers:{}},401],['malformed bearer',{...request,headers:{authorization:'Bearer a b'}},401],['unknown feature',{...request,body:{feature:'other'}},400],['spoof UID',{...request,body:{feature:'invoice-ai',uid:'other'}},400],['spoof plan',{...request,body:{feature:'invoice-ai',plan:'premium'}},400],['spoof role',{...request,body:{feature:'invoice-ai',role:'owner'}},400],['query UID',{...request,query:{uid:'other'}},400],['array body',{...request,body:[]},400]
])test(name,async()=>assert.equal((await run(req)).status,expected));
for(const reason of ['expired','revoked','invalid signature','wrong project','disabled'])test('verification rejects '+reason,async()=>assert.equal((await run(request,account('premium'),null,async()=>{throw Error(reason)})).status,401));
test('invalid verified UID',async()=>assert.equal((await run(request,account('premium'),null,async()=>({uid:'../other'}))).status,401));
test('database failure denies',async()=>assert.deepEqual(await authorizePremium(request,{verifyToken:async()=>({uid:'fixture'}),readPermissions:async()=>{throw Error('unavailable')}}),{status:503,body:{allowed:false}}));
test('promotion and downgrade are evaluated every request',async()=>{let a=account();const call=()=>run(request,a);assert.equal((await call()).status,403);a=account('premium');assert.equal((await call()).status,200);a=account();assert.equal((await call()).status,403);});
test('emulator guard fails closed for missing or remote project/hosts',()=>{const e={GCLOUD_PROJECT:'demo-raytech-v340',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:19099',FIRESTORE_EMULATOR_HOST:'127.0.0.1:18080'};assert.doesNotThrow(()=>assertLocalEmulators(e));for(const k of Object.keys(e)){assert.throws(()=>assertLocalEmulators({...e,[k]:'remote'}),/EMULATOR_ONLY/);}assert.throws(()=>assertLocalEmulators({}),/EMULATOR_ONLY/);});
