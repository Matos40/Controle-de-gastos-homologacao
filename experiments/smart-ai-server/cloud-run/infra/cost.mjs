import {pathToFileURL} from 'node:url';

const price={
 cpu:0.000024,memory:0.0000025,request:0.4/1e6,
 input:0.25/1e6,output:1.50/1e6,
 transfer:0.19,secretVersion:0.06,secretAccess:0.03/10000,artifactGiBMonth:0.10,
};

export function estimate({newFree,premium,filesPerPremium,failedDemand,secondsPerAttempt,
 inputTokens,outputIncludingThinking,egressMiB,reads,writes,coldStarts,controlRequests,controlSeconds}){
 const requested=2*newFree+premium*filesPerPremium+failedDemand;
 const admitted=Math.min(60,requested);
 const seconds=admitted*secondsPerAttempt+controlRequests*controlSeconds;
 const cloudRun=seconds*(price.cpu+0.5*price.memory)+(admitted+controlRequests)*price.request;
 const gemini=admitted*(inputTokens*price.input+outputIncludingThinking*price.output);
 const network=admitted*egressMiB/1024*price.transfer;
 const secret=price.secretVersion+coldStarts*price.secretAccess;
 const registry=0.2*price.artifactGiBMonth;
 return {requested,admitted,seconds,estimatedFirestoreReads:admitted*reads,
  estimatedFirestoreWrites:admitted*writes,cloudRun,gemini,network,secret,registry,
  subtotal:cloudRun+gemini+network+secret+registry};
}

export const scenarios={
 typical:{newFree:8,premium:8,filesPerPremium:3,failedDemand:4,secondsPerAttempt:8,
  inputTokens:1200,outputIncludingThinking:300,egressMiB:0.5,reads:30,writes:20,
  coldStarts:10,controlRequests:100,controlSeconds:0.4},
 maximum:{newFree:8,premium:8,filesPerPremium:15,failedDemand:14,secondsPerAttempt:30,
  inputTokens:3000,outputIncludingThinking:1200,egressMiB:13.4,reads:60,writes:20,
  coldStarts:60,controlRequests:200,controlSeconds:1},
};

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 for(const [name,input] of Object.entries(scenarios))console.log(JSON.stringify({name,...estimate(input)}));
}
