import {createRestStore} from '../../firestore.mjs';
import {TRIAL_COLLECTION} from './trial-control-channel.mjs';

const financeProjects=new Set(['gen-lang-client-0593667072','raytech-cg-homologacao','raytech-cg-producao','raytech-3d']);
const projectPattern=/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;

// Explicit allowlist is a trusted code-side deployment decision, not an env
// value the runtime can self-approve. Production candidates deliberately have
// no approved project until a separately authorized review pins its identifier.
export const APPROVED_REMOTE_CONTROL_PROJECTS=Object.freeze([]);

export function isolatedControlDatabase({projectId,databaseId='(default)',allowedProjects=[]}={}){
 if(typeof projectId!=='string'||!projectPattern.test(projectId)||
    financeProjects.has(projectId)||!Array.isArray(allowedProjects)||
    !allowedProjects.includes(projectId)||allowedProjects.length!==1||
    databaseId!=='(default)')throw Error('TRIAL_CONTROL_DATABASE_NOT_APPROVED');
 const resource='projects/'+projectId+'/databases/(default)';
 return Object.freeze({projectId,databaseId,resource,
  base:'https://firestore.googleapis.com/v1/'+resource+'/documents'});
}

export function isolatedTrialDb(restStore){
 if(typeof restStore?.runTransaction!=='function'||typeof restStore?.collection!=='function')
  throw Error('TRIAL_CONTROL_DB_REQUIRED');
 // Structural denylist: the trial handler only receives a reference to one
 // collection. Cross-project IAM isolation still MUST be verified remotely.
 return Object.freeze({
  collection(name){
   if(name!==TRIAL_COLLECTION)throw Error('TRIAL_CONTROL_COLLECTION_DENIED');
   return restStore.collection(name);
  },
  runTransaction:(...args)=>restStore.runTransaction(...args),
 });
}

export function createIsolatedTrialRestStore({database,accessToken,signal,transport=fetch,
  retries=3,emulatorBase}={}){
 if(!database?.resource||!database?.base||typeof accessToken!=='function')
  throw Error('TRIAL_CONTROL_DB_REQUIRED');
 const base=emulatorBase??database.base;
 if(emulatorBase!==undefined&&!/^http:\/\/127\.0\.0\.1:18080\/v1\/projects\/[a-z0-9-]+\/databases\/\(default\)\/documents$/.test(emulatorBase))
  throw Error('TRIAL_CONTROL_EMULATOR_ONLY');
 if(emulatorBase!==undefined&&emulatorBase!=='http://127.0.0.1:18080/v1/'+database.resource+'/documents')
  throw Error('TRIAL_CONTROL_DB_MISMATCH');
 return isolatedTrialDb(createRestStore(database.resource,base,accessToken,signal,transport,
  {abortedRetries:retries}));
}
