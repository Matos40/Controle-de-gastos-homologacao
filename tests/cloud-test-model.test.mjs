import {test} from 'node:test';
import assert from 'node:assert/strict';
import {blank,validatePayload,validId,validateEnvelope,apply} from '../js/cloudTest/model.mjs';
function checks(){
 let n=0;const ok=x=>{if(!x)throw Error("check "+n);n++;};const reject=(fn,code)=>{try{fn();}catch(e){ok(e.message.startsWith(code));return;}throw Error("expected "+code);};
 const d=blank("2026-11");ok(validatePayload(JSON.stringify(d)).months["2026-11"].salary===0);
 d.months["2026-11"].salary=5500;d.months["2026-11"].expenses.push({id:"exp_1",title:"Energia Teste",amount:150,category:"moradia",type:"fixed",date:"2026-11-14",paid:false});
 const q={id:"00000000-0000-4000-8000-000000000001",expectedRevision:0,payload:JSON.stringify(d)};const hash="a".repeat(64);const s=apply(null,q,hash).state;
 ok(s.revision===1);ok(JSON.parse(s.payload).months["2026-11"].expenses[0].amount===150);ok(apply(s,q,hash).replay);reject(()=>apply(s,q,"b".repeat(64)),"ID_REUSE");
 const q2={...q,id:"00000000-0000-4000-8000-000000000002"};reject(()=>apply(s,q2,hash),"CONFLICT");d.months["2026-11"].expenses=[];d.months["2026-11"].cardExpenses.push({id:"card_1",installmentOriginId:"card_1",title:"Compra Teste",category:"compras",isInstallment:true,installmentValue:100,totalAmount:300,installments:3,currentInstallment:1,date:"2026-11-14",paid:false});
 const s2=apply(s,{...q2,expectedRevision:1,payload:JSON.stringify(d)},"b".repeat(64)).state;ok(s2.revision===2&&Object.keys(s2.receipts).length===2);ok(apply(s2,q,hash).replay);d.months["2026-11"].cardExpenses[0].title="Dados reais";reject(()=>validatePayload(JSON.stringify(d)),"INVALID_TEST_DATA");d.months["2026-11"].cardExpenses[0].title="Compra Teste";d.months["2026-11"].cardExpenses[0].currentInstallment=4;reject(()=>validatePayload(JSON.stringify(d)),"INVALID_TEST_DATA");reject(()=>validateEnvelope({...s2,receipts:{}}),"INVALID_ENVELOPE");return n;
}
test('integrated test snapshot: validation, replay, conflict, deletion, installments',()=>assert.equal(checks(),11));
