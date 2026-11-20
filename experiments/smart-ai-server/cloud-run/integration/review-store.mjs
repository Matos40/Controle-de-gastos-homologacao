export function createInvoiceReviewStore(){
 const records=[];
 return {
  confirm(invoice,selected){
   if(!invoice?.requiresReview||!Array.isArray(invoice.entries)||!Array.isArray(selected)||!selected.length)throw Error('INVALID_REVIEW');
   const rows=selected.map(({kind,title,date,amountCents,category,currentInstallment,installments})=>{
    if(!Number.isSafeInteger(amountCents)||!title||!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('INVALID_REVIEW');
    return {kind,title,date,amountCents,category,currentInstallment,installments};
   });
   const totalCents=rows.reduce((sum,row)=>sum+row.amountCents,0);
   if(!Number.isSafeInteger(totalCents))throw Error('INVALID_REVIEW');
   records.push(structuredClone({original:{entries:invoice.entries,reconciliation:invoice.reconciliation},rows,totalCents}));
  },
  read:()=>structuredClone(records),
  clear:()=>{records.length=0;},
 };
}
