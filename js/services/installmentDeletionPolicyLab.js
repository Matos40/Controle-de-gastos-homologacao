'use strict';
// Politica PROPOSTA: marcadores por mes de destino, por origem e numero.
// Sem storage, DOM, Firebase ou integracao com app real.
const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
const ym=/^\d{4}-(0[1-9]|1[0-2])$/;
class PolicyError extends Error{constructor(code){super(code);this.code=code;}}
const fail=code=>{throw new PolicyError(code);};
function marker(origin,number){
 if(typeof origin!=='string'||!origin.trim()||origin.includes(':')||origin.includes('/')||
 !Number.isSafeInteger(number)||number<1)fail('invalid_marker');
 return origin+':'+number;
}
function validateMarkers(markers){
 if(!Array.isArray(markers)||markers.some(x=>typeof x!=='string'||!/^[^:\/]+:[1-9]\d*$/.test(x))||
 new Set(markers).size!==markers.length)fail('invalid_markers');
 return markers;
}
function nextCandidate(card){
 if(!card||!card.isInstallment)return null;
 const total=card.installments,number=card.currentInstallment;
 if(!Number.isSafeInteger(total)||total<2||!Number.isSafeInteger(number)||number<1||number>total)
 fail('invalid_sequence');
 if(number===total)return null;
 const origin=card.installmentOriginId||card.id;
 if(!card.installmentOriginId)fail('ambiguous_legacy_origin');
 return {origin,number:number+1,total,title:card.title,value:card.installmentValue};
}
function plan(previous,targetMonth,markers=[],existing=[]){
 if(!ym.test(targetMonth))fail('invalid_month');
 validateMarkers(markers);
 if(!Array.isArray(previous)||!Array.isArray(existing))fail('invalid_collection');
 const decisions=[],seen=new Set();
 for(const card of previous){
  const candidate=nextCandidate(card);
  if(!candidate)continue;
  const key=marker(candidate.origin,candidate.number);
  if(seen.has(key))fail('duplicate_source');
  seen.add(key);
  const blocked=markers.includes(key);
  const matching=existing.filter(x=>x&&x.isInstallment&&
    x.installmentOriginId===candidate.origin&&x.currentInstallment===candidate.number);
  if(matching.length>1)fail('duplicate_target');
  decisions.push({key,action:blocked?'skip_deleted':matching.length?'skip_existing':'create',
   origin:candidate.origin,number:candidate.number});
 }
 return {targetMonth,decisions,created:decisions.filter(x=>x.action==='create').length};
}
module.exports={PolicyError,marker,validateMarkers,nextCandidate,plan};
