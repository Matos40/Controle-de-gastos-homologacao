import {USAGE_COLLECTION,validRequestId} from './usage.mjs';
export const OUTCOME_COLLECTION='raytechLabOutcomeV3472';
const uidOk=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);
const valid=x=>Number.isSafeInteger(x)&&x>=0;
export const empty=()=>({reserved:0,completed:0,failed:0,pending:0});
export function transition(previous,kind){
 const p=previous===undefined?empty():previous;
 if(!p||Object.keys(p).length!==4||!Object.keys(empty()).every(k=>valid(p[k]))||p.reserved!==p.completed+p.failed+p.pending)throw Error('INVALID_OUTCOME');
 const n={...p};
 if(kind==='reserve'){n.reserved++;n.pending++;}
 else if(['completed','failed'].includes(kind)&&n.pending>0){n.pending--;n[kind]++;}
 else throw Error('INVALID_TRANSITION');
 if(!Object.values(n).every(valid))throw Error('OUTCOME_OVERFLOW');return n;
}
export const outcomeRefs=(db,uid,at)=>{const iso=new Date(at).toISOString();return ['global','user_'+uid].flatMap(scope=>[['day',iso.slice(0,10)],['month',iso.slice(0,7)]].map(([kind,period])=>db.collection(OUTCOME_COLLECTION).doc(scope+'_'+kind+'_'+period)));};
export function createOutcomeStore(db){
 return async({uid,requestId,status})=>{
 if(!uidOk(uid)||!validRequestId(requestId)||!['completed','failed'].includes(status))throw Error('INVALID_OUTCOME');
 return db.runTransaction(async tx=>{
 const ref=db.collection(USAGE_COLLECTION).doc(uid).collection('attempts').doc(requestId),snap=await tx.get(ref),a=snap.data();
 if(!a||!valid(a.reservedAt))throw Error('MISSING_ATTEMPT');
 if(a.status===status)return;
 if(a.status!=='pending')throw Error('OUTCOME_CONFLICT');
 const refs=outcomeRefs(db,uid,a.reservedAt),docs=await tx.getAll(...refs);
 const next=docs.map(x=>transition(x.data(),status));
 refs.forEach((r,i)=>tx.set(r,next[i]));tx.update(ref,{status,finishedAt:Date.now()});
 });
 };
}
export async function readOutcome(tx,db,uid,now){
 const refs=outcomeRefs(db,uid,now),docs=await tx.getAll(...refs);
 const validate=s=>{const d=s.data();if(d===undefined)return empty();transition(d,'reserve');return d;};
 return {global:{day:validate(docs[0]),month:validate(docs[1])},user:{day:validate(docs[2]),month:validate(docs[3])}};
}
