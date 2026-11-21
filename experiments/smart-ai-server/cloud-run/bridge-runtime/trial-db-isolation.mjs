import {createRestStore} from '../../firestore.mjs';
import {TRIAL_COLLECTION} from './trial-control-channel.mjs';

// The only candidate is the paid, NAMED database in the existing COMPUTE
// project. Its (default) database and all financial projects are forbidden.
// No remote runtime is authorized until IAM is independently verified.
export const CONTROL_PROJECT='raytech-3d';
export const CONTROL_DATABASE_ID='ai-control-v350';
export const CONTROL_RESOURCE='projects/'+CONTROL_PROJECT+'/databases/'+CONTROL_DATABASE_ID;
export const APPROVED_REMOTE_CONTROL_DATABASES=Object.freeze([]);

const denial=()=>{throw Error('TRIAL_CONTROL_DATABASE_NOT_APPROVED');};
const refDenial=()=>{throw Error('TRIAL_CONTROL_REFERENCE_DENIED');};
const canonicalBase='https://firestore.googleapis.com/v1/'+CONTROL_RESOURCE+'/documents';
const refName=id=>CONTROL_RESOURCE+'/documents/'+TRIAL_COLLECTION+'/'+id;
const validDocId=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(x);

// An explicit, exactly-one database allowlist must be pinned in source after
// real IAM review. Tests can pass a synthetic allowlist; the live runtime cannot
// authorize itself with an environment variable.
export function isolatedControlDatabase({projectId,databaseId,
 allowedDatabases=APPROVED_REMOTE_CONTROL_DATABASES}={}){
 if(projectId!==CONTROL_PROJECT||databaseId!==CONTROL_DATABASE_ID||
    !Array.isArray(allowedDatabases)||allowedDatabases.length!==1||
    allowedDatabases[0]!==CONTROL_RESOURCE)denial();
 return Object.freeze({projectId,databaseId,resource:CONTROL_RESOURCE,base:canonicalBase});
}

function validateDatabase(database){
 if(database?.projectId!==CONTROL_PROJECT||database?.databaseId!==CONTROL_DATABASE_ID||
    database?.resource!==CONTROL_RESOURCE||database?.base!==canonicalBase)denial();
}

// The transaction wrapper validates every document ref, not just collection()
// calls. Otherwise a caller could forge a {name: ...} ref to another collection.
export function isolatedTrialDb(restStore,{database}={}){
 validateDatabase(database);
 if(typeof restStore?.runTransaction!=='function'||typeof restStore?.collection!=='function')
  throw Error('TRIAL_CONTROL_DB_REQUIRED');
 function assertRef(ref){
  if(!ref||typeof ref.name!=='string'||!ref.name.startsWith(CONTROL_RESOURCE+'/documents/'+TRIAL_COLLECTION+'/')||
     !validDocId(ref.name.slice((CONTROL_RESOURCE+'/documents/'+TRIAL_COLLECTION+'/').length))||
     ref.name!==refName(ref.name.slice((CONTROL_RESOURCE+'/documents/'+TRIAL_COLLECTION+'/').length)))
   refDenial();
  return ref;
 }
 return Object.freeze({
  collection(name){
   if(name!==TRIAL_COLLECTION)throw Error('TRIAL_CONTROL_COLLECTION_DENIED');
   return Object.freeze({doc(id){
    if(!validDocId(id))refDenial();
    return restStore.collection(TRIAL_COLLECTION).doc(id);
   }});
  },
  runTransaction(run,options){
   if(typeof run!=='function')throw Error('TRIAL_CONTROL_TRANSACTION_REQUIRED');
   return restStore.runTransaction(tx=>run(Object.freeze({
    get:ref=>tx.get(assertRef(ref)),
    create:(ref,data)=>tx.create(assertRef(ref),data),
    set:(ref,data)=>tx.set(assertRef(ref),data),
   })),options);
  },
 });
}

export function createIsolatedTrialRestStore({database,accessToken,signal,transport=fetch,
 retries=3,emulatorBase}={}){
 validateDatabase(database);
 if(typeof accessToken!=='function')throw Error('TRIAL_CONTROL_DB_REQUIRED');
 const local='http://127.0.0.1:18080/v1/'+CONTROL_RESOURCE+'/documents';
 if(emulatorBase!==undefined&&emulatorBase!==local)
  throw Error('TRIAL_CONTROL_DB_MISMATCH');
 const base=emulatorBase??canonicalBase;
 return isolatedTrialDb(createRestStore(CONTROL_RESOURCE,base,accessToken,signal,transport,
  {abortedRetries:retries}),{database});
}
