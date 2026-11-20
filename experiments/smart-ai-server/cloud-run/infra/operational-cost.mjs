import {pathToFileURL} from 'node:url';
import {estimate,scenarios} from './cost.mjs';

export function operationalCost(input,{extraSecondsPerRequest=0.5,blockedRequests=0,logMiB=1}={}){
 const backend=estimate(input);
 const requests=backend.admitted+input.controlRequests;
 const gatewaySeconds=backend.seconds+requests*extraSecondsPerRequest+blockedRequests*0.2;
 const gateway=gatewaySeconds*(0.000024+0.5*0.0000025)+(requests+blockedRequests)*0.4/1e6;
 const directVpcSensitivity=backend.admitted*input.egressMiB/1024*0.01;
 const loggingGross=logMiB/1024*0.5;
 return {backend:backend.subtotal,gateway,directVpcSensitivity,loggingGross,
  total:backend.subtotal+gateway+directVpcSensitivity+loggingGross};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 for(const [caseName,premises] of Object.entries(scenarios)){
  const typical=caseName==='typical';
  console.log(JSON.stringify({caseName,...operationalCost(premises,{
   blockedRequests:typical?20:100,logMiB:typical?1:4,
  })}));
 }
}
