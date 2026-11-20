// Experimental V35 commercial quota. No production collections.
export const COLLECTION='raytechLabCommercialV350';
export const validUid=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
export function planOf(uid,account,now){
 if(!validUid(uid)||!account||account.uid!==uid||account.blocked!==false||!['free','premium'].includes(account.plan))return null;
 if(account.plan==='premium'){
  if(!Number.isSafeInteger(account.premiumUntil)||account.premiumUntil<0)return null;
  if(account.premiumUntil>now)return 'premium';
 }
 return 'free';
}
export function monthOf(now){
 if(!Number.isSafeInteger(now)||now<0)throw Error('INVALID_TIME');
 const p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Bahia',year:'numeric',month:'2-digit'}).formatToParts(now);
 return p.find(x=>x.type==='year').value+'-'+p.find(x=>x.type==='month').value;
}
const count=x=>Number.isSafeInteger(x)&&x>=0;
export function view(state,now,plan){
 const s=state??{free:0,month:monthOf(now),premium:0,lastAt:0,older:0,newer:0,pending:null};
 if(!count(s.free)||s.free>2||!count(s.premium)||s.premium>15||!count(s.lastAt)||s.lastAt>now||!count(s.older)||!count(s.newer)||s.older>s.newer||s.newer>s.lastAt||!/^\d{4}-\d{2}$/.test(s.month)||s.month>monthOf(now)||!(s.pending===null||typeof s.pending==='string'))throw Error('INVALID_STATE');
 const month=monthOf(now),used=plan==='free'?s.free:s.month===month?s.premium:0;
 return {remaining:(plan==='free'?2:15)-used-(s.pending?1:0),busy:!!s.pending,month};
}
export function reserve(state,now,plan,id){
 const v=view(state,now,plan);
 if(v.busy)return {status:409,error:'ACTIVE_REQUEST'};
 if(v.remaining<=0)return {status:429,error:'QUOTA_EXCEEDED'};
 const s=state??{free:0,month:v.month,premium:0,lastAt:0,older:0,newer:0,pending:null};
 if(s.older!==0&&now-s.older<60000)return {status:429,error:'RATE_LIMIT'};
 return {status:200,next:{...s,month:v.month,premium:s.month===v.month?s.premium:0,lastAt:now,older:s.newer,newer:now,pending:id}};
}
export function finish(state,attempt,id,status,now){
 if(!attempt||!['completed','failed'].includes(status))throw Error('INVALID_OUTCOME');
 if(attempt.status===status)return null;
 if(attempt.status!=='pending'||state?.pending!==id)throw Error('OUTCOME_CONFLICT');
 view(state,now,attempt.plan);
 const next={...state,pending:null,lastAt:now};
 if(status==='completed'){
  if(attempt.plan==='free')next.free++;
  else if(state.month===attempt.month)next.premium++;
 }
 return next;
}
