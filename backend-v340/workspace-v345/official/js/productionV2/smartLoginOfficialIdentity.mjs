// Local ownership policy. Does not migrate, erase or claim existing data.
export const OFFLINE_GRANT_PREFIX='raytech_v334_offline_grant:';
export const OWNER_KEY='raytech_v334_original_workspace_owner';
export const ORIGINAL_KEYS=Object.freeze(['raytech_cg_v2_main_finance_v1','raytech_cg_v2_clean_finance_v1','controle_gastos_multimonth_v3','raytech_cg_v2_main_initialized_v1','raytech_cg_v2_main_quarantine_v1','controle_gastos_pin_lock','gemini_user_api_key']);
const valid=uid=>typeof uid==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(uid);
export function resolveWorkspaceIdentity({uid,verifiedOwnerUid,storedOwnerUid,checkpointUid,hasOriginalData}){
 if(!valid(uid))throw Error('IDENTITY_REQUIRED');
 if(storedOwnerUid!==null&&!valid(storedOwnerUid))throw Error('OWNER_BINDING_INVALID');
 if(checkpointUid!==null&&!valid(checkpointUid))throw Error('CHECKPOINT_INVALID');
 if(storedOwnerUid&&checkpointUid&&storedOwnerUid!==checkpointUid)throw Error('OWNER_BINDING_CONFLICT');
 const owner=storedOwnerUid??checkpointUid??(valid(verifiedOwnerUid)?verifiedOwnerUid:null);
 if(owner===uid&&verifiedOwnerUid===uid)return Object.freeze({uid,original:true,prefix:''});
 if(owner===uid)throw Error('OWNER_VERIFICATION_REQUIRED');
 if(hasOriginalData&&!owner)throw Error('ORIGINAL_OWNER_UNRESOLVED');
 return Object.freeze({uid,original:false,prefix:'raytech_v334_uid:'+uid+':'});
}
export function scopedStorage(storage,identity,isActive){
 if(!valid(identity?.uid)||identity.prefix!==(identity.original?'':'raytech_v334_uid:'+identity.uid+':'))throw Error('INVALID_SCOPE');
 const key=k=>{if(!isActive(identity.uid))throw Error('SESSION_CHANGED');if(typeof k!=='string'||k===OWNER_KEY||k.startsWith('raytech_v334_uid:')||k.startsWith(OFFLINE_GRANT_PREFIX))throw Error('RESERVED_KEY');return identity.prefix+k;};
 return Object.freeze({getItem:k=>storage.getItem(key(k)),setItem:(k,v)=>storage.setItem(key(k),v),removeItem:k=>storage.removeItem(key(k))});
}

// A cached grant only permits reopening locally stored data for a still-authenticated UID.
// It never authorizes Firebase access, an administrative operation, or first-time ownership.
export function readOfflineGrant(storage,uid){
 if(!valid(uid))throw Error('IDENTITY_REQUIRED');
 let grant;try{grant=JSON.parse(storage.getItem(OFFLINE_GRANT_PREFIX+uid));}catch{throw Error('OFFLINE_AUTH_REQUIRED');}
 if(!grant||grant.format!==1||grant.uid!==uid||typeof grant.original!=='boolean')throw Error('OFFLINE_AUTH_REQUIRED');
 return grant;
}
export function cacheOfflineGrant(storage,identity){
 if(!valid(identity?.uid)||typeof identity.original!=='boolean')throw Error('IDENTITY_REQUIRED');
 storage.setItem(OFFLINE_GRANT_PREFIX+identity.uid,JSON.stringify({format:1,uid:identity.uid,original:identity.original}));
}
export function revokeOfflineGrant(storage,uid){
 if(valid(uid))storage.removeItem(OFFLINE_GRANT_PREFIX+uid);
}
export function resolveOfflineIdentity(storage,uid,{storedOwnerUid,checkpointUid,hasOriginalData}){
 const grant=readOfflineGrant(storage,uid);
 if(grant.original&&(storedOwnerUid!==uid||(checkpointUid!==null&&checkpointUid!==uid)))throw Error('OFFLINE_OWNER_BINDING_REQUIRED');
 const identity=resolveWorkspaceIdentity({uid,verifiedOwnerUid:grant.original?uid:null,storedOwnerUid,checkpointUid,hasOriginalData});
 if(identity.original!==grant.original)throw Error('OFFLINE_SCOPE_CHANGED');
 return identity;
}
