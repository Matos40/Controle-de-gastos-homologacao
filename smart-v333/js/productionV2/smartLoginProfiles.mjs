export async function registerFree({uid,transaction,now}){
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(uid))throw Error('ACCOUNT_INVALID');
 return transaction(async tx=>{
 const existing=await tx.read(uid);
 if(existing){if(existing.blocked===true)throw Error('ACCOUNT_BLOCKED');if(existing.uid!==uid)throw Error('PROFILE_UID');await tx.touch(uid,{lastAccess:now()});return existing.plan;}
 await tx.create(uid,{uid,plan:'free',blocked:false,createdAt:now(),lastAccess:now()});return 'free';
 });
}
