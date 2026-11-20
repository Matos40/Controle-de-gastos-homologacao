import {planOf} from './quota.mjs';
export const FEATURE='invoice-ai';
export const ACCOUNT_COLLECTION='raytechAccountsV334';
export const ROLE_COLLECTION='raytechAdminRolesV334';
const uidPattern=/^[A-Za-z0-9_-]{1,128}$/;
const denied=status=>({status,body:{allowed:false}});
export function decidePremium(uid,account,role){
 if(!uidPattern.test(uid)||!account||account.uid!==uid||account.blocked!==false||!['free','premium'].includes(account.plan))return false;
 return account.plan==='premium'||(role?.active===true&&['owner','admin'].includes(role.role));
}
export async function authorizePremium(request,{verifyToken,readPermissions}){
 if(request.method!=='POST')return denied(405);
 const header=request.headers?.authorization;
 if(typeof header!=='string'||header.length>8192||!/^Bearer [^\s,]+$/.test(header))return denied(401);
 let claims;
 try{claims=await verifyToken(header.slice(7));}catch{return denied(401);}
 const uid=claims?.uid;
 if(typeof uid!=='string'||!uidPattern.test(uid))return denied(401);
 const body=request.body;
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length!==1||body.feature!==FEATURE||Object.keys(request.query??{}).length)return denied(400);
 try{
  const {account,role}=await readPermissions(uid);
  return planOf(uid,account,Date.now())?{status:200,body:{allowed:true,feature:FEATURE}}:denied(403);
 }catch{return denied(503);}
}
