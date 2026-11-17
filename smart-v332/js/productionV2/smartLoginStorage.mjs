export function scopedAccountStorage(storage,uid,isCurrent){
 if(typeof uid!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(uid)||typeof isCurrent!=='function')throw Error('ACCOUNT_INVALID');
 const prefix='raytech-smart-v332:'+uid+':';
 const key=k=>{if(!isCurrent(uid))throw Error('ACCOUNT_SESSION_CHANGED');return prefix+String(k);};
 return Object.freeze({getItem:k=>storage.getItem(key(k)),setItem:(k,v)=>storage.setItem(key(k),v),removeItem:k=>storage.removeItem(key(k))});
}
