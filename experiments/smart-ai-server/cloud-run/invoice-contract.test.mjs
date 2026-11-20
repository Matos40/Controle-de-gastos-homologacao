import assert from 'node:assert/strict';
import {test} from 'node:test';
import {reconcileInvoice} from './invoice-contract.mjs';
import {extractInvoice} from './invoice.mjs';

const row=(kind='PURCHASE',amountCents=1890,extra={})=>({kind,title:'Café Ônix',date:'2026-11-05',amountCents,
 currentInstallment:null,installments:null,...extra});
const bill=(entries=[],statementTotalCents=0,extra={})=>({entries,statementTotalCents,
 priorBalanceCents:null,priorPaymentsCents:null,balanceBasis:'ACTIVITY_ONLY',...extra});
const check=(kind,amount)=>reconcileInvoice(bill([row(kind,amount)],amount));
test('positive purchases use exact cents',()=>assert.equal(check('PURCHASE',1890).entries[0].amountCents,1890));
test('refund keeps negative sign',()=>assert.equal(check('REFUND',-625).reconciliation.creditsAndRefundsCents,-625));
test('discount keeps negative sign',()=>assert.equal(check('DISCOUNT',-25).entries[0].amountCents,-25));
test('statement credit keeps negative sign',()=>assert.equal(check('CREDIT',-450).entries[0].amountCents,-450));
test('interest penalties annual fees and fees count as positive charges',()=>{
 for(const kind of ['INTEREST','PENALTY','ANNUAL_FEE','FEE'])assert.equal(check(kind,300).reconciliation.calculatedTotalCents,300);
});
test('incompatible signs are rejected',()=>{
 for(const [kind,amount] of [['PURCHASE',-1],['REFUND',1],['DISCOUNT',1],['CREDIT',1],['INTEREST',0],['FEE',-1]])assert.throws(()=>check(kind,amount));
});
test('cent precision is exact',()=>assert.equal(reconcileInvoice(bill([row('PURCHASE',10),row('PURCHASE',20)],30)).reconciliation.differenceCents,0));
test('valid installment counts only the billed amount',()=>{
 const result=reconcileInvoice(bill([row('INSTALLMENT',2590,{currentInstallment:2,installments:3})],2590));
 assert.equal(result.entries[0].currentInstallment,2);
 assert.equal(result.reconciliation.calculatedTotalCents,2590);
});
test('invalid installments are rejected',()=>{
 for(const [currentInstallment,installments] of [[3,2],[1,1],[0,3],[1,121]])assert.throws(()=>reconcileInvoice(
  bill([row('INSTALLMENT',2590,{currentInstallment,installments})],2590)));
});
test('explicit statement total is retained even if different',()=>assert.equal(reconcileInvoice(bill([],22)).reconciliation.statementTotalCents,22));
test('credit balance is valid',()=>assert.equal(check('REFUND',-625).reconciliation.calculatedTotalCents,-625));
test('zero statement reconciles',()=>assert.equal(reconcileInvoice(bill([row('PURCHASE',100),row('REFUND',-100)],0)).reconciliation.status,'RECONCILED'));
test('prior balance and payments are separate from new activity',()=>{
 const data=bill([row('PURCHASE',1000)],1300,{balanceBasis:'WITH_PRIOR',priorBalanceCents:900,priorPaymentsCents:-600});
 const r=reconcileInvoice(data);
 assert.equal(r.reconciliation.identifiedEntriesCents,1000);
 assert.equal(r.reconciliation.calculatedTotalCents,1300);
 assert.equal(r.entries.length,1);
 assert.throws(()=>reconcileInvoice({...data,priorPaymentsCents:600}));
});
test('absent amounts and incomplete prior components never imply zero',()=>{
 const r=reconcileInvoice(bill([],null,{balanceBasis:'WITH_PRIOR',priorBalanceCents:900}));
 assert.equal(r.reconciliation.status,'INCOMPLETE');
 assert.equal(r.reconciliation.calculatedTotalCents,null);
 assert.ok(r.reconciliation.warnings.includes('MISSING_STATEMENT_TOTAL'));
 assert.equal(reconcileInvoice(bill([row('PURCHASE',null)],250)).reconciliation.calculatedTotalCents,null);
});
test('previously blocked 08.3.8 case reconciles to 3855 cents without artificial adjustment',()=>{
 const r=reconcileInvoice(bill([row(),row('INSTALLMENT',2590,{currentInstallment:2,installments:3}),row('REFUND',-625)],3855));
 assert.equal(r.reconciliation.calculatedTotalCents,3855);
 assert.equal(r.reconciliation.differenceCents,0);
 assert.equal(r.reconciliation.status,'RECONCILED');
 assert.equal(r.entries.length,3);
});
const request={method:'POST',headers:{authorization:'Bearer fixture','x-request-id':'00000000-0000-4000-8000-000000000001'},
 body:{feature:'invoice-ai',mimeType:'application/pdf',data:Buffer.from('%PDF-1.4\n%%EOF\n').toString('base64')}};
async function read(response){
 const effects=[];
 const result=await extractInvoice(request,{
  verifyToken:async()=>({uid:'fixture'}),readPermissions:async()=>({account:{uid:'fixture',plan:'free',blocked:false}}),
  reserveUsage:async()=>{effects.push('reserve');return {status:200}},
  finishOutcome:async status=>effects.push(status.status),provider:async()=>response,invoiceContractVersion:2,
 });
 return {result,effects};
}
test('divergence goes to review and settles as a usable extraction',async()=>{
 const {result,effects}=await read(bill([row()],2000));
 assert.equal(result.status,200);
 assert.equal(result.body.reconciliation.status,'DIVERGENT');
 assert.equal(result.body.reconciliation.differenceCents,110);
 assert.equal(result.body.requiresReview,true);
 assert.deepEqual(effects,['reserve','completed']);
});
test('fractional nonnumeric unsafe and out-of-range money is rejected',()=>{
 for(const value of [1.5,'123',1_000_000_001,Number.MAX_SAFE_INTEGER+1,Infinity,NaN])assert.throws(()=>check('PURCHASE',value));
});
test('possible duplicate items are marked and retained',()=>{
 const r=reconcileInvoice(bill([row(),row()],3780));
 assert.deepEqual(r.reconciliation.possibleDuplicateIndexes,[1]);
 assert.equal(r.entries.length,2);
});
test('structural provider failure refunds the reservation and is marked INVALID',async()=>{
 const {result,effects}=await read(bill([row('REFUND',625)],-625));
 assert.equal(result.status,502);
 assert.equal(result.body.creditRefunded,true);
 assert.equal(result.body.reconciliation.status,'INVALID');
 assert.deepEqual(effects,['reserve','failed']);
});
test('reconciled reply keeps review-only contract and only invokes quota effects',async()=>{
 const {result,effects}=await read(bill([row('REFUND',-625)],-625));
 assert.equal(result.status,200);
 assert.equal(result.body.requiresReview,true);
 assert.equal(result.body.items[0].installmentValue,-6.25);
 assert.equal(result.body.schemaVersion,2);
 assert.deepEqual(effects,['reserve','completed']);
 assert.equal(Object.hasOwn(result.body,'ledger'),false);
});
