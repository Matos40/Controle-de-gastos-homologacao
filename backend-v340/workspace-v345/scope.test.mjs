import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requireProductionConfig,PRODUCTION_CONFIG} from './official/js/productionV2/config.mjs';
import {scopedStorage} from './official/js/productionV2/smartLoginOfficialIdentity.mjs';
test('configuration rejects every non-laboratory origin',()=>{for(const origin of ['https://matos40.github.io','http://localhost:15003','http://127.0.0.1:15002'])assert.throws(()=>requireProductionConfig(PRODUCTION_CONFIG,{origin}));assert.equal(requireProductionConfig(PRODUCTION_CONFIG,{origin:'http://127.0.0.1:15003'}).projectId,'demo-raytech-v340');});
test('synthetic users and three banks isolated; revoked session cannot read',()=>{const m=new Map();const raw={getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)};let active='a';const scope=uid=>scopedStorage(raw,{uid,original:false,prefix:'raytech_v334_uid:'+uid+':'},u=>u===active);const a=scope('a'),b=scope('b');for(const k of ['raytech_cg_v2_main_finance_v1','raytech_cg_v2_clean_finance_v1','controle_gastos_multimonth_v3'])a.setItem(k,k);active='b';assert.throws(()=>a.getItem('controle_gastos_multimonth_v3'));assert.equal(b.getItem('controle_gastos_multimonth_v3'),null);assert.equal(m.size,3);});

test('initial reconciliation joins independent entries and rejects incompatible balances', async () => {
  const {blank} = await import('./official/js/productionV2/model.mjs');
  const {mergeInitial, isEmptyFinance} = await import('./official/js/productionV2/smartPremiumInitialMerge.mjs');
  const local = blank('2026-06'), remote = blank('2026-06');
  const encode = JSON.stringify;
  assert.equal(isEmptyFinance(encode(remote)), true);
  local.months['2026-06'].salary = 1000;
  remote.months['2026-06'].expenses.push({id:'test-expense',title:'Teste',amount:10,type:'fixed',category:'outros',date:'2026-06-02',paid:false});
  local.months['2026-05'] = blank('2026-05').months['2026-05'];
  const merged = JSON.parse(mergeInitial(encode(local), encode(remote)));
  assert.equal(merged.months['2026-06'].salary, 1000);
  assert.equal(merged.months['2026-06'].expenses.length, 1);
  assert.ok(merged.months['2026-05']);
  remote.months['2026-06'].salary = 1500;
  assert.throws(() => mergeInitial(encode(local), encode(remote)), /PREMIUM_INITIAL_CONFLICT/);
  assert.equal(local.months['2026-06'].salary, 1000);
  assert.equal(remote.months['2026-06'].salary, 1500);
});

test('binding two empty banks does not create a Firestore revision', async () => {
  const {blank} = await import('./official/js/productionV2/model.mjs');
  const {createSyncEngine} = await import('./official/js/experimentalSync/engine.mjs');
  const raw = JSON.stringify(blank('2026-06'));
  const slots = new Map();
  const storage = {getItem:key=>slots.get(key)??null,setItem:(key,value)=>slots.set(key,value)};
  const engine = createSyncEngine({
    uid:'fixture', storage, local:{read:()=>raw},
    cloud:{currentUid:()=> 'fixture',read:async()=>null,send:async()=>assert.fail('blank commit')},
    lock:async (_key,fn)=>fn(), prepare:payload=>({compatible:true,payload}),
  });
  await engine.bind({mode:'seed',plan:{local:raw,remote:null}});
  assert.deepEqual(await engine.tick(),{status:'empty',revision:undefined});
});

function recoveryFixture(tick){
  let clock=0, sequence=0, connected=true;
  const timers=new Map(), errors=[];
  return {
    errors,
    setOnline(value){connected=value;},
    due(){return [...timers.values()].map(x=>x.at).sort((a,b)=>a-b);},
    config:{session:{state:()=>({active:true,busy:false}),tick},
      environment:()=>({bound:true,visible:true,online:connected,unlocked:true}),
      setTimer:(fn,ms)=>{const id=++sequence;timers.set(id,{at:clock+ms,fn});return id;},
      clearTimer:id=>timers.delete(id), now:()=>clock, eventOnly:true,delay:1000,
      onError:error=>errors.push(error)},
    async next(){
      const [id,job]=[...timers.entries()].sort((a,b)=>a[1].at-b[1].at)[0];
      timers.delete(id);clock=job.at;await job.fn();
    }
  };
}

