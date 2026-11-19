import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import {createFirebaseVerifier} from './auth.mjs';
import {createGoogleAccessToken} from './google-access.mjs';
import {createRemoteWorker, boundedBinary} from './worker.mjs';
import {encodeGeminiBody} from '../gemini.mjs';
import {validateInvoiceBytes, MAX_BYTES} from '../legacy/invoice.mjs';

const project = 'gen-lang-client-0593667072';
const forbiddenFetch = () => assert.fail('unexpected network request');

test('remote worker rejects emulator bindings and other project IDs without network access', async () => {
  const worker = createRemoteWorker(forbiddenFetch);
  const request = new Request('https://worker.example.invalid/v1/invoices', {method:'POST'});
  assert.equal((await worker.fetch(request, {FIREBASE_PROJECT_ID:'raytech-cg-producao'})).status, 503);
  assert.equal((await worker.fetch(request, {
    FIREBASE_PROJECT_ID:project, FIREBASE_AUTH_EMULATOR_HOST:'127.0.0.1:19099',
  })).status, 503);
});

test('remote worker rejects browser origins and malformed request IDs before I/O', async () => {
  const worker = createRemoteWorker(forbiddenFetch);
  const env = {FIREBASE_PROJECT_ID:project};
  const request = headers => new Request('https://worker.example.invalid/v1/invoices', {
    method:'POST', headers,
  });
  assert.equal((await worker.fetch(request({origin:'https://example.invalid'}), env)).status, 403);
  assert.equal((await worker.fetch(request({'x-request-id':'bad'}), env)).status, 400);
  assert.equal((await worker.fetch(request({'x-request-id':randomUUID()}), env)).status, 415);
});

test('Firebase verifier rejects unsigned and foreign-project tokens without requesting credentials', async () => {
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const verify = createFirebaseVerifier(project);
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    sub:'synthetic', aud:project, iss:'https://securetoken.google.com/' + project,
    iat:now - 1, auth_time:now - 2, exp:now + 60,
  };
  for (const [alg, payload] of [['none', claims], ['RS256', {...claims, aud:'raytech-cg-producao'}],
    ['RS256', {...claims, exp:now - 1}]]) {
    const token = encode({alg, kid:'fake'}) + '.' + encode(payload) + '.notASignature';
    await assert.rejects(verify(token, forbiddenFetch, forbiddenFetch), /INVALID_TOKEN/);
  }
});

test('Google credential rejects service accounts from other projects and unexpected identities', () => {
  const credential = {
    type:'service_account', project_id:project, client_email:'unrelated@' + project + '.iam.gserviceaccount.com',
  };
  assert.throws(() => createGoogleAccessToken(project, JSON.stringify(credential)), /INVALID_EXPERIMENT_CREDENTIAL/);
  assert.throws(() => createGoogleAccessToken(project, JSON.stringify({
    ...credential, project_id:'raytech-cg-homologacao',
  })), /INVALID_EXPERIMENT_CREDENTIAL/);
});

test('binary reader enforces exact size, the 10 MiB cap and file signature', async () => {
  const file=Buffer.alloc(MAX_BYTES,32);
  file.write('%PDF-1.4\n');
  file.write('%%EOF\n',file.length-6);
  const read=(size,bytes)=>boundedBinary(new Request('https://worker.example.invalid/v1/invoices',{
    method:'POST',headers:{'content-length':String(size)},body:bytes,
  }),'application/pdf',new AbortController().signal);
  const result=await read(MAX_BYTES,file);
  assert.deepEqual(validateInvoiceBytes(result.mimeType,result.bytes).bytes,file);
  await assert.rejects(read(MAX_BYTES+1,file),/FILE_TOO_LARGE/);
  await assert.rejects(read(20,Buffer.alloc(4)),/INVALID_FILE/);
  await assert.rejects(read(2,Buffer.alloc(4)),/INVALID_FILE/);
  assert.throws(()=>validateInvoiceBytes('application/pdf',Buffer.alloc(64)),/INVALID_FILE/);
});

test('streamed Gemini payload preserves base64 across chunk and padding boundaries', async () => {
  for(const length of [1,49152,49153,98306]){
    const bytes=Buffer.alloc(length,0xa5);
    const payload={contents:[{parts:[{inlineData:{mimeType:'application/pdf',data:'raytech-inline-document'}}]}]};
    const parsed=await new Response(encodeGeminiBody(payload,bytes,true)).json();
    assert.equal(parsed.contents[0].parts[0].inlineData.data,bytes.toString('base64'));
  }
});
