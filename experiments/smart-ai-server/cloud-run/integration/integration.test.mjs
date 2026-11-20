import assert from 'node:assert/strict';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
import {createLab} from './lab.mjs';

const origin='http://127.0.0.1:8784';
const body={feature:'invoice-ai',mimeType:'application/pdf',data:Buffer.from('%PDF-1.4\n%%EOF\n').toString('base64')};
const call=(lab,token,path,data)=>lab.bridge(new Request(origin+path,{
 method:data?'POST':'GET',
 headers:{authorization:'Bearer '+token,'content-type':'application/json','x-request-id':randomUUID(),
  'x-serverless-authorization':'client-provided-value'},
 body:data?JSON.stringify(data):undefined,
}));
const credits=async(lab,token)=>(await call(lab,token,'/v1/credits')).json();
test('integration uses real commercial policy with independent synthetic sessions and transactional admission',async()=>{
 const lab=createLab({origin}),free=lab.login('free'),premium=lab.login('premium');
 assert.equal((await call(lab,'invalid','/v1/credits')).status,401);
 assert.equal((await credits(lab,free)).remaining,2);
 assert.match((await credits(lab,premium)).nextRenewalDate,/-01$/);
 const responses=await Promise.all([call(lab,free,'/v1/invoices',body),call(lab,free,'/v1/invoices',body)]);
 const success=responses.find(r=>r.ok),blocked=responses.find(r=>!r.ok);
 assert.equal((await blocked.json()).error,'ACTIVE_REQUEST');
 const invoice=await success.json();
 assert.deepEqual(invoice.entries.map(row=>row.amountCents),[1890,2590,-625]);
 assert.equal(invoice.entries[1].currentInstallment,2);
 assert.equal(invoice.reconciliation.calculatedTotalCents,3855);
 assert.equal(invoice.reconciliation.differenceCents,0);
 assert.equal(invoice.requiresReview,true);
 assert.equal((await call(lab,free,'/v1/invoices',body)).status,200);
 assert.equal((await call(lab,free,'/v1/invoices',body)).status,429);
 assert.equal((await credits(lab,free)).remaining,0);
 assert.equal((await credits(lab,premium)).remaining,15);
 lab.logout(free);
 assert.equal((await call(lab,free,'/v1/credits')).status,401);
});
test('suspension, failure restitution, duplicate and uncertain totals are presented through the contract',async()=>{
 for(const [mode,expected] of [['divergent','DIVERGENT'],['incomplete','INCOMPLETE'],['duplicates','DIVERGENT']]){
  const lab=createLab({origin,mode}),token=lab.login('free');
  const result=await (await call(lab,token,'/v1/invoices',body)).json();
  assert.equal(result.reconciliation.status,expected);
  if(mode==='duplicates')assert.ok(result.reconciliation.warnings.includes('POSSIBLE_DUPLICATES'));
 }
 const lab=createLab({origin,mode:'failed'}),token=lab.login('free');
 for(let index=0;index<2;index++){
  const failure=await (await call(lab,token,'/v1/invoices',body)).json();
  assert.equal(failure.creditRefunded,true);
 }
 assert.equal((await call(lab,token,'/v1/invoices',body)).status,429);
 assert.equal((await credits(lab,token)).remaining,2);
 for(const [mode,expected] of [['suspended','FINANCE_SUSPENDED'],['unavailable','EXPERIMENT_UNAVAILABLE']]){
  const blocked=createLab({origin,mode});await blocked.ready;
  const member=blocked.login('free');
  assert.equal((await (await call(blocked,member,'/v1/invoices',body)).json()).error,expected);
  assert.equal((await credits(blocked,member)).remaining,2);
 }
});
test('administrative bridge rejects forged privilege and requires a fresh Owner session for finance changes',async()=>{
 const lab=createLab({origin,mode:'suspended'});await lab.ready;
 const free=lab.login('free'),admin=lab.login('admin'),owner=lab.login('owner');
 const post=(token,data)=>call(lab,token,'/v1/admin/ai',data);
 assert.equal((await post(free,{action:'overview'})).status,403);
 assert.equal(lab.login('owner',admin),null);
 const body={action:'reactivateFinance',confirmed:true,expectedVersion:1};
 assert.equal((await post(admin,body)).status,403);
 assert.equal((await post(owner,body)).status,403);
 const fresh=lab.login('owner',owner);
 assert.equal((await post(fresh,body)).status,200);
 assert.equal((await post(owner,{action:'overview'})).status,401);
 const result=await (await post(fresh,{action:'overview'})).json();
 assert.equal(result.finance.suspended,false);
 assert.equal(result.auditCount,1);
});


test('bridge keeps the browser bearer separate from IAM and rejects foreign origins and unexpected routes',async()=>{
 const {createBridge}=await import('./bridge.mjs');
 let invoked=0;
 const bridge=createBridge({origin,verifyFirebase:async token=>token==='fixture'?{uid:'lab-free'}:null,
  invoke:async(path,options,identity)=>{
   invoked++;
   assert.equal(path,'/v1/credits');assert.equal(identity.uid,'lab-free');
   assert.equal(options.headers.get('authorization'),'Bearer fixture');
   assert.equal(options.headers.has('x-serverless-authorization'),false);
   return Response.json({ok:true},{headers:{'set-cookie':'private=fixture'}});
  }});
 const req=(path,source)=>new Request(origin+path,{headers:{origin:source,authorization:'Bearer fixture','x-serverless-authorization':'forged'}});
 assert.equal((await bridge(req('/v1/credits','https://other.invalid'))).status,403);
 assert.equal((await bridge(req('/internal/budget-push',origin))).status,404);
 const result=await bridge(req('/v1/credits',origin));
 assert.equal(result.status,200);
 assert.equal(result.headers.get('cache-control'),'no-store');
 assert.equal(result.headers.has('set-cookie'),false);
 assert.equal(invoked,1);
});
