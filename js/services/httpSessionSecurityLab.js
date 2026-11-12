'use strict';
// Regras defensivas do laboratorio; autenticidade depende do Firebase Admin SDK.
class SessionPolicyError extends Error{
 constructor(){super('unauthorized');this.name='SessionPolicyError';}
}
function parseBearer(header,{allowUnsignedEmulator=false}={}){
 if(typeof header!=='string'||header.length>8192||
  !(allowUnsignedEmulator?
    /^Bearer [A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]*$/.test(header):
    /^Bearer [A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+$/.test(header)))
  throw new SessionPolicyError();
 return header.slice(7);
}
function validateClaims(decoded,nowSeconds=Math.floor(Date.now()/1000),maxLifetime=3600){
 if(!decoded||typeof decoded!=='object'||typeof decoded.uid!=='string'||
  !decoded.uid||!Number.isSafeInteger(decoded.iat)||
  !Number.isSafeInteger(decoded.exp)||!Number.isSafeInteger(decoded.auth_time)||
  !Number.isSafeInteger(nowSeconds)||decoded.iat>nowSeconds+60||
  decoded.auth_time>nowSeconds+60||decoded.exp<=nowSeconds||
  decoded.exp<=decoded.iat||decoded.exp-decoded.iat>maxLifetime||
  decoded.auth_time>decoded.iat+60)
  throw new SessionPolicyError();
 return decoded.uid;
}
function createSessionVerifier(auth,{checkRevoked=false,nowSeconds}={}){
 if(!auth||typeof auth.verifyIdToken!=='function')throw Error('Firebase Auth Admin obrigatorio.');
 return async token=>{
  if(typeof token!=='string'||!token)throw new SessionPolicyError();
  let decoded;
  try{decoded=await auth.verifyIdToken(token,checkRevoked);}
  catch{throw new SessionPolicyError();}
  return {uid:validateClaims(decoded,nowSeconds?.())};
 };
}
module.exports={SessionPolicyError,parseBearer,validateClaims,createSessionVerifier};
