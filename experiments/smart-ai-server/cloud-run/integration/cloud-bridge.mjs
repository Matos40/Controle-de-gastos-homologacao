import {createFirebaseVerifier} from '../../remote/auth.mjs';
import {FIREBASE_PROJECT} from '../projects.mjs';
import {requestIdentity} from '../gateway.mjs';
import {createBridge} from './bridge.mjs';

// Runs only in a trusted host. The gateway URL is deployment configuration.
export function cloudBridge({origin,gatewayUrl,getAccessToken,transport=fetch}){
 const gateway=new URL(gatewayUrl);
 if(gateway.protocol!=='https:'||!gateway.hostname.endsWith('.run.app')||gateway.port||
  gateway.username||gateway.password||gateway.pathname!=='/'||gateway.search||gateway.hash)throw Error('INVALID_GATEWAY');
 const verify=createFirebaseVerifier(FIREBASE_PROJECT);
 return createBridge({origin,
  verifyFirebase:(token,signal)=>verify(token,getAccessToken,transport,signal),
  async invoke(path,options){
   const signal=AbortSignal.any([options.signal,AbortSignal.timeout(30000)]);
   const token=await requestIdentity(gateway.origin,transport,signal);
   options.headers.set('x-serverless-authorization','Bearer '+token);
   return transport(gateway.origin+path,{...options,signal,redirect:'manual',...(options.body?{duplex:'half'}:{})});
  },
 });
}
