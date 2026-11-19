import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createWorker} from './worker.mjs';
import {verifyEmulatorToken} from './auth.mjs';
import {geminiProvider} from './gemini.mjs';

const runtime={GCLOUD_PROJECT:'demo-raytech-v340',FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:19099',
  FIRESTORE_EMULATOR_HOST:'127.0.0.1:18080',PROVIDER:'simulated'};
const base='http://127.0.0.1:8787/v1/invoices';
const b64=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
const claims={aud:'demo-raytech-v340',iss:'https://securetoken.google.com/demo-raytech-v340',sub:'synthetic',user_id:'synthetic',iat:100,auth_time:100,exp:200};
const token=(patch={},alg='none')=>b64({alg})+'.'+b64({...claims,...patch})+'.';

test('only loopback, demo project and the configured origin can reach dependencies',async()=>{
  let calls=0;const worker=createWorker(()=>{calls++;throw Error('unexpected');});
  const post=(url,headers={})=>new Request(url,{method:'POST',headers});
  assert.equal((await worker.fetch(post(base),{...runtime,GCLOUD_PROJECT:'other'})).status,503);
  assert.equal((await worker.fetch(post('https://example.test/v1/invoices'),runtime)).status,404);
  assert.equal((await worker.fetch(post(base,{origin:'https://example.test'}),runtime)).status,403);
  assert.equal((await worker.fetch(post(base),runtime)).status,401);
  assert.equal(calls,0);
  const allowed=await worker.fetch(new Request(base,{method:'OPTIONS',headers:{origin:'http://127.0.0.1:8787'}}),runtime);
  assert.equal(allowed.headers.get('access-control-allow-origin'),'http://127.0.0.1:8787');
});

test('token checks reject wrong issuer, audience, expiry, mismatch, future and revoked credentials',async()=>{
  const lookup=()=>Response.json({users:[{localId:'synthetic',validSince:'100'}]});
  const verify=(jwt,handler=lookup)=>verifyEmulatorToken(jwt,undefined,handler,150000);
  assert.deepEqual(await verify(token()),{uid:'synthetic'});
  for(const jwt of ['garbage',token({aud:'other'}),token({iss:'https://evil.test'}),token({exp:150}),
    token({user_id:'different'}),token({iat:151}),token({},'RS256')]) await assert.rejects(verify(jwt));
  await assert.rejects(verify(token(),()=>Response.json({users:[{localId:'synthetic',validSince:'101'}]})));
  await assert.rejects(verify(token(),()=>Response.json({users:[{localId:'synthetic',disabled:true}]})));
});

test('Gemini transport uses fixed host, header-only secret, deadline and schema; rejects truncated output',async()=>{
  const fixture='fake-synthetic-not-an-api-credential';
  const doc={mimeType:'application/pdf',bytes:Buffer.from('%PDF-fixture'),signal:AbortSignal.timeout(200)};
  const items=[{title:'Compra sintética',date:null,installmentValue:1,isInstallment:false,currentInstallment:1,installments:1,totalAmount:1}];
  let calls=0;
  const mock=async(url,request)=>{
    calls++;
    assert.equal(new URL(url).hostname,'generativelanguage.googleapis.com');
    assert.equal(request.headers['x-goog-api-key'],fixture);
    assert.equal(request.signal,doc.signal);
    const body=JSON.parse(request.body);
    assert.equal(body.generationConfig.maxOutputTokens,4096);
    assert.equal(body.tools,undefined);
    assert.ok(!request.body.includes(fixture));
    return Response.json({candidates:[{finishReason:calls===1?'STOP':'MAX_TOKENS',content:{parts:[{text:JSON.stringify(items)}]}}]});
  };
  const provider=geminiProvider(fixture,mock);
  assert.deepEqual(await provider(doc),items);
  await assert.rejects(provider(doc),/INVALID_PROVIDER_RESPONSE/);
  assert.equal(calls,2);
});

test('Firestore availability failure stops before Gemini',async()=>{
  let gemini=0;
  const now=Math.floor(Date.now()/1000);
  const worker=createWorker(url=>{
    if(url.includes('19099'))return Response.json({users:[{localId:'synthetic'}]});
    if(url.includes('18080'))return new Response(null,{status:503});
    gemini++;
    throw Error('unexpected');
  });
  const request=new Request(base,{method:'POST',headers:{authorization:'Bearer '+token({iat:now,auth_time:now,exp:now+60}),
    'content-type':'application/json','x-request-id':crypto.randomUUID()},body:'{}'});
  const response=await worker.fetch(request,{...runtime,PROVIDER:'gemini-local',GEMINI_CONFIRMED_FREE_DAILY_LIMIT:1});
  assert.equal(response.status,503);
  assert.equal(gemini,0);
});
