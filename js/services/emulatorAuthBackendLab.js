'use strict';
// Somente laboratorio Node: verifyIdToken real do Admin SDK (Auth Emulator).
const {verifyFactory}=require('./trustedFinanceBackendLab.js');
function createAuthenticatedBackend(db,auth){
 if(!auth||typeof auth.verifyIdToken!=='function')throw Error('Firebase Auth Admin obrigatorio.');
 return verifyFactory(db,async token=>{
  if(typeof token!=='string'||!token.trim())throw Error('ID token ausente.');
  const decoded=await auth.verifyIdToken(token);
  if(!decoded||!decoded.uid)throw Error('Token sem UID.');
  return {uid:decoded.uid};
 });
}
module.exports={createAuthenticatedBackend};
