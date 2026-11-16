import {canonical} from './model.mjs';
const own=(x,k)=>Object.hasOwn(x,k);
const validId=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,512}$/.test(x);
const absent=x=>x===undefined||x===null||x==='';
const monthIndex=m=>/^20\d{2}-(0[1-9]|1[0-2])$/.test(m)?Number(m.slice(0,4))*12+Number(m.slice(5))-1:NaN;
const monthName=n=>String(Math.floor(n/12)).padStart(4,'0')+'-'+String(n%12+1).padStart(2,'0');
const same=(a,b)=>canonical(a)===canonical(b);
const money=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&Math.abs(x*100-Math.round(x*100))<0.0001;
const numericBoolean=x=>x===undefined||x===null||x===0||x===1;
export function normalizeCardState(x,add){
 // V1 display, filtering, payment totals and toggle all use truthiness.
 if(typeof x.paid!=='boolean'&&numericBoolean(x.paid)){x.paid=Boolean(x.paid);add('CARD_PAID_NORMALIZED');}
 // V1 treats an absent/falsy flag as single purchase; never infer a different classification.
 if(typeof x.isInstallment!=='boolean'&&numericBoolean(x.isInstallment)){
  const value=Boolean(x.isInstallment);
  if(value?Number.isInteger(x.installments)&&x.installments>=2:x.installments===1&&x.currentInstallment===1){x.isInstallment=value;add('CARD_INSTALLMENT_NORMALIZED');}
 }
 if(x.isInstallment===false&&own(x,'installmentOriginId')&&x.installmentOriginId===''){x.installmentOriginId=null;add('EMPTY_ORIGIN_NORMALIZED');}
}
// Build candidates independent of object/array insertion order. Do not synthesize later-only roots.
export function reconstructOrigins(db,cards,add){
 const groups=new Map(),coarseGroups=new Map(),allIds=new Map(),anchors=new Map(),tombs=new Map();
 for(const [month,m] of Object.entries(db.months)){
  if(!Array.isArray(m?.deletedInstallmentOrigins))continue;
  for(const t of m.deletedInstallmentOrigins){if(typeof t!=='string')continue;const i=t.lastIndexOf(':');if(i<0)continue;const root=t.slice(0,i),list=tombs.get(root)??[];list.push({month,n:Number(t.slice(i+1))});tombs.set(root,list);}
 }
 for(const {month,x} of cards){
  if(validId(x.id))allIds.set(x.id,(allIds.get(x.id)??0)+1);
  const time=monthIndex(month);
  if(!Number.isFinite(time)||typeof x.title!=='string'||!x.title.trim()||!validId(x.id)||!Number.isInteger(x.installments)||x.installments<2||x.installments>120||!Number.isInteger(x.currentInstallment)||x.currentInstallment<1||x.currentInstallment>x.installments||!money(x.installmentValue)||!money(x.totalAmount))continue;
  const start=time-x.currentInstallment+1,coarse=canonical([x.title.trim().toLowerCase(),x.installments,start]);
  const key=canonical([coarse,x.category,x.installmentValue,x.totalAmount]);
  const arr=groups.get(key)??[];arr.push({month,x,start});groups.set(key,arr);
  const set=coarseGroups.get(coarse)??new Set();set.add(key);coarseGroups.set(coarse,set);
  if(validId(x.installmentOriginId)){const set=anchors.get(x.installmentOriginId)??new Set();set.add(key);anchors.set(x.installmentOriginId,set);}
 }
 for(const [key,group] of groups){
  const pending=group.filter(({x})=>absent(x.installmentOriginId));if(!pending.length)continue;
  const first=group[0],{start}=first,coarse=canonical([first.x.title.trim().toLowerCase(),first.x.installments,start]);
  const incompatible=()=>add('ORIGIN_AMBIGUOUS_GROUP');
  if(coarseGroups.get(coarse).size!==1||new Set(group.map(({x})=>x.currentInstallment)).size!==group.length||group.some(({x})=>allIds.get(x.id)!==1||(!absent(x.installmentOriginId)&&!validId(x.installmentOriginId)))){incompatible();continue;}
  const explicit=[...new Set(group.map(({x})=>x.installmentOriginId).filter(validId))];
  const firstEntry=group.find(({x})=>x.currentInstallment===1);
  if(explicit.length>1||(!firstEntry&&!explicit.length)){incompatible();continue;}
  const root=explicit[0]??firstEntry.x.id;
  if(firstEntry&&absent(firstEntry.x.installmentOriginId)&&root!==firstEntry.x.id){incompatible();continue;}
  if((anchors.get(root)?.size??0)>1||(allIds.has(root)&&!group.some(({x})=>x.id===root))){incompatible();continue;}
  // Any deletion keyed by an intermediate record rather than the proposed origin
  // is ambiguous. Preserve it exactly and block rather than silently re-key it.
  if(group.some(({x})=>x.id!==root&&tombs.has(x.id))){add('ORIGIN_DELETION_ALIAS');continue;}
  const deleted=tombs.get(root)??[];
  if(deleted.some(t=>group.some(({month,x})=>month===t.month&&x.currentInstallment===t.n))){add('ORIGIN_DELETION_COLLISION');continue;}
  const steps=group.map(({x})=>x.currentInstallment),min=Math.min(...steps),max=Math.max(...steps);
  let gap=false;for(let n=min;n<=max;n++)if(!steps.includes(n)&&!deleted.some(t=>t.n===n&&t.month===monthName(start+n-1)))gap=true;
  if(gap){add('ORIGIN_UNEXPLAINED_GAP');continue;}
  // A separate projected series with the same title/count whose schedule overlaps
  // is a possible V1 skipped-month inheritance or separate purchase. Do not guess.
  const overlap=[...groups.entries()].some(([other,items])=>other!==key&&items.some(({x,start:s})=>x.title.trim().toLowerCase()===first.x.title.trim().toLowerCase()&&x.installments===first.x.installments&&s<=start+first.x.installments-1&&start<=s+x.installments-1));
  if(overlap){incompatible();continue;}
  for(const {x} of pending){x.installmentOriginId=root;add('ORIGIN_RECOVERED');}
 }
}
const MONTH_DEFAULTS={deletedInstallmentOrigins:[],closed:false,closedAt:null,budgetLimit:0,extraIncomes:[]};
// Equality is stronger than aggregate totals alone: all existing values and record
// ordering must survive, except the explicitly enumerated equivalent metadata.
export function auditEquivalence(before,after){
 const fail=()=>({equivalent:false});
 try{
  if(!same(Object.keys(before).sort(),Object.keys(after).sort())||before.selectedMonth!==after.selectedMonth||!same(Object.keys(before.months).sort(),Object.keys(after.months).sort()))return fail();
  let entries=0,months=0;
  for(const [ym,a] of Object.entries(before.months)){
   const b=after.months[ym];months++;
   for(const k of Object.keys(b))if(!own(a,k)&&(!own(MONTH_DEFAULTS,k)||!same(b[k],MONTH_DEFAULTS[k])))return fail();
   for(const k of Object.keys(a))if(!['expenses','cardExpenses','extraIncomes'].includes(k)&&!same(a[k],b[k]))return fail();
   for(const k of ['expenses','cardExpenses','extraIncomes']){
    const old=a[k]??[],next=b[k];if(!Array.isArray(old)||!Array.isArray(next)||old.length!==next.length)return fail();
    let oldCents=0n,newCents=0n,oldPaid=0n,newPaid=0n;
    for(let i=0;i<old.length;i++){
     const x=old[i],y=next[i];entries++;
     for(const key of Object.keys(x)){
      if(k==='cardExpenses'&&['paid','isInstallment'].includes(key)&&typeof x[key]!=='boolean'&&numericBoolean(x[key])){if(y[key]!==Boolean(x[key]))return fail();continue;}
      if(k==='cardExpenses'&&key==='installmentOriginId'&&absent(x[key])){if(y.isInstallment===true?!validId(y[key]):y[key]!==null&&!absent(y[key]))return fail();continue;}
      if(!same(x[key],y[key]))return fail();
     }
     for(const key of Object.keys(y)){
      if(own(x,key))continue;
      if(key==='category'&&k!=='extraIncomes')continue;
      if(k==='cardExpenses'&&key==='installmentOriginId'&&y.isInstallment===true&&validId(y[key]))continue;
      if(k==='cardExpenses'&&['paid','isInstallment'].includes(key)&&y[key]===false)continue;
      return fail();
     }
     const field=k==='cardExpenses'?'installmentValue':'amount';
     if(!money(x[field])||!money(y[field])||x[field]!==y[field])return fail();
     const v=BigInt(Math.round(x[field]*100)),w=BigInt(Math.round(y[field]*100));oldCents+=v;newCents+=w;
     if(Boolean(x.paid))oldPaid+=v;if(Boolean(y.paid))newPaid+=w;
     if(k==='cardExpenses'&&(!same(x.totalAmount,y.totalAmount)||Boolean(x.isInstallment)!==Boolean(y.isInstallment)))return fail();
    }
    if(oldCents!==newCents||oldPaid!==newPaid)return fail();
   }
  }
  return {equivalent:true,months,entries};
 }catch{return fail();}
}
