import {RUNTIME_IDENTITY} from './projects.mjs';
const metadata='http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/';

export function createRuntimeAccess(expectedIdentity){
 if(expectedIdentity!==RUNTIME_IDENTITY)throw Error('INVALID_RUNTIME_IDENTITY');
 return createMetadataAccess(expectedIdentity);
}

export function createMetadataAccess(expectedIdentity){
 let checked=false,cached;
 return async(transport,signal)=>{
  const now=Math.floor(Date.now()/1000);
  if(cached?.expiresAt>now+60)return cached.token;
  async function get(path){
   const response=await transport(metadata+path,{headers:{'Metadata-Flavor':'Google'},redirect:'manual',signal});
   if(!response.ok||response.headers.get('metadata-flavor')!=='Google')throw Error('METADATA_UNAVAILABLE');
   return response;
  }
  if(!checked){
   if((await (await get('email')).text()).trim()!==expectedIdentity)throw Error('WRONG_RUNTIME_IDENTITY');
   checked=true;
  }
  const {access_token:token,expires_in:expires,token_type:type}=await (await get('token')).json();
  if(typeof token!=='string'||token.length<16||!Number.isSafeInteger(expires)||expires<1||
     type?.toLowerCase()!=='bearer')throw Error('METADATA_UNAVAILABLE');
  cached={token,expiresAt:now+Math.min(expires,3600)};
  return token;
 };
}
