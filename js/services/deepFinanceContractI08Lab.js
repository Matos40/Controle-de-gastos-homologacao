'use strict';
// I08: auditoria estrita e somente leitura. Nao substitui o contrato legado.
const {validateSnapshot,cents}=require('./productionDataContractLab.js');
const {validateMarkers}=require('./installmentDeletionPolicyLab.js');
const {balances}=require('./reversibleFinanceMigrationLab.js');
class DeepContractError extends Error{constructor(code,path){super(code+' at '+path);this.code=code;this.path=path;}}
const fail=(code,path)=>{throw new DeepContractError(code,path);};
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const month=/^\d{4}-(0[1-9]|1[0-2])$/;
const category=/^[a-zA-ZÀ-ÿ0-9][a-zA-ZÀ-ÿ0-9 _-]{0,63}$/;
function date(value,ym,path){
 if(typeof value!=='string'||!/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(value))fail('invalid_date',path);
 const [y,m,d]=value.split('-').map(Number);
 if(!Number.isInteger(y)||new Date(Date.UTC(y,m-1,d)).toISOString().slice(0,10)!==value)fail('invalid_date',path);
 if(value.slice(0,7)!==ym)fail('date_outside_month',path);
}
function money(n,path){try{cents(n);}catch{fail('invalid_money',path);}if(n<0)fail('negative_money',path);}
function str(s,path){if(typeof s!=='string'||!s.trim()||s.length>200)fail('invalid_text',path);}
function flag(b,path){if(typeof b!=='boolean')fail('invalid_flag',path);}
function audit(snapshot,{futureDeletions={},maxBalanceCents=Number.MAX_SAFE_INTEGER}={}){
 try{validateSnapshot(snapshot);}catch{fail('invalid_base_contract','snapshot');}
 if(!futureDeletions||typeof futureDeletions!=='object'||Array.isArray(futureDeletions))fail('invalid_deletions','futureDeletions');
 if(!Number.isSafeInteger(maxBalanceCents)||maxBalanceCents<0)fail('invalid_limit','maxBalanceCents');
 const seenGlobal=new Map(),seenInstallments=new Map(),markerMonths=new Map();
 for(const [ym,keys] of Object.entries(futureDeletions)){
  if(!month.test(ym)||own(snapshot.months,ym))fail('invalid_future_month',ym);
  try{validateMarkers(keys);}catch{fail('invalid_markers',ym);}
  markerMonths.set(ym,keys);
 }
 let count=0;
 for(const [ym,m] of Object.entries(snapshot.months)){
  const root='months.'+ym;
  if(own(m,'budgetLimit'))money(m.budgetLimit,root+'.budgetLimit');
  if(own(m,'closed'))flag(m.closed,root+'.closed');
  if(own(m,'closedAt')&&m.closedAt!==null)date(m.closedAt,ym,root+'.closedAt');
  if(m.closed===true&&(!m.closedAt||typeof m.closedAt!=='string'))fail('missing_close_date',root);
  if(m.closed===false&&m.closedAt!=null)fail('unexpected_close_date',root);
  if(own(m,'deletedInstallmentOrigins')){
   try{validateMarkers(m.deletedInstallmentOrigins);}catch{fail('invalid_markers',root);}
   markerMonths.set(ym,m.deletedInstallmentOrigins);
  }
  money(m.salary,root+'.salary');
  for(const field of ['expenses','cardExpenses','extraIncomes']){
   for(const item of m[field]){
    const p=root+'.'+field+'.'+item.id;count++;
    if(own(item,'date'))date(item.date,ym,p+'.date');
    if(own(item,'paid'))flag(item.paid,p+'.paid');
    if(own(item,'category')&&(typeof item.category!=='string'||!category.test(item.category)))fail('invalid_category',p);
    if(field==='expenses'){
     str(item.title,p+'.title');money(item.amount,p+'.amount');
     if(!['fixed','one-time','variable'].includes(item.type))fail('invalid_expense_type',p);
     if(item.category==='investimentos'&&item.type==='fixed')fail('ambiguous_investment',p);
    }else if(field==='extraIncomes'){
     money(item.amount,p+'.amount');
     if(own(item,'description'))str(item.description,p+'.description');
    }else{
     str(item.title,p+'.title');money(item.installmentValue,p+'.installmentValue');
     if(typeof item.isInstallment!=='boolean')fail('invalid_installment_flag',p);
     if(item.isInstallment){
      if(!Number.isSafeInteger(item.installments)||item.installments<2||item.installments>120||
       !Number.isSafeInteger(item.currentInstallment)||item.currentInstallment<1||item.currentInstallment>item.installments)fail('invalid_sequence',p);
      if(own(item,'totalAmount'))money(item.totalAmount,p+'.totalAmount');
      if(typeof item.installmentOriginId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(item.installmentOriginId))fail('unproven_origin',p);
      const key=item.installmentOriginId+':'+item.currentInstallment;
      if(seenInstallments.has(ym+':'+key))fail('duplicate_installment',p);
      seenInstallments.set(ym+':'+key,p);
      if((markerMonths.get(ym)||[]).includes(key))fail('deleted_installment_present',p);
     }else if(own(item,'currentInstallment')||own(item,'installmentOriginId'))fail('non_installment_sequence',p);
    }
    const globalKey=ym+':'+field+':'+item.id;
    if(seenGlobal.has(globalKey))fail('duplicate_entry',p);
    seenGlobal.set(globalKey,true);
   }
  }
 }
 let calculated;
 try{calculated=balances(snapshot);}catch{fail('invalid_balance','balances');}
 for(const [ym,value] of Object.entries(calculated)){
  if(!Number.isFinite(value)||Math.abs(Math.round(value*100))>maxBalanceCents||
   Math.abs(value*100-Math.round(value*100))>1e-5)fail('invalid_balance','balances.'+ym);
 }
 return {status:'VALID_IN_LAB',months:Object.keys(snapshot.months).length,entries:count,balances:calculated,
  futureMarkers:[...markerMonths.keys()].filter(x=>!own(snapshot.months,x)).length};
}
module.exports={DeepContractError,audit,date};
