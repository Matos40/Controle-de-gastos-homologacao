/* Strict synthetic snapshot boundary. No access to browser storage. */
const marker="raytech-financial-test-v1";
export function blank(ym){return {selectedMonth:ym,months:{[ym]:{salary:0,budgetLimit:0,extraIncomes:[],expenses:[],cardExpenses:[],deletedInstallmentOrigins:[],closed:false,closedAt:null}}};}
export function validatePayload(payload){
  const fail=()=>{throw Error("INVALID_TEST_DATA: utilize descrições com a palavra Teste e valores válidos.");};
  const obj=x=>!!x&&typeof x==="object"&&!Array.isArray(x);
  const keys=(x,allowed,required=allowed)=>obj(x)&&Object.keys(x).every(k=>allowed.includes(k))&&required.every(k=>Object.hasOwn(x,k));
  const ym=x=>typeof x==="string"&&/^(20[0-9]{2})-(0[1-9]|1[0-2])$/.test(x);
  const date=x=>typeof x==="string"&&/^20[0-9]{2}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/.test(x);
  const money=x=>typeof x==="number"&&Number.isFinite(x)&&x>=0&&x<=10000000&&Math.abs(x*100-Math.round(x*100))<0.0001;
  const id=x=>typeof x==="string"&&/^[a-zA-Z0-9_-]{1,100}$/.test(x);
  const name=x=>typeof x==="string"&&x.length<=100&&/\bteste\b/i.test(x)&&!/[\x00-\x1f<>&"'`\\]/.test(x);
  const cat=x=>["moradia","alimentacao","transporte","compras","lazer","saude","investimentos","outros"].includes(x);
  if(typeof payload!=="string"||payload.length>180000)fail();
  const d=JSON.parse(payload);
  if(!keys(d,["selectedMonth","months"])||!ym(d.selectedMonth)||!obj(d.months)||!Object.hasOwn(d.months,d.selectedMonth)||Object.keys(d.months).length>24)fail();
  for(const [month,m] of Object.entries(d.months)){
    if(!ym(month)||!keys(m,["salary","budgetLimit","extraIncomes","expenses","cardExpenses","deletedInstallmentOrigins","closed","closedAt"],["salary","budgetLimit","extraIncomes","expenses","cardExpenses","closed","closedAt"])||!money(m.salary)||!money(m.budgetLimit)||typeof m.closed!=="boolean"||!(m.closedAt===null||(typeof m.closedAt==="string"&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(m.closedAt))))fail();
    for(const k of ["expenses","cardExpenses","extraIncomes"]){if(!Array.isArray(m[k])||m[k].length>200)fail();const seen=new Set();for(const x of m[k]){
      if(!obj(x)||!id(x.id)||seen.has(x.id)||!date(x.date))fail();seen.add(x.id);
      if(k==="expenses"){
        if(!keys(x,["id","title","category","amount","type","date","paid"])||!name(x.title)||!cat(x.category)||!money(x.amount)||!["fixed","one-time"].includes(x.type)||typeof x.paid!=="boolean")fail();
      }else if(k==="extraIncomes"){
        if(!keys(x,["id","description","amount","date"])||!name(x.description)||!money(x.amount))fail();
      }else{
        if(!keys(x,["id","installmentOriginId","title","category","isInstallment","installmentValue","totalAmount","installments","currentInstallment","date","paid"],["id","title","category","isInstallment","installmentValue","totalAmount","installments","currentInstallment","date","paid"])||!name(x.title)||!cat(x.category)||typeof x.isInstallment!=="boolean"||typeof x.paid!=="boolean"||!money(x.installmentValue)||!money(x.totalAmount)||!Number.isInteger(x.installments)||!Number.isInteger(x.currentInstallment)||x.installments<1||x.installments>120||x.currentInstallment<1||x.currentInstallment>x.installments||(x.isInstallment?(!id(x.installmentOriginId)||x.installments<2):(x.installments!==1||x.currentInstallment!==1))||Math.abs(x.totalAmount-x.installmentValue*x.installments)>0.011)fail();
      }
    }}
    const tomb=m.deletedInstallmentOrigins??[];if(!Array.isArray(tomb)||tomb.length>500||new Set(tomb).size!==tomb.length||!tomb.every(x=>typeof x==="string"&&/^[a-zA-Z0-9_-]{1,100}:[1-9][0-9]{0,2}$/.test(x)))fail();
  }return d;
}
export function validId(x){return typeof x==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(x);}
export function validateEnvelope(s){
  if(!s||Object.keys(s).sort().join("|")!=="lastOperationId|marker|payload|receipts|revision"||s.marker!==marker||!Number.isInteger(s.revision)||s.revision<1||s.revision>500||!s.receipts||typeof s.receipts!=="object"||Array.isArray(s.receipts)||Object.keys(s.receipts).length!==s.revision||!validId(s.lastOperationId)||!Object.hasOwn(s.receipts,s.lastOperationId))throw Error("INVALID_ENVELOPE");
  const revs=new Set();for(const [k,v] of Object.entries(s.receipts)){if(!validId(k)||typeof v!=="string"||!/^[1-9][0-9]{0,2}:[0-9a-f]{64}$/.test(v))throw Error("INVALID_RECEIPT");const n=Number(v.split(":")[0]);if(n>s.revision||revs.has(n))throw Error("INVALID_RECEIPT");revs.add(n);}
  if(!s.receipts[s.lastOperationId].startsWith(s.revision+":"))throw Error("INVALID_RECEIPT");
  validatePayload(s.payload);return s;
}
export function apply(old,q,hash){
  if(old)validateEnvelope(old);if(!q||!validId(q.id)||!Number.isInteger(q.expectedRevision)||q.expectedRevision<0||q.expectedRevision>=500||typeof hash!=="string"||!/^[0-9a-f]{64}$/.test(hash))throw Error("INVALID_COMMAND");
  validatePayload(q.payload);const receipt=(q.expectedRevision+1)+":"+hash;
  if(old&&Object.hasOwn(old.receipts,q.id)){if(old.receipts[q.id]!==receipt)throw Error("ID_REUSE");return {state:old,replay:true};}
  if((old?.revision??0)!==q.expectedRevision)throw Error("CONFLICT");
  const s={marker,revision:q.expectedRevision+1,lastOperationId:q.id,payload:q.payload,receipts:{...(old?.receipts??{}),[q.id]:receipt}};validateEnvelope(s);return {state:s,replay:false};
}
