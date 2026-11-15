import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {blank,apply,seedMigration} from '../js/cloudTest/model.mjs';
import {confirmMigrationV2} from '../js/cloudTest/capacityV2.mjs';
const sha=async p=>createHash('sha256').update(p).digest('hex');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const payload=JSON.stringify(blank('2026-12')),hash=await sha(payload);
const source=apply(null,{id:id(1),expectedRevision:0,payload},hash).state;
const expected=seedMigration(source,null,null,id(2),hash);
const good={route:expected.route,head:expected.head,receipt:expected.receipt};
const opts=()=>({expected,source,sha,isCurrent:()=>true,read:async()=>good,delay:async()=>{}});
test('BUG-V2-001 incomplete first observation then verified seed; no write or duplicate',async()=>{
 let reads=0,delays=[];const before=JSON.stringify(source);
 const result=await confirmMigrationV2({...opts(),read:async()=>++reads===1?{...good,head:null}:good,delay:async ms=>delays.push(ms)});
 assert.deepEqual(result,good.head);assert.equal(reads,2);assert.deepEqual(delays,[250]);assert.equal(JSON.stringify(source),before);
});
test('BUG-V2-001 persistent missing confirmation stops after three reads',async()=>{
 let reads=0;await assert.rejects(confirmMigrationV2({...opts(),read:async()=>{reads++;return {...good,receipt:null};}}),/MIGRATION_UNCONFIRMED/);assert.equal(reads,3);
});
test('BUG-V2-001 refuses divergent route, head, receipt or hash',async()=>{
 for(const [snapshot,error] of [[{...good,route:{...good.route,seed:id(3)}},/ROUTE_DIVERGENCE/],[{...good,head:{...good.head,revision:2}},/SEED_DIVERGENCE/],[{...good,receipt:{...good.receipt,operationId:id(3)}},/SEED_RECEIPT/]])await assert.rejects(confirmMigrationV2({...opts(),read:async()=>snapshot}),error);
 await assert.rejects(confirmMigrationV2({...opts(),sha:async()=>'b'.repeat(64)}),/V2_HASH/);
});
test('BUG-V2-001 changed session and denied read never confirm or retry writes',async()=>{
 let current=true,reads=0;await assert.rejects(confirmMigrationV2({...opts(),isCurrent:()=>current,read:async()=>{reads++;current=false;return good;}}),/SESSION_CHANGED/);assert.equal(reads,1);
 reads=0;await assert.rejects(confirmMigrationV2({...opts(),read:async()=>{reads++;throw Error('permission-denied');}}),/permission-denied/);assert.equal(reads,1);
});
const code=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
function worker({hit,network=async()=>new Response('fresh'),put=async()=>{},open}={}){
 const listeners={};const cache={match:async()=>hit,put};
 runInNewContext(code,{URL,Request,Response,caches:{open:open??(async()=>cache)},fetch:network,self:{location:{origin:'https://example.test'},registration:{scope:'https://example.test/hml/'},addEventListener:(n,fn)=>listeners[n]=fn}});
 let response,lifetime;listeners.fetch({request:new Request('https://example.test/hml/css/styles.css'),respondWith:p=>response=p,waitUntil:p=>lifetime=p});
 return {response,lifetime,cache};
}
test('BUG-V2-002 clone precedes body consumption even when cache open is delayed',async()=>{
 let release,stored;const gate=new Promise(r=>release=r);
 // The network resolves while Cache Storage is delayed. Consume network response first.
 const response=new Response('fresh');let captured;
 const w=worker({network:async()=>response,open:()=>gate});
 await Promise.resolve();await Promise.resolve();
 // Simulate the browser consuming the original at the earliest possible point.
 assert.equal(await response.text(),'fresh');
 release({match:async()=>undefined,put:async(_,copy)=>{captured=await copy.text();}});
 assert.equal(await w.response,response);await w.lifetime;assert.equal(captured,'fresh');
});
test('BUG-V2-002 cache hit is served and refresh stays alive',async()=>{
 let saved;const w=worker({hit:new Response('cached'),put:async(_,copy)=>{saved=await copy.text();}});
 assert.equal(await (await w.response).text(),'cached');await w.lifetime;assert.equal(saved,'fresh');
});
test('BUG-V2-002 cache put failure does not break network and network failure serves offline cache',async()=>{
 const w=worker({put:async()=>{throw Error('quota');}});assert.equal(await (await w.response).text(),'fresh');await w.lifetime;
 const offline=worker({hit:new Response('offline'),network:async()=>{throw Error('offline');}});assert.equal(await (await offline.response).text(),'offline');await offline.lifetime;
 const miss=worker({network:async()=>{throw Error('offline');}});assert.equal((await miss.response).type,'error');await miss.lifetime;
});
