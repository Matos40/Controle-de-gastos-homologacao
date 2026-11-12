'use strict';
// Observabilidade exclusivamente local. Nunca registrar headers, body, token, UID ou IP.
const crypto=require('node:crypto');
const ACTIONS=new Set(['initialize','submit','audit','unknown']);
const OUTCOMES=new Set(['success','client_error','auth_error','throttled','busy','server_error']);
function createHttpTelemetryLab({sink=()=>{},now=Date.now}={}){
 if(typeof sink!=='function'||typeof now!=='function')throw Error('Telemetria invalida');
 const counters=new Map();
 function record({action='unknown',status,durationMs=0}={}){
  const safeAction=ACTIONS.has(action)?action:'unknown';
  const safeStatus=Number.isInteger(status)&&status>=100&&status<=599?status:500;
  const safeDuration=Number.isFinite(durationMs)?Math.max(0,Math.min(3600000,Math.round(durationMs))):0;
  const outcome=safeStatus===429?'throttled':safeStatus===503?'busy':
   safeStatus===401||safeStatus===403?'auth_error':
   safeStatus>=500?'server_error':safeStatus>=400?'client_error':'success';
  const event=Object.freeze({event:'http_request',action:safeAction,status:safeStatus,
   outcome,durationMs:safeDuration});
  const k=safeAction+':'+safeStatus;
  counters.set(k,(counters.get(k)||0)+1);
  try{sink(event);}catch{/* Falha de monitoramento nao interfere nas operacoes. */}
  return event;
 }
 return {record,snapshot(){
  return Object.freeze(Array.from(counters,([key,count])=>Object.freeze({key,count})));
 }};
}
module.exports={createHttpTelemetryLab};
