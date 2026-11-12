'use strict';
// I07: backend inteiramente em memoria; identidade/sessoes sinteticas.
const {validateSnapshot}=require('./productionDataContractLab.js');
const {createAuthenticatedBackup,verifyAuthenticatedBackup}=require('./authenticatedFinanceBackupLab.js');
const {isDeepStrictEqual}=require('node:util');
class IsolationLabError extends Error{constructor(code){super(code);this.code=code;this.name='IsolationLabError';}}
const fail=c=>{throw new IsolationLabError(c);};
const clone=x=>JSON.parse(JSON.stringify(x));
const validUid=x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(x);
function createLab({clock=()=>0}={}){
 const users=new Map(),sessions=new Map(),records=new Map(),audit=[];
 function now(){const t=clock();if(!Number.isSafeInteger(t)||t<0)fail('invalid_clock');return t;}
 function register(uid,key){if(!validUid(uid)||!Buffer.isBuffer(key)||key.length<32)fail('invalid_user');if(users.has(uid))fail('duplicate_user');users.set(uid,Buffer.from(key));}
 function login(uid,token,{ttl=1000}={}){if(!users.has(uid))fail('unknown_user');if(typeof token!=='string'||!/^lab_[A-Za-z0-9_-]{8,100}$/.test(token)||sessions.has(token)||!Number.isSafeInteger(ttl)||ttl<=0)fail('invalid_session');sessions.set(token,{uid,expires:now()+ttl,revoked:false});}
 function revoke(token){const s=sessions.get(token);if(!s)fail('invalid_session');s.revoked=true;}
 function auth(token,requestedUid){const s=sessions.get(token);if(!s)fail('unauthenticated');if(s.revoked)fail('session_revoked');if(now()>=s.expires)fail('session_expired');if(requestedUid!==s.uid)fail('forbidden');return s.uid;}
 function initialize(token,uid,snapshot){auth(token,uid);if(records.has(uid))fail('already_initialized');try{validateSnapshot(snapshot);}catch{fail('invalid_finance');}records.set(uid,{revision:0,finance:clone(snapshot)});audit.push({uid,action:'initialize'});}
 function read(token,uid){auth(token,uid);const r=records.get(uid);if(!r)fail('not_found');return {revision:r.revision,finance:clone(r.finance)};}
 function write(token,uid,finance,expectedRevision){auth(token,uid);const r=records.get(uid);if(!r)fail('not_found');if(expectedRevision!==r.revision)fail('revision_conflict');try{validateSnapshot(finance);}catch{fail('invalid_finance');}if(isDeepStrictEqual(r.finance,finance))return {revision:r.revision,changed:false};r.finance=clone(finance);r.revision++;audit.push({uid,action:'write'});return {revision:r.revision,changed:true};}
 function backup(token,uid){auth(token,uid);const r=read(token,uid);return {ownerUid:uid,envelope:createAuthenticatedBackup(r.finance,{key:users.get(uid),keyId:'owner_'+uid,kind:'snapshot'})};}
 function restore(token,uid,wrapped,expectedRevision){auth(token,uid);if(!wrapped||wrapped.ownerUid!==uid)fail('forbidden_backup_owner');const r=read(token,uid);if(r.revision!==expectedRevision)fail('revision_conflict');let payload;try{payload=verifyAuthenticatedBackup(wrapped.envelope,{resolveKey:id=>id==='owner_'+uid?users.get(uid):null});}catch{fail('invalid_authenticated_backup');}if(payload.kind!=='snapshot')fail('invalid_backup_kind');return write(token,uid,payload.finance,expectedRevision);}
 return {register,login,revoke,initialize,read,write,backup,restore,audit:()=>clone(audit)};
}
module.exports={IsolationLabError,createLab};
