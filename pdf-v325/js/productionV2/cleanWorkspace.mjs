import {blank,validatePayload,LEGACY_LIMITS} from './model.mjs';
export const LEGACY_KEY='hml_pdf325_controle_gastos_multimonth_v3';
export const CLEAN_KEY='hml_pdf325_raytech_cg_v2_clean_finance_v1';
export const SYNC_PREFIX='hml_pdf325_raytech_cg_v2_clean_sync_v1:';
export const CLEAN_QUERY='workspace=v2-clean';
export function workspaceMode(search=''){return 'v2-clean';}
export function isCleanWorkspace(search=''){return workspaceMode(search)==='v2-clean';}
export const MAIN_KEY='hml_pdf325_raytech_cg_v2_main_finance_v1';
export const MAIN_SYNC_PREFIX='hml_pdf325_raytech_cg_v2_main_sync_v1:';
export const MAIN_QUERY='workspace=v2-main';
export const MAIN_INITIALIZED_KEY='hml_pdf325_raytech_cg_v2_main_initialized_v1';
export const MAIN_BACKUP_FORMAT='raytech-cg-v2-main-backup-v1';
export function isMainWorkspace(search=''){return workspaceMode(search)==='v2-main';}
export function isV2Workspace(search=''){return isCleanWorkspace(search)||isMainWorkspace(search);}
export const databaseKey=search=>({ 'v2-main':MAIN_KEY,'v2-clean':CLEAN_KEY,legacy:LEGACY_KEY })[workspaceMode(search)]??null;
export const syncPrefix=search=>isMainWorkspace(search)?MAIN_SYNC_PREFIX:SYNC_PREFIX;
export const canTransfer=(config,search)=>config?.enabled===true&&config?.syncEnabled===true&&isMainWorkspace(search);
export function scopeSyncStorage(storage,search='?workspace=v2-clean'){const prefix=syncPrefix(search);return {getItem:k=>storage.getItem(prefix+k),setItem:(k,v)=>storage.setItem(prefix+k,v),removeItem:k=>storage.removeItem(prefix+k)};}
export function encodeMainBackup(db){validatePayload(JSON.stringify(db));return {format:MAIN_BACKUP_FORMAT,database:db};}
export function decodeMainBackup(value){
 if(!value||Object.keys(value).length!==2||value.format!==MAIN_BACKUP_FORMAT||!Object.hasOwn(value,'database'))throw Error('Use somente um backup identificado do V2 principal. Backups de teste ou legado não são aceitos.');
 return validatePayload(JSON.stringify(value.database));
}
export function strictPrepare(raw){try{validatePayload(raw);return {compatible:true,payload:raw};}catch{return {compatible:false};}}
export function openCleanStore(storage,month,search='?workspace=v2-clean'){
 const fail=code=>{throw Error(code);};
 if(!isV2Workspace(search))fail('CLEAN_WORKSPACE_INVALID');
 const key=databaseKey(search),main=isMainWorkspace(search);
 let committed=storage.getItem(key);
 if(committed===null){
  // If a checkpoint exists, a missing local database is a recovery condition, not a fresh install.
  if(scopeSyncStorage(storage,search).getItem('raytech_production_v2_device')!==null||main&&storage.getItem(MAIN_INITIALIZED_KEY)!==null)fail('CLEAN_RECOVERY_REQUIRED');
  const first=JSON.stringify(blank(month));validatePayload(first);
  if(storage.getItem(key)!==null)fail('CLEAN_STORE_CHANGED');
  // Marker first: interrupted initialization fails closed rather than risking silent reset.
  if(main){storage.setItem(MAIN_INITIALIZED_KEY,'1');if(storage.getItem(MAIN_INITIALIZED_KEY)!=='1')fail('CLEAN_WRITE_FAILED');}
  storage.setItem(key,first);if(storage.getItem(key)!==first)fail('CLEAN_WRITE_FAILED');committed=first;
 }
 try{validatePayload(committed);if(main&&storage.getItem(MAIN_INITIALIZED_KEY)!=='1')fail('CLEAN_RECOVERY_REQUIRED');}catch{fail('CLEAN_RECOVERY_REQUIRED');}
 const snapshot=()=>validatePayload(committed);
 function replace(expected,next){
  if(expected!==committed||storage.getItem(key)!==committed)fail('CLEAN_STORE_CHANGED');
  validatePayload(next);
  storage.setItem(key,next);
  if(storage.getItem(key)!==next)fail('CLEAN_WRITE_FAILED');
  committed=next;return true;
 }
 return {snapshot,read:()=>committed,replace,save:next=>replace(committed,next),check:next=>{validatePayload(next);return true;},encodeBackup:db=>main?encodeMainBackup(db):db,decodeBackup:db=>main?decodeMainBackup(db):db,readCurrent:()=>storage.getItem(key)};
}
// Hold an exclusive browser lock for the lifetime of a clean-workspace tab.
// Never silently fall back to a different bank or an unlocked writer.
export function acquireCleanLease(locks=globalThis.navigator?.locks,search='?workspace=v2-clean'){
 if(!isV2Workspace(search))return Promise.reject(Error('CLEAN_WORKSPACE_INVALID'));
 const lockName=isMainWorkspace(search)?'hml_pdf325_raytech-cg-v2-main-workspace':'hml_pdf325_raytech-cg-v2-clean-workspace';
 if(!locks?.request)return Promise.reject(Error('CLEAN_LOCK_UNAVAILABLE'));
 return new Promise((resolve,reject)=>{
  let release;const hold=new Promise(r=>{release=r;});
  Promise.resolve(locks.request(lockName,{mode:'exclusive',ifAvailable:true},async lock=>{
   if(!lock){reject(Error('CLEAN_TAB_BUSY'));return;}
   resolve(()=>release());await hold;
  })).catch(reject);
 });
}

