import {createPublicKey,verify} from 'node:crypto';
const keysUrl='https://www.googleapis.com/oauth2/v3/certs';
export function recentlyAuthenticated(authTime,now){
 const seconds=Math.floor(now/1000);
 return Number.isSafeInteger(authTime)&&authTime>0&&authTime<=seconds&&seconds-authTime<=300;
}
export function createPushVerifier(){
 let keys=new Map(),expires=0;
 return async(token,{audience,email,subject},transport,signal)=>{
  if(!audience||!email||!subject||typeof token!=='string'||token.length>8192||
   !/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token))throw Error('INVALID_PUSH_IDENTITY');
  const [header,payload,signature]=token.split('.');
  const parse=part=>JSON.parse(Buffer.from(part,'base64url').toString('utf8'));
  const {alg,kid}=parse(header),claims=parse(payload),now=Math.floor(Date.now()/1000);
  if(alg!=='RS256'||typeof kid!=='string'||!['https://accounts.google.com','accounts.google.com'].includes(claims.iss)||
   claims.aud!==audience||claims.email!==email||claims.email_verified!==true||claims.sub!==subject||
   !Number.isSafeInteger(claims.exp)||claims.exp<=now||!Number.isSafeInteger(claims.iat)||
   claims.iat>now+30||claims.iat<now-3600)throw Error('INVALID_PUSH_IDENTITY');
  if(Date.now()>=expires){
   const result=await transport(keysUrl,{signal,redirect:'error'});
   if(!result.ok)throw Error('PUSH_AUTH_UNAVAILABLE');
   keys=new Map((await result.json()).keys.filter(key=>key.kty==='RSA'&&key.alg==='RS256')
    .map(key=>[key.kid,createPublicKey({key,format:'jwk'})]));
   expires=Date.now()+Math.min(3600,Number(result.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1]??0))*1000;
  }
  if(!keys.has(kid)||!verify('RSA-SHA256',Buffer.from(header+'.'+payload),keys.get(kid),Buffer.from(signature,'base64url')))
   throw Error('INVALID_PUSH_IDENTITY');
 };
}
export function invalidLimiter(clock=Date.now){
 let expires=0,count=0;
 const roll=()=>{const now=clock();if(now>=expires){expires=now+60000;count=0;}};
 return {blocked(){roll();return count>=30;},record(){roll();return ++count;}};
}
