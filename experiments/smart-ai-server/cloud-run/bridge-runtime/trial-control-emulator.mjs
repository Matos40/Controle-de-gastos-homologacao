import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {assertLocalEmulators} from '../../legacy/emulator-guard.mjs';
import {isolatedControlDatabase,createIsolatedTrialRestStore,CONTROL_RESOURCE,CONTROL_PROJECT,CONTROL_DATABASE_ID} from './trial-db-isolation.mjs';
import {createTrialGate,recoverClosedTrial} from './trial-readiness.mjs';
import {createFirestoreTrialControlStore,createAuthenticatedTrialChannel,
 createRemoteTrialControlStore,TRIAL_COLLECTION,TRIAL_PATH} from './trial-control-channel.mjs';

assertLocalEmulators();
const database=isolatedControlDatabase({projectId:CONTROL_PROJECT,databaseId:CONTROL_DATABASE_ID,
 allowedDatabases:[CONTROL_RESOURCE]});
const target='http://127.0.0.1:18080/v1/'+database.resource+'/documents';
const runId='trial'+randomUUID().replaceAll('-','');
const requestId=randomUUID();
const executionId='synthetic-execution-'+randomUUID().replaceAll('-','');
let now=Date.now();
const absoluteDeadline=now+180000;
const db=()=>createIsolatedTrialRestStore({database,accessToken:async()=>'owner',
 signal:AbortSignal.timeout(25000),transport:fetch,retries:4,emulatorBase:target});
const controller={email:'controller@demo-project.iam.gserviceaccount.com',subject:'111',audience:'https://trial.internal.invalid'};
const job={email:'job@demo-project.iam.gserviceaccount.com',subject:'222',audience:'https://trial.internal.invalid'};
const store=createFirestoreTrialControlStore(db(),{runId});
for(const forbidden of ['raytechV345Accounts','raytechLabCommercialV350',
 'raytechLabCommercialGlobalV350','raytechLabCommercialAuditV350'])
 assert.throws(()=>db().collection(forbidden),/TRIAL_CONTROL_COLLECTION_DENIED/);
const auth=async (token,expected)=>{
 const candidate=token==='proof-controller'?controller:token==='proof-job'?job:null;
 if(!candidate||candidate.email!==expected.email||candidate.subject!==expected.subject||
  candidate.audience!==expected.audience)throw Error('BAD_SYNTHETIC_PRINCIPAL');
};
const endpoint='https://trial.internal.invalid'+TRIAL_PATH;
const handler=createAuthenticatedTrialChannel({store,runId,requestId,absoluteDeadline,
 executionId,jobName:'test-job',controller,job,verifyGoogle:auth,clock:()=>now});
const transport=(url,options)=>handler(new Request(url,options));
function gate(role,token){
 return createTrialGate({store:createRemoteTrialControlStore({endpoint,role,
  identity:async()=>token,transport}),runId,requestId,absoluteDeadline,clock:()=>now});
}
const c=gate('controller','proof-controller'),j=gate('job','proof-job');
const checkCollections=async()=>{
 // Only the new lab collection may be modified; no commercial ledger is touched.
 const control=db().collection(TRIAL_COLLECTION).doc(runId);
 return db().runTransaction(async tx=>(await tx.get(control)).data(),{readOnly:true});
};

assert.equal(await c.read().then(s=>s.phase),'provisioning');
assert.ok(await c.initializing({executionId,jobName:'test-job',jobEmail:job.email,
 executionUid:randomUUID(),runId,requestId,absoluteDeadline,endpoint,verifiedAt:now}));
assert.ok(await j.identityReady(executionId,'synthetic-user'));
assert.ok(await c.profilePrepared(executionId));
assert.ok(await j.privateReady(executionId));
assert.ok(await c.financeVerified());
assert.ok(await c.authorize(now+12000));
const [one,two]=await Promise.all([j.claim(executionId),j.claim(executionId)]);
assert.equal(Number(Boolean(one))+Number(Boolean(two)),1,'exactly one dispatcher wins');
assert.equal((await checkCollections()).admitted,true);
assert.equal((await gate('controller','proof-controller').read()).phase,'executing','recreation keeps state');
assert.ok(await c.block());
assert.equal(await j.claim(executionId),null,'closed gate refuses late client');
assert.equal((await checkCollections()).phase,'reconciling');
let drained=0,reconciled=0,restored=0;
const ops={
 async blockAdmissions(){return true;},
 async drainDispatch(){drained++;return true;},
 async reconcile(original){assert.equal(original,requestId);reconciled++;return true;},
 async restore(){restored++;return true;},
};
now=absoluteDeadline+1;
const recovery=await recoverClosedTrial({gate:c,ops,signal:AbortSignal.timeout(10000)});
assert.equal(recovery.phase,'reversed');
await recoverClosedTrial({gate:gate('controller','proof-controller'),ops,signal:AbortSignal.timeout(10000)});
assert.deepEqual([drained,reconciled,restored],[1,1,1],'recovery is idempotent');
assert.equal(await j.claim(executionId),null);
// Inspect only the LOCAL EMULATOR. These checks are NOT an IAM claim.
// No trial doc may have been persisted to (default) or financial projects.
for(const unwanted of [
 'projects/raytech-3d/databases/(default)',
 'projects/gen-lang-client-0593667072/databases/(default)',
 'projects/raytech-cg-homologacao/databases/(default)',
 'projects/raytech-cg-producao/databases/(default)',
]) {
 const url='http://127.0.0.1:18080/v1/'+unwanted+'/documents/'+TRIAL_COLLECTION+'/'+runId;
 const response=await fetch(url,{headers:{authorization:'Bearer owner'}});
 assert.equal(response.status,404,'control document must not exist outside named control bank');
}
console.log('08.6.4.5 Firestore Emulator: banco nomeado ai-control-v350, (default) e ledgers nao tocados, CAS concorrente, reinicio, cancelamento e reversao aprovados. IAM real continua pendente.');
