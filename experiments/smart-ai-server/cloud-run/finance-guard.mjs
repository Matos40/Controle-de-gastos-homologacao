import {COMMERCIAL_GLOBAL} from './store.mjs';

export const BUDGET_CENTS=1000;
const thresholds=[250,500,750,1000];
const calendar=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',
 year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
const parts=at=>Object.fromEntries(calendar.formatToParts(at).map(({type,value})=>[type,value]));
const iso=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?Z$/.test(value)?Date.parse(value):NaN;
export const financeRef=db=>db.collection(COMMERCIAL_GLOBAL).doc('financeGuard');
export function financeState(data){
 if(data===undefined)return {version:0,suspended:false,alerts:[]};
 if(!Number.isSafeInteger(data?.version)||data.version<1||typeof data.suspended!=='boolean'||
    !Array.isArray(data.alerts)||data.alerts.length>24||!/^\d{4}-\d{2}$/.test(data.period??'')||
    !Number.isSafeInteger(data.publishedAt)||!Number.isSafeInteger(data.observedCents)||data.observedCents<0||
    !Number.isSafeInteger(data.highCents)||data.highCents<data.observedCents)throw Error('INVALID_FINANCE_STATE');
 return data;
}
export function financeView(state,now){
 const today=parts(now),current=state.period===today.year+'-'+today.month;
 return {version:state.version,suspended:state.suspended,reason:state.suspended?'BUDGET_THRESHOLD':null,
  budgetCents:BUDGET_CENTS,observedCents:current?state.observedCents:null,
  updatedAt:current?state.publishedAt:null,alerts:state.alerts};
}
export function parseBudgetPush(envelope,config,now){
 const msg=envelope?.message,attrs=msg?.attributes;
 if(!config?.budgetId||!config.billingAccount||!config.subscription||
    envelope?.subscription!==config.subscription||attrs?.budgetId!==config.budgetId||
    attrs.billingAccountId!==config.billingAccount||attrs.schemaVersion!=='1.0'||
    typeof msg.messageId!=='string'||!/^[0-9]{1,32}$/.test(msg.messageId)||
    typeof msg.data!=='string'||msg.data.length>8192||! /^[A-Za-z0-9+/]+={0,2}$/.test(msg.data))throw Error('INVALID_BUDGET_EVENT');
 const payload=JSON.parse(Buffer.from(msg.data,'base64').toString('utf8'));
 const publishedAt=iso(msg.publishTime),start=iso(payload.costIntervalStart);
 if(!Number.isFinite(start)||!Number.isFinite(publishedAt)||start>publishedAt||publishedAt>now+60000||
    start%1000!==0||payload.currencyCode!=='BRL'||payload.budgetAmount!==10||
    payload.budgetAmountType!=='SPECIFIED_AMOUNT'||!Number.isFinite(payload.costAmount)||
    Math.abs(payload.costAmount)>1e9)throw Error('INVALID_BUDGET_EVENT');
 const period=parts(start),today=parts(now);
 if(period.day!=='01'||period.hour!=='00'||period.minute!=='00'||period.second!=='00')throw Error('INVALID_BUDGET_PERIOD');
 const key=period.year+'-'+period.month,current=today.year+'-'+today.month;
 if(key>current)throw Error('INVALID_BUDGET_PERIOD');
 return {period:key,current:key===current,publishedAt,observedCents:Math.max(0,Math.floor(payload.costAmount*100+1e-7)),id:msg.messageId};
}
export async function recordBudgetPush(db,event){
 if(!event.current)return false;
 return db.runTransaction(async tx=>{
  const ref=financeRef(db),[snapshot]=await tx.getAll(ref),before=financeState(snapshot.data());
  const same=event.period===before.period;
  if((before.period&&event.period<before.period)||
     (same&&(event.publishedAt<before.publishedAt||before.eventId===event.id||
      (event.publishedAt===before.publishedAt&&event.observedCents<=(before.observedCents??0)))))return false;
  const previousHigh=same?before.highCents:0;
  const highCents=Math.max(previousHigh,event.observedCents);
  const alerts=thresholds.filter(cents=>previousHigh<cents&&highCents>=cents)
   .map(cents=>({threshold:cents/10,period:event.period,at:event.publishedAt}));
  const suspended=before.suspended||(highCents>=750&&highCents>previousHigh);
  tx.set(ref,{...before,period:event.period,observedCents:event.observedCents,highCents,
   publishedAt:event.publishedAt,eventId:event.id,version:before.version+1,suspended,
   alerts:[...before.alerts,...alerts].slice(-24)});
  return true;
 });
}
