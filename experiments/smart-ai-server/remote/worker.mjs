import {Buffer} from 'node:buffer';
import {createRestStore} from '../firestore.mjs';
import {geminiProvider} from '../gemini.mjs';
import {authorizePremium, FEATURE} from '../legacy/policy.mjs';
import {extractInvoice, MAX_BYTES} from '../legacy/invoice.mjs';
import {createUsageStore, validRequestId} from '../legacy/usage.mjs';
import {createOutcomeStore} from '../legacy/outcome.mjs';
import {createFirebaseVerifier} from './auth.mjs';
import {createGoogleAccessToken} from './google-access.mjs';

const requestCap = 4 * Math.ceil(MAX_BYTES / 3) + 1024;
const experimentProject = 'gen-lang-client-0593667072';
const reply = (status, body) => Response.json(body, {status, headers:{
  'cache-control':'no-store', 'x-content-type-options':'nosniff',
}});

async function boundedJson(request, signal) {
  const declared = request.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > requestCap)) {
    throw Error('FILE_TOO_LARGE');
  }
  const reader = request.body?.getReader();
  if (!reader) throw Error('INVALID_FILE');
  const chunks = [];
  let length = 0;
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', cancel, {once:true});
  try {
    while (true) {
      signal.throwIfAborted();
      const {done, value} = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > requestCap) throw Error('FILE_TOO_LARGE');
      chunks.push(value);
    }
    signal.throwIfAborted();
    return JSON.parse(Buffer.concat(chunks, length).toString('utf8'));
  } finally {
    signal.removeEventListener('abort', cancel);
    await reader.cancel().catch(() => {});
  }
}

export function createRemoteWorker(transport = fetch) {
  const verifyFirebase = createFirebaseVerifier(experimentProject);
  let googleAccessToken;
  return {async fetch(request, env) {
    const url = new URL(request.url);
    if (url.protocol !== 'https:' || url.pathname !== '/v1/invoices' || url.search) {
      return reply(404, {error:'NOT_FOUND'});
    }
    if (request.method !== 'POST') return reply(405, {error:'METHOD_NOT_ALLOWED'});
    if (request.headers.has('origin')) return reply(403, {error:'ACCESS_DENIED'});
    if (env.FIREBASE_PROJECT_ID !== experimentProject ||
        env.FIRESTORE_EMULATOR_HOST || env.FIREBASE_AUTH_EMULATOR_HOST) {
      return reply(503, {error:'EXPERIMENT_UNAVAILABLE'});
    }
    const headers = {
      authorization:request.headers.get('authorization'),
      'x-request-id':request.headers.get('x-request-id'),
    };
    if (!validRequestId(headers['x-request-id'])) return reply(400, {error:'INVALID_REQUEST_ID'});
    if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') ?? '')) {
      return reply(415, {error:'INVALID_FILE'});
    }
    const deadline = AbortSignal.any([AbortSignal.timeout(30000), request.signal]);
    const start = Date.now();
    const counts = {subrequests:0, requestedFirestoreReads:0, confirmedFirestoreWrites:0};
    const counted = async (target, options) => {
      if (++counts.subrequests > 45) throw Error('EXPERIMENT_SUBREQUEST_LIMIT');
      if (target.endsWith(':batchGet')) counts.requestedFirestoreReads += JSON.parse(options.body).documents.length;
      const response = await transport(target, options);
      if (response.ok && target.endsWith(':commit')) counts.confirmedFirestoreWrites += JSON.parse(options.body).writes.length;
      return response;
    };
    try {
      googleAccessToken ??= createGoogleAccessToken(experimentProject, env.FIREBASE_WORKER_CREDENTIAL);
      const access = () => googleAccessToken(counted, deadline);
      const dbName = 'projects/' + experimentProject + '/databases/(default)';
      const db = createRestStore(dbName, 'https://firestore.googleapis.com/v1/' + dbName + '/documents',
        access, deadline, counted);
      const verifyToken = token => verifyFirebase(token, access, counted, deadline);
      const readPermissions = uid => db.runTransaction(async tx => {
        const [account, role] = await tx.getAll(
          db.collection('raytechV345Accounts').doc(uid), db.collection('raytechV345Roles').doc(uid));
        return {account:account.data(), role:role.data()};
      }, {readOnly:true});
      const auth = await authorizePremium({method:'POST', headers, body:{feature:FEATURE}},
        {verifyToken, readPermissions});
      if (auth.status !== 200) return reply(auth.status, {error:'ACCESS_DENIED'});
      let body;
      try { body = await boundedJson(request, deadline); }
      catch (error) {
        if (deadline.aborted) return reply(504, {error:'TIMEOUT'});
        return error.message === 'FILE_TOO_LARGE'
          ? reply(413, {error:'FILE_TOO_LARGE'}) : reply(400, {error:'INVALID_FILE'});
      }
      let providerMetrics;
      const provider = geminiProvider(env.RAYTECH_GEMINI_API_KEY, counted,
        metrics => { providerMetrics = metrics; });
      const reserveUsage = createUsageStore(db, {
        budget:{day:30, month:60, perAttempt:1}, trackOutcomes:true, workspace:true,
      });
      const result = await extractInvoice({method:'POST',headers,body},{
        verifyToken, readPermissions, reserveUsage, finishOutcome:createOutcomeStore(db),
        provider:file => provider({...file,signal:AbortSignal.any([file.signal, deadline])}),
      }, {timeoutMs:27000});
      if (result.status === 200) {
        result.body.simulated = false;
        result.body.metrics = {...counts, ...providerMetrics, wallMs:Date.now() - start};
      }
      return reply(result.status, result.body);
    } catch {
      return deadline.aborted ? reply(504, {error:'TIMEOUT'}) : reply(503, {error:'EXPERIMENT_UNAVAILABLE'});
    }
  }};
}

export default createRemoteWorker();
