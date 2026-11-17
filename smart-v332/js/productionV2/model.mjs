/* Adapted from homologation 4a01326. Production candidate, strict fail-closed compatibility boundary. */
export function blank(ym){return {selectedMonth:ym,months:{[ym]:{salary:0,budgetLimit:0,extraIncomes:[],expenses:[],cardExpenses:[],deletedInstallmentOrigins:[],closed:false,closedAt:null}}};}
export const LEGACY_LIMITS=Object.freeze({payload:180000,months:24,entries:200,id:512,title:512,tombstones:500,installments:120});
const obj=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
const shape=(x,allowed,required=allowed)=>obj(x)&&Object.keys(x).every(k=>allowed.includes(k))&&required.every(k=>Object.hasOwn(x,k));
const ym=x=>typeof x==='string'&&/^20[0-9]{2}-(0[1-9]|1[0-2])$/.test(x);
const date=x=>typeof x==='string'&&/^20[0-9]{2}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/.test(x);
const validCalendar=x=>date(x)&&new Date(x+'T00:00:00Z').toISOString().slice(0,10)===x;
const money=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=10000000&&Math.abs(x*100-Math.round(x*100))<0.0001;
const id=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,512}$/.test(x);
const name=x=>typeof x==='string'&&x.length<=512&&x.trim().length>0&&!/[\x00-\x1f<>]/.test(x);
const cat=x=>['moradia','alimentacao','transporte','compras','lazer','saude','investimentos','outros'].includes(x);
const eqMoney=(a,b)=>money(a)&&money(b)&&Math.abs(a-b)<0.000001;
export function inspectPayload(payload){
 const issues=new Map(),warnings=new Map(),add=(m,k)=>m.set(k,(m.get(k)||0)+1),bad=k=>add(issues,k),warn=k=>add(warnings,k);
 const result=()=>({issues:[...issues].map(([code,count])=>({code,count})),warnings:[...warnings].map(([code,count])=>({code,count}))});
 if(typeof payload!=='string'){bad('DB_ABSENT');return result();}
 if(payload.length>LEGACY_LIMITS.payload){bad('PAYLOAD_LIMIT');return result();}
 let d;try{d=JSON.parse(payload);}catch{bad('INVALID_JSON');return result();}
 if(!shape(d,['selectedMonth','months'])||!obj(d.months)){bad('ROOT_SCHEMA');return result();}
 if(!ym(d.selectedMonth)||!Object.hasOwn(d.months,d.selectedMonth))bad('SELECTED_MONTH');
 if(Object.keys(d.months).length>LEGACY_LIMITS.months)bad('MONTH_LIMIT');
 for(const [month,m] of Object.entries(d.months)){
  if(!ym(month)){bad('MONTH_FORMAT');continue;}
  if(!shape(m,['salary','budgetLimit','extraIncomes','expenses','cardExpenses','deletedInstallmentOrigins','closed','closedAt'],['salary','budgetLimit','extraIncomes','expenses','cardExpenses','closed','closedAt'])){bad('MONTH_SCHEMA');continue;}
  if(!money(m.salary)||!money(m.budgetLimit))bad('MONTH_MONEY');
  if(typeof m.closed!=='boolean'||!(m.closedAt===null||typeof m.closedAt==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(m.closedAt)))bad('MONTH_CLOSED');
  const origins=new Set();
  for(const k of ['expenses','cardExpenses','extraIncomes']){
   if(!Array.isArray(m[k])){bad('ENTRY_ARRAY');continue;}
   if(m[k].length>LEGACY_LIMITS.entries)bad('ENTRY_LIMIT');
   const seen=new Set();
   for(const x of m[k]){
    if(!obj(x)){bad('ENTRY_SCHEMA');continue;}
    if(!id(x.id))bad('ENTRY_ID');else if(seen.has(x.id))bad('DUPLICATE_ID');else seen.add(x.id);
    if(!date(x.date))bad('DATE_FORMAT');else if(!validCalendar(x.date))warn('LEGACY_CALENDAR_DAY');
    if(k==='expenses'){
     if(!shape(x,['id','title','category','amount','type','date','paid']))bad('EXPENSE_SCHEMA');
     if(!name(x.title))bad('TEXT_FORMAT');if(!cat(x.category))bad('CATEGORY');if(!money(x.amount))bad('ENTRY_MONEY');if(!['fixed','one-time'].includes(x.type)||typeof x.paid!=='boolean')bad('EXPENSE_STATE');
    }else if(k==='extraIncomes'){
     if(!shape(x,['id','description','amount','date']))bad('INCOME_SCHEMA');
     if(!name(x.description))bad('TEXT_FORMAT');if(!money(x.amount))bad('ENTRY_MONEY');
    }else{
     const required=['id','title','category','isInstallment','installmentValue','totalAmount','installments','currentInstallment','date','paid'];
     if(!shape(x,[...required,'installmentOriginId'],required)){
      bad('CARD_SCHEMA');for(const field of required)if(!Object.hasOwn(x,field))bad('CARD_MISSING_'+field.toUpperCase());
      if(Object.keys(x).some(key=>!required.includes(key)&&key!=='installmentOriginId'))bad('CARD_UNKNOWN_FIELDS');
     }
     if(!name(x.title))bad('TEXT_FORMAT');if(!cat(x.category))bad('CATEGORY');if(typeof x.paid!=='boolean'||typeof x.isInstallment!=='boolean'){bad('CARD_STATE');if(typeof x.paid!=='boolean')bad('CARD_PAID_TYPE');if(typeof x.isInstallment!=='boolean')bad('CARD_INSTALLMENT_TYPE');}
     if(!money(x.installmentValue)||!money(x.totalAmount))bad('ENTRY_MONEY');
     if(!Number.isInteger(x.installments)||!Number.isInteger(x.currentInstallment)||x.installments<1||x.installments>LEGACY_LIMITS.installments||x.currentInstallment<1||x.currentInstallment>x.installments||(!x.isInstallment&&(x.installments!==1||x.currentInstallment!==1))||(x.isInstallment&&x.installments<2))bad('INSTALLMENT_NUMBER');
     if(x.isInstallment){
      if(!id(x.installmentOriginId))bad('INSTALLMENT_ORIGIN');
      else{const key=x.installmentOriginId+':'+x.currentInstallment;if(origins.has(key))bad('DUPLICATE_INSTALLMENT');origins.add(key);}
     }else if(Object.hasOwn(x,'installmentOriginId')&&x.installmentOriginId!==null&&!id(x.installmentOriginId))bad('INSTALLMENT_ORIGIN');
     if(money(x.installmentValue)&&money(x.totalAmount)&&Number.isInteger(x.installments)&&Math.abs(x.totalAmount-x.installmentValue*x.installments)>0.011){
      // Historical generic Excel importer stored totalAmount equal to installmentValue.
      // Keep the exact values; never derive or correct monetary fields.
      if(x.isInstallment===true&&x.installments>=2&&eqMoney(x.totalAmount,x.installmentValue))warn('LEGACY_CARD_TOTAL');else bad('CARD_TOTAL');
     }
    }
   }
  }
  const tomb=m.deletedInstallmentOrigins??[];
  if(!Array.isArray(tomb)||tomb.length>LEGACY_LIMITS.tombstones||new Set(tomb).size!==tomb.length||!tomb.every(x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,512}:[1-9][0-9]{0,2}$/.test(x)))bad('DELETION_MARKS');
  else if(tomb.some(x=>origins.has(x)))bad('DELETED_INSTALLMENT_PRESENT');
 }
 return result();
}
export function validatePayload(payload){
 const inspection=inspectPayload(payload);if(inspection.issues.length)throw Error('PRODUCTION_CONTRACT: '+inspection.issues.map(x=>x.code).join(','));
 return JSON.parse(payload);
}
export function validId(x){return typeof x==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(x);}
export function canonical(x){if(x===null||typeof x!=="object")return JSON.stringify(x);if(Array.isArray(x))return "["+x.map(canonical).join(",")+"]";return "{"+Object.keys(x).sort().map(k=>JSON.stringify(k)+":"+canonical(x[k])).join(",")+"}";}
export function mergeThreeWay(basePayload,localPayload,remotePayload,review=null){
 const b=validatePayload(basePayload),l=validatePayload(localPayload),r=validatePayload(remotePayload),out=JSON.parse(remotePayload),conflicts=[];
 const eq=(a,b)=>canonical(a??null)===canonical(b??null),keys=x=>Object.keys(x).sort(),fail=path=>conflicts.push(path);
 const choose=(a,x,y,path)=>{if(eq(x,a))return y;if(eq(y,a)||eq(x,y))return x;if(review){review.fields.push({path,before:a??null,local:x??null,target:y??null});const v=Object.hasOwn(review.choices,path)?review.choices[path]:null;if(v==='local')return x;if(v==='target')return y;}fail(path);return y;};
 if(!eq(keys(b.months),keys(l.months))||!eq(keys(b.months),keys(r.months)))return {payload:null,conflicts:["Estrutura de meses mudou"]};
 const groups=db=>{const map=new Map();for(const [ym,m] of Object.entries(db.months)){for(const c of m.cardExpenses){if(!c.isInstallment)continue;const k=c.installmentOriginId,arr=map.get(k)??[];arr.push([ym,c]);map.set(k,arr);}for(const t of m.deletedInstallmentOrigins??[]){const k=t.split(":")[0],arr=map.get(k)??[];arr.push([ym,t]);map.set(k,arr);}}for(const arr of map.values())arr.sort((x,y)=>canonical(x).localeCompare(canonical(y)));return map;};
 const [gb,gl,gr]=[b,l,r].map(groups);for(const k of new Set([...gb.keys(),...gl.keys(),...gr.keys()])){const a=gb.get(k)??[],x=gl.get(k)??[],y=gr.get(k)??[];if(!eq(a,x)&&!eq(a,y)&&!eq(x,y))fail("Série de parcelas "+k);}
 for(const ym of keys(b.months)){
  const a=b.months[ym],x=l.months[ym],y=r.months[ym],m=out.months[ym];
  if(a.closed!==x.closed||a.closed!==y.closed||a.closedAt!==x.closedAt||a.closedAt!==y.closedAt){fail(ym+" · fechamento de mês");continue;}
  if(a.closed&&(!eq(a,x)||!eq(a,y))){fail(ym+" · mês fechado");continue;}
  for(const k of ["salary","budgetLimit"])m[k]=choose(a[k],x[k],y[k],ym+" · "+k);
  const ta=new Set(a.deletedInstallmentOrigins??[]),tl=new Set(x.deletedInstallmentOrigins??[]),tr=new Set(y.deletedInstallmentOrigins??[]);
  if([...ta].some(t=>!tl.has(t)||!tr.has(t)))fail(ym+" · remoção de marca de exclusão");
  const tomb=new Set([...tr,...tl]);if(tomb.size||Object.hasOwn(m,"deletedInstallmentOrigins"))m.deletedInstallmentOrigins=[...tomb];
  for(const k of ["expenses","cardExpenses","extraIncomes"]){
   const [aa,xx,yy]=[a,x,y].map(m=>new Map(m[k].map(i=>[i.id,i])));m[k]=[];
   for(const id of new Set([...yy.keys(),...xx.keys(),...aa.keys()])){
    const av=aa.get(id),lv=xx.get(id),rv=yy.get(id);
    if(!av&&/^(exp_sync_|exp_inherited_|card_sync_|card_inherited_)/.test(id))fail(ym+" · lançamento herdado "+id);
    const v=choose(av,lv,rv,ym+" · "+k+" · "+id);if(v!==undefined)m[k].push(v);
    if(k==="cardExpenses"&&av?.isInstallment&&!v&&!tomb.has(av.installmentOriginId+":"+av.currentInstallment))fail(ym+" · exclusão de parcela sem marca "+id);
   }
  }
  const origins=new Set();for(const c of m.cardExpenses){if(!c.isInstallment)continue;const k=c.installmentOriginId+":"+c.currentInstallment;if(origins.has(k)||tomb.has(k))fail(ym+" · parcela duplicada ou excluída "+k);origins.add(k);}
 }
 if(conflicts.length)return {payload:null,conflicts:[...new Set(conflicts)]};
 const payload=JSON.stringify(out);try{validatePayload(payload);}catch{return {payload:null,conflicts:["Limites ou integridade financeira incompatíveis"]};}
 return {payload,conflicts:[]};
}

 // Recovery-only individual decisions. Structural and installment invariants remain fail-closed.
export function reviewApplyFields(before,local,target,choices={}){
 const fields=[],result=mergeThreeWay(before,local,target,{fields,choices});
 if(Object.keys(choices).some(k=>!fields.some(f=>f.path===k)))throw Error('PRODUCTION_RECOVERY_CHOICE');
 return {...result,fields,blocked:result.conflicts.filter(p=>!fields.some(f=>f.path===p))};
}
