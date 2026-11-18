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
