import {performance} from 'node:perf_hooks';
const countedKeys=['subrequests','requestedFirestoreReads','confirmedFirestoreWrites','firestoreQueries',
 'inputTokens','outputTokens','totalTokens','thinkingTokens','latencyMs'];

export function startObservation(route,write){
 const start=performance.now(),cpuStarted=process.cpuUsage();
 return (httpStatus,counts={})=>{
  const cpu=process.cpuUsage(cpuStarted);
  const event={event:'smart_ai_request',route,httpStatus,
   durationMs:Math.round(performance.now()-start),
   processCpuMicros:cpu.user+cpu.system,rssBytes:process.memoryUsage().rss};
  for(const key of countedKeys)if(Number.isSafeInteger(counts[key])&&counts[key]>=0)event[key]=counts[key];
  try{write(event);}catch{/* Telemetry never changes the HTTP result or quota settlement. */}
 };
}