test('unavailable retries progressively and an online event brings the next attempt forward', async () => {
  const {createEventRuntime}=await import('./official/js/productionV2/eventRuntime.mjs');
  let attempts=0;
  const fixture=recoveryFixture(async()=>{
    if(++attempts<=2)throw Object.assign(Error('transport'),{code:'unavailable'});
    return {status:'synced'};
  });
  const runtime=createEventRuntime(fixture.config);
  runtime.signal();
  await fixture.next();
  assert.deepEqual(fixture.due(),[3000]);
  assert.equal(fixture.errors[0].persistent,false);
  await fixture.next();
  assert.deepEqual(fixture.due(),[7000]);
  fixture.setOnline(false);runtime.changed();
  assert.deepEqual(fixture.due(),[]);
  fixture.setOnline(true);runtime.reconnect();
  assert.deepEqual(fixture.due(),[4000]);
  await fixture.next();
  assert.equal(attempts,3);
  assert.deepEqual(fixture.due(),[]);
});

test('sustained transient failures back off and permission failures stop automatic retries', async () => {
  const {createEventRuntime}=await import('./official/js/productionV2/eventRuntime.mjs');
  const fixture=recoveryFixture(async()=>{throw Object.assign(Error('transient'),{code:'unavailable'});});
  const runtime=createEventRuntime(fixture.config);
  runtime.signal();
  for(let i=0;i<5;i++)await fixture.next();
  assert.equal(fixture.errors.filter(error=>error.persistent).length,1);
  assert.equal(fixture.due().length,1);
  runtime.fail({code:'permission-denied'});
  runtime.reconnect();
  assert.equal(fixture.errors.at(-1).kind,'persistent');
  assert.deepEqual(fixture.due(),[]);
});

test('recovery confirms an existing receipt when Firestore committed before losing the reply', async () => {
  const {createHash}=await import('node:crypto');
  const {blank}=await import('./official/js/productionV2/model.mjs');
  const {createSyncEngine}=await import('./official/js/experimentalSync/engine.mjs');
  const data=blank('2026-06');
  data.months['2026-06'].expenses.push({id:'fictional',title:'Teste',amount:14,type:'fixed',category:'outros',date:'2026-06-02',paid:false});
  const raw=JSON.stringify(data), digest=async value=>createHash('sha256').update(value).digest('hex');
  const slots=new Map();
  const storage={getItem:key=>slots.get(key)??null,setItem:(key,value)=>slots.set(key,value)};
  let remote=null, writes=0;
  const cloud={
    currentUid:()=> 'fixture',
    read:async()=>remote,
    confirm:async (expectedUid,receipt)=>expectedUid==='fixture'&&remote!==null&&JSON.stringify(receipt)===JSON.stringify(remote.receipt),
    async send(_uid,command){
      writes++;
      const hash=await digest(command.payload);
      const receipt={operationId:command.id,revision:command.expectedRevision+1,parentId:command.parentId,hash};
      remote={head:{marker:'raytech-financial-production-v2',revision:receipt.revision,
        lastOperationId:command.id,hash,payload:command.payload},receipt};
      throw Object.assign(Error('lost acknowledgement'),{code:'unavailable'});
    },
  };
  const engine=createSyncEngine({uid:'fixture',storage,cloud,local:{read:()=>raw},
    prepare:payload=>({compatible:true,payload}),hash:digest,
    id:()=> '12345678-1234-4123-8123-123456789abc', lock:async (_key,fn)=>fn()});
  await engine.bind({mode:'seed',plan:{local:raw,remote:null}});
  await assert.rejects(engine.tick(),{code:'unavailable'});
  assert.deepEqual(await engine.tick(),{status:'synced',revision:1});
  assert.equal(writes,1);
  assert.equal(JSON.parse(remote.head.payload).months['2026-06'].expenses.length,1);
});

test('PWA grant has a 24-hour validity window and is scoped to one UID', async () => {
  const {verifyOfflineAccess,recordOfflineAccess,OFFLINE_VALIDITY_MS} = await import('./official/js/productionV2/pwaOfflineAccess.mjs');
  const slots=new Map();
  const storage={getItem:k=>slots.get(k)??null,setItem:(k,v)=>slots.set(k,v),removeItem:k=>slots.delete(k)};
  recordOfflineAccess(storage,'fixtureA',1000);
  assert.equal(verifyOfflineAccess(storage,'fixtureA',1000),1000+OFFLINE_VALIDITY_MS);
  assert.throws(()=>verifyOfflineAccess(storage,'fixtureA',999));
  assert.throws(()=>verifyOfflineAccess(storage,'fixtureA',1000+OFFLINE_VALIDITY_MS));
  assert.throws(()=>verifyOfflineAccess(storage,'fixtureB',1000));
  const {revokeOfflineGrant}=await import('./official/js/productionV2/smartLoginOfficialIdentity.mjs');
  revokeOfflineGrant(storage,'fixtureA');
  assert.throws(()=>verifyOfflineAccess(storage,'fixtureA',1000));
});
