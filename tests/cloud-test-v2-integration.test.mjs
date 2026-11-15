import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blank,apply,seedMigration,canRollbackV2,candidateV2,adaptiveAppend,encodeQueue,decodeQueue,readAdaptiveBackup,adaptiveBackup} from '../js/cloudTest/model.mjs';
import {transitionV2} from '../js/cloudTest/capacityV2.mjs';
function integrationChecks(){
 let n=0;const ok=x=>{if(!x)throw Error("assertion "+n);n++;};const reject=f=>{try{f();}catch{n++;return;}throw Error("expected reject");};
 const id=i=>"00000000-0000-4000-8000-"+String(i).padStart(12,"0"),hash="a".repeat(64),ym="2026-12",d=blank(ym);d.months[ym].salary=5000;
 const p=JSON.stringify(d),v1=apply(null,{id:id(1),expectedRevision:0,payload:p},hash).state,original=JSON.stringify(v1);
 const seed=seedMigration(v1,null,null,id(2),hash);ok(seed.head.payload===v1.payload);ok(seed.head.revision===1&&seed.receipt.revision===1);ok(seed.route.sourceLast===v1.lastOperationId);ok(JSON.stringify(v1)===original);
 ok(canRollbackV2(v1,seed.head,seed.route));ok(seedMigration(v1,seed.head,null,id(3),hash).receipt===null);reject(()=>seedMigration(v1,null,seed.route,id(3),hash));reject(()=>seedMigration(v1,null,null,id(3),"b".repeat(64)));
 const v1changed=apply(v1,{id:id(8),expectedRevision:1,payload:p},"b".repeat(64)).state;reject(()=>seedMigration(v1changed,seed.head,null,id(3),"b".repeat(64)));ok(!canRollbackV2(v1changed,seed.head,seed.route));
 const item=(i,amount)=>({id:"expense_"+i,title:"Despesa Teste",amount,category:"outros",type:"one-time",date:ym+"-10",paid:false}),local=JSON.parse(p),remote=JSON.parse(p);local.months[ym].expenses.push(item(1,100));remote.months[ym].expenses.push(item(2,200));
 const remoteHead={...seed.head,revision:501,lastOperationId:id(501),payload:JSON.stringify(remote),hash:"b".repeat(64),receipts:{[id(500)]:"500:"+hash,[id(501)]:"501:"+"b".repeat(64)}};
 const q={id:id(700),expectedRevision:500,parentId:id(500),payload:JSON.stringify(local)},proof={operationId:q.id,revision:500,parentId:q.parentId,payload:p};
 const reconciled=candidateV2(remoteHead,[q],proof,hash,id(701));ok(reconciled.operation.expectedRevision===501);ok(JSON.parse(reconciled.operation.payload).months[ym].expenses.reduce((s,x)=>s+x.amount,0)===300);
 ok(!candidateV2(remoteHead,[q],null,hash,id(701)).operation);ok(!candidateV2(remoteHead,[q],proof,"f".repeat(64),id(701)).operation);
 const {receipts,...raw}=remoteHead,next=transitionV2(raw,null,reconciled.operation,"c".repeat(64));ok(next.head.revision===502);ok(transitionV2(next.head,next.receipt,reconciled.operation,"c".repeat(64)).replay);ok(!canRollbackV2(v1,next.head,seed.route));
 const a=adaptiveAppend(remoteHead,[],{revision:501,parent:id(501)},p,id(800));ok(a.expectedRevision===501);ok(decodeQueue(encodeQueue(a)).expectedRevision===501);ok(readAdaptiveBackup(adaptiveBackup("synthetic", [a]),"synthetic")[0].id===a.id);reject(()=>readAdaptiveBackup(adaptiveBackup("synthetic",[a]),"another"));
 return n;
}
test('V2 migration, safe rollback, sparse receipts, high revisions and offline merge',()=>assert.equal(integrationChecks(),21));
