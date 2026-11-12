'use strict';
const assert=require('node:assert/strict');
const {SessionPolicyError,parseBearer,validateClaims,createSessionVerifier}=
 require('../../js/services/httpSessionSecurityLab.js');
let n=0;
async function test(name,fn){await fn();n++;console.log('APROVADO:',name);}
const now=2000000000;
const good={uid:'user-A',iat:now-100,exp:now+3500,auth_time:now-200};
const invalid=()=>assert.throws(()=>{},SessionPolicyError);
async function main(){
 await test('Bearer JWT valido',()=>assert.equal(parseBearer('Bearer abc.def.ghi'),'abc.def.ghi'));
 await test('JWT sem assinatura permitido apenas no emulador',()=>assert.equal(parseBearer('Bearer abc.def.',{allowUnsignedEmulator:true}),'abc.def.'));
 await test('JWT sem assinatura rejeitado por padrao',()=>assert.throws(()=>parseBearer('Bearer abc.def.'),SessionPolicyError));
 await test('Bearer ausente',()=>assert.throws(()=>parseBearer(''),SessionPolicyError));
 await test('Bearer lowercase rejeitado',()=>assert.throws(()=>parseBearer('bearer abc.def.ghi'),SessionPolicyError));
 await test('Bearer com espacos rejeitado',()=>assert.throws(()=>parseBearer('Bearer abc.def.ghi '),SessionPolicyError));
 await test('Bearer sem assinatura rejeitado',()=>assert.throws(()=>parseBearer('Bearer abc.def'),SessionPolicyError));
 await test('Bearer com caracteres invalidos',()=>assert.throws(()=>parseBearer('Bearer abc.def.ghi!'),SessionPolicyError));
 await test('Bearer longo rejeitado',()=>assert.throws(()=>parseBearer('Bearer '+ 'a'.repeat(8193)),SessionPolicyError));
 await test('claims validos',()=>assert.equal(validateClaims(good,now),'user-A'));
 await test('sessao expirada',()=>assert.throws(()=>validateClaims({...good,exp:now},now),SessionPolicyError));
 await test('iat no futuro',()=>assert.throws(()=>validateClaims({...good,iat:now+61,exp:now+3000},now),SessionPolicyError));
 await test('auth_time futuro',()=>assert.throws(()=>validateClaims({...good,auth_time:now+61},now),SessionPolicyError));
 await test('UID ausente',()=>assert.throws(()=>validateClaims({...good,uid:''},now),SessionPolicyError));
 await test('exp nao numerico',()=>assert.throws(()=>validateClaims({...good,exp:'later'},now),SessionPolicyError));
 await test('vida excessiva',()=>assert.throws(()=>validateClaims({...good,exp:now+4000},now),SessionPolicyError));
 await test('exp anterior a iat',()=>assert.throws(()=>validateClaims({...good,exp:now-200},now),SessionPolicyError));
 await test('auth_time posterior a iat',()=>assert.throws(()=>validateClaims({...good,auth_time:now},now),SessionPolicyError));
 const calls=[];
 const verifier=createSessionVerifier({verifyIdToken:async(token,revoked)=>{
  calls.push([token,revoked]);return good;
 }},{nowSeconds:()=>now});
 await test('verificador usa Admin SDK',async()=>assert.deepEqual(await verifier('jwt'),{uid:'user-A'}));
 await test('revogacao nao solicitada por padrao',()=>assert.deepEqual(calls,[['jwt',false]]));
 await test('verificador rejeita token vazio',async()=>await assert.rejects(verifier(''),SessionPolicyError));
 await test('verificador mascara erro do Admin SDK',async()=>{
  const v=createSessionVerifier({verifyIdToken:async()=>{throw Error('internal token details');}},{nowSeconds:()=>now});
  await assert.rejects(v('jwt'),e=>e instanceof SessionPolicyError&&e.message==='unauthorized');
 });
 await test('revogacao configuravel e encaminhada',async()=>{
  const args=[];
  const v=createSessionVerifier({verifyIdToken:async(t,r)=>{args.push(r);return good;}},{checkRevoked:true,nowSeconds:()=>now});
  await v('jwt');assert.deepEqual(args,[true]);
 });
 console.log('RESULTADO: '+n+'/23 TESTES APROVADOS');
}
main().catch(e=>{console.error('FALHA:',e);process.exitCode=1;});