export const MAIN_QUARANTINE_KEY='hml_pdf325_raytech_cg_v2_main_quarantine_v1';
export function recoveryState(storage){
 const raw=storage.getItem(MAIN_KEY),marker=storage.getItem(MAIN_INITIALIZED_KEY),checkpoint=scopeSyncStorage(storage,'?workspace=v2-main').getItem('raytech_production_v2_device');
 const valid=raw!==null&&strictPrepare(raw).compatible;
 return {raw,marker,checkpoint,needed:!valid||marker!=='1',available:checkpoint===null&&(!valid||marker!=='1')&&(raw!==null||marker!==null)};
}
// Caller must hold the main workspace lease. Never recover a cloud-bound device locally.
export function recoverMainStore(storage,{expected,backup,pin='',confirmed=false}){
 const fail=code=>{throw Error(code);};
 if(confirmed!==true)fail('RECOVERY_CONFIRMATION_REQUIRED');
 const savedPin=storage.getItem('hml_pdf325_controle_gastos_pin_lock');
 if(savedPin!==null&&pin!==savedPin)fail('RECOVERY_PIN');
 const current=recoveryState(storage);
 if(current.checkpoint!==null)fail('RECOVERY_CLOUD_BOUND');
 if(!current.available)fail('RECOVERY_NOT_REQUIRED');
 if(!expected||current.raw!==expected.raw||current.marker!==expected.marker||current.checkpoint!==expected.checkpoint)fail('RECOVERY_CHANGED');
 const next=JSON.stringify(decodeMainBackup(backup));
 if(current.raw!==null){
  const archived=storage.getItem(MAIN_QUARANTINE_KEY);
  if(archived!==null&&archived!==current.raw)fail('RECOVERY_ARCHIVE_OCCUPIED');
  if(archived===null)storage.setItem(MAIN_QUARANTINE_KEY,current.raw);
  if(storage.getItem(MAIN_QUARANTINE_KEY)!==current.raw)fail('RECOVERY_ARCHIVE_FAILED');
 }
 storage.setItem(MAIN_INITIALIZED_KEY,'1');
 if(storage.getItem(MAIN_INITIALIZED_KEY)!=='1'||storage.getItem(MAIN_KEY)!==current.raw)fail('RECOVERY_CHANGED');
 storage.setItem(MAIN_KEY,next);
 if(storage.getItem(MAIN_KEY)!==next)fail('RECOVERY_WRITE_FAILED');
 return true;
}
export function mainCapacity(raw){
 const d=validatePayload(raw),months=Object.values(d.months);
 const maxEntries=Math.max(0,...months.flatMap(m=>[m.expenses.length,m.cardExpenses.length,m.extraIncomes.length]));
 const maxMarks=Math.max(0,...months.map(m=>(m.deletedInstallmentOrigins??[]).length));
 return {characters:raw.length,bytes:new TextEncoder().encode(raw).length,months:months.length,maxEntries,maxMarks,limits:LEGACY_LIMITS,near:[raw.length/LEGACY_LIMITS.payload,months.length/LEGACY_LIMITS.months,maxEntries/LEGACY_LIMITS.entries,maxMarks/LEGACY_LIMITS.tombstones].some(v=>v>=0.8)};
}
export function capacityMessage(raw){
 const r=mainCapacity(raw);return 'Capacidade local: '+r.months+'/'+r.limits.months+' meses · '+r.characters+'/'+r.limits.payload+' caracteres · maior lista '+r.maxEntries+'/'+r.limits.entries+' · marcas '+r.maxMarks+'/'+r.limits.tombstones+(r.near?' · Atenção: limite próximo; exporte backup e planeje ampliação antes de novos lançamentos.':'.');
}
