import {transition} from '../legacy/outcome.mjs';
import {monthOf} from './quota.mjs';

export const ADMIN_METRICS='raytechLabSmartAiMetricsV350';
const dayFormatter=new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Bahia',year:'numeric',month:'2-digit',day:'2-digit'});
export const dayOf=now=>dayFormatter.format(now);
const empty=()=>({reserved:0,completed:0,failed:0,pending:0});

export function metricRefs(db,at){
 const collection=db.collection(ADMIN_METRICS);
 return [collection.doc('day_'+dayOf(at)),collection.doc('month_'+monthOf(at))];
}

export function metricView(data){
 if(data===undefined)return {free:empty(),premium:empty(),users:0,conversions:0};
 for(const plan of ['free','premium']){
  const v=data?.[plan];
  if(!v||Object.keys(v).length!==4||!Object.keys(empty()).every(k=>Number.isSafeInteger(v[k])&&v[k]>=0)||
     v.reserved!==v.completed+v.failed+v.pending)throw Error('INVALID_METRICS');
 }
 for(const key of ['users','conversions'])if(!Number.isSafeInteger(data[key])||data[key]<0)throw Error('INVALID_METRICS');
 if(data.conversions>data.users||data.users>data.free.reserved+data.premium.reserved)throw Error('INVALID_METRICS');
 return data;
}

export async function prepareMetrics(tx,db,at,plan,event,{newUser=false,conversion=false}={}){
 if(!['free','premium'].includes(plan))throw Error('INVALID_METRICS_PLAN');
 const refs=metricRefs(db,at);
 const rows=await tx.getAll(...refs);
 return refs.map((ref,index)=>{
  const previous=metricView(rows[index].data());
  const value={...previous,[plan]:transition(previous[plan],event)};
  if(index===1){
   value.users+=Number(newUser);
   value.conversions+=Number(conversion);
  }
  metricView(value);
  return {ref,value};
 });
}
