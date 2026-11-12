'use strict';
// Auditoria de compatibilidade sem mutacao, sem storage, sem Firebase.
const {validateSnapshot}=require('./productionDataContractLab.js');
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const YM=/^\d{4}-(0[1-9]|1[0-2])$/;
function inspectLegacy(snapshot){
 const issues=[],stats={months:0,expenses:0,fixed:0,cardExpenses:0,installments:0,
 investments:0,deletedInstallmentOrigins:0,extraIncomes:0};
 if(!obj(snapshot)||!obj(snapshot.months)||!YM.test(snapshot.selectedMonth)||
 !own(snapshot.months,snapshot.selectedMonth))
 return {status:'invalid_legacy_shape',stats,issues:[{code:'invalid_root',path:'root'}],
 contractCompatible:false};
 for(const [ym,m] of Object.entries(snapshot.months)){
  stats.months++;
  if(!YM.test(ym)||!obj(m)){issues.push({code:'invalid_month',path:'months.'+ym});continue;}
  if(!own(m,'salary'))issues.push({code:'missing_salary',path:'months.'+ym});
  if(!own(m,'extraIncomes'))issues.push({code:'missing_extra_incomes',path:'months.'+ym});
  for(const field of ['expenses','cardExpenses','extraIncomes']){
   if(!Array.isArray(m[field])){
    issues.push({code:'missing_or_invalid_collection',path:'months.'+ym+'.'+field});
    continue;
   }
   stats[field]+=m[field].length;
   const ids=new Set();
   for(let i=0;i<m[field].length;i++){
    const item=m[field][i],p='months.'+ym+'.'+field+'['+i+']';
    if(!obj(item)){issues.push({code:'invalid_item',path:p});continue;}
    if(typeof item.id!=='string'||!item.id||ids.has(item.id))
     issues.push({code:'missing_or_duplicate_id',path:p});
    else ids.add(item.id);
    if(field==='expenses'){
     if(item.type==='fixed')stats.fixed++;
     if(item.category==='investimentos')stats.investments++;
    }
    if(field==='cardExpenses'){
     if(item.isInstallment){
      stats.installments++;
      if(!Number.isInteger(item.installments)||item.installments<2||
       !Number.isInteger(item.currentInstallment)||item.currentInstallment<1||
       item.currentInstallment>item.installments)
       issues.push({code:'invalid_installment_sequence',path:p});
      if(!item.installmentOriginId)
       issues.push({code:'legacy_installment_without_origin',path:p});
     }
     if(item.category==='investimentos')stats.investments++;
    }
   }
  }
  if(own(m,'deletedInstallmentOrigins')){
   if(!Array.isArray(m.deletedInstallmentOrigins))
    issues.push({code:'invalid_deleted_origins',path:'months.'+ym+'.deletedInstallmentOrigins'});
   else stats.deletedInstallmentOrigins+=m.deletedInstallmentOrigins.length;
  }
 }
 let contractCompatible=true;
 try{validateSnapshot(snapshot);}catch(e){
  contractCompatible=false;
  issues.push({code:'contract_rejected',path:'root',reason:e.code||'unknown'});
 }
 return {status:issues.length?'review_required':'compatible',stats,issues,contractCompatible};
}
module.exports={inspectLegacy};
