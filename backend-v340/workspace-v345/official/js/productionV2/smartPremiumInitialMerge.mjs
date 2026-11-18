import {validatePayload,canonical} from './model.mjs';
const emptyMonth = month => !month.closed && month.closedAt === null &&
  !month.salary && !month.budgetLimit && !month.expenses.length &&
  !month.cardExpenses.length && !month.extraIncomes.length &&
  !(month.deletedInstallmentOrigins ?? []).length;

export function isEmptyFinance(payload) {
  return Object.values(validatePayload(payload).months).every(emptyMonth);
}

// No common ancestor on first link: union independent IDs, refuse conflicting fields or installment histories.
export function mergeInitial(local,remote){
 const l=validatePayload(local),r=validatePayload(remote),out=structuredClone(r);
 const eq=(a,b)=>canonical(a)===canonical(b);const fail=()=>{throw Error('PREMIUM_INITIAL_CONFLICT');};
 for(const [ym,m] of Object.entries(l.months)){
  if(!out.months[ym]){out.months[ym]=structuredClone(m);continue;}
  const n=out.months[ym];if(eq(m,n))continue;
  if(emptyMonth(m))continue;if(emptyMonth(n)){out.months[ym]=structuredClone(m);continue;}
  if(m.closed||n.closed||m.closedAt!==n.closedAt)fail();
  for(const k of ['salary','budgetLimit']){if(m[k]&&n[k]&&m[k]!==n[k])fail();n[k]=m[k]||n[k];}
  const tomb=new Set([...(m.deletedInstallmentOrigins??[]),...(n.deletedInstallmentOrigins??[])]);
  if(tomb.size&&!eq(m.deletedInstallmentOrigins??[],n.deletedInstallmentOrigins??[]))fail();
  for(const k of ['expenses','cardExpenses','extraIncomes']){
   const by=new Map(n[k].map(x=>[x.id,x]));for(const x of m[k]){if(by.has(x.id)){if(!eq(by.get(x.id),x))fail();}else{if(k==='cardExpenses'&&x.isInstallment&&n[k].some(y=>y.isInstallment&&y.installmentOriginId===x.installmentOriginId))fail();n[k].push(structuredClone(x));by.set(x.id,x);}}
  }
 }
 // Refuse incompatible parcel series across months, even when each individual month validates.
 const series=d=>{const x=new Map();for(const [ym,m] of Object.entries(d.months)){for(const c of m.cardExpenses)if(c.isInstallment){const a=x.get(c.installmentOriginId)??[];a.push([ym,c]);x.set(c.installmentOriginId,a);}for(const t of m.deletedInstallmentOrigins??[]){const key=t.split(':')[0],a=x.get(key)??[];a.push([ym,t]);x.set(key,a);}}return x;};
 const ls=series(l),rs=series(r);for(const [k,v] of ls)if(rs.has(k)&&!eq(v.sort((a,b)=>canonical(a).localeCompare(canonical(b))),rs.get(k).sort((a,b)=>canonical(a).localeCompare(canonical(b)))))fail();
 if(out.months[l.selectedMonth])out.selectedMonth=l.selectedMonth;
 const raw=JSON.stringify(out);validatePayload(raw);return raw;
}
