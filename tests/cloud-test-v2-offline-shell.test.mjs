import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const code=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
function boot({online=true,network=async()=>new Response('online'),shell='v18 shell',timer=setTimeout,cancel=clearTimeout}={}){
 const handlers={},calls={open:[],match:[],network:0,global:0,put:0};
 const cache={match:async key=>{calls.match.push(key);return shell===null?undefined:new Response(shell);},put:async()=>{calls.put++;}};
 const caches={open:async name=>{calls.open.push(name);return cache;},match:async()=>{calls.global++;return new Response('old v15 shell');}};
 runInNewContext(code,{URL,Request,Response,AbortController,setTimeout:timer,clearTimeout:cancel,caches,fetch:(...args)=>{calls.network++;return network(...args);},self:{navigator:{onLine:online},location:{origin:'https://example.test'},registration:{scope:'https://example.test/hml/'},addEventListener:(n,fn)=>handlers[n]=fn}});
 function navigate(url='https://example.test/hml/?mode=cloud'){
  let result;handlers.fetch({request:{method:'GET',mode:'navigate',url},respondWith:p=>result=p});return result;
 }
 return {navigate,calls};
}
test('BUG-V2-003 offline navigation opens active release, never fetches or selects old cache',async()=>{
 const {navigate,calls}=boot({online:false,network:()=>new Promise(()=>{})});
 assert.equal(await (await navigate()).text(),'v18 shell');assert.deepEqual(calls.open,['homolog-controle-gastos-shell-v18']);assert.deepEqual(calls.match,['./index.html']);assert.equal(calls.network,0);assert.equal(calls.global,0);
});
test('BUG-V2-003 network rejection falls back to current release only',async()=>{
 const {navigate,calls}=boot({network:async()=>{throw Error('offline');}});
 assert.equal(await (await navigate()).text(),'v18 shell');assert.equal(calls.global,0);
});
test('BUG-V2-003 stalled network reaches deadline and aborts without blocking shell',async()=>{
 let signal,ms,ended=false;
 const {navigate,calls}=boot({network:(_,opts)=>{signal=opts.signal;return new Promise(()=>{});},timer:(fn,delay)=>{ms=delay;queueMicrotask(fn);return 7;},cancel:id=>{assert.equal(id,7);ended=true;}});
 assert.equal(await (await navigate()).text(),'v18 shell');assert.equal(ms,3500);assert.equal(signal.aborted,true);assert.equal(ended,true);assert.equal(calls.global,0);
});
test('BUG-V2-003 new network HTML never overwrites installed release shell',async()=>{
 const {navigate,calls}=boot({network:async()=>new Response('next release')});
 assert.equal(await (await navigate()).text(),'next release');assert.equal(calls.put,0);
});
test('BUG-V2-003 missing current shell fails closed instead of mixing old release',async()=>{
 const {navigate,calls}=boot({online:false,shell:null});
 assert.equal((await navigate()).type,'error');assert.equal(calls.global,0);
});
test('BUG-V2-003 non-success network response uses current shell and legacy URL still redirects',async()=>{
 const {navigate}=boot({network:async()=>new Response('unavailable',{status:503})});
 assert.equal(await (await navigate()).text(),'v18 shell');
 const redirect=await navigate('https://example.test/hml/cloud-test.html');assert.equal(redirect.status,302);assert.equal(redirect.headers.get('location'),'https://example.test/hml/index.html?mode=cloud');
});
