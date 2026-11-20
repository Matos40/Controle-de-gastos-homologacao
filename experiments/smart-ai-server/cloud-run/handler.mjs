import {Buffer} from 'node:buffer';
import {createRestStore} from '../firestore.mjs';
import {geminiProvider} from '../gemini.mjs';
import {authorizePremium, FEATURE} from './policy.mjs';
import {extractInvoice, MAX_BYTES, validateInvoiceBytes} from './invoice.mjs';
import {validRequestId} from '../legacy/usage.mjs';
import {createCommercialStore} from './store.mjs';
import {createFirebaseVerifier} from '../remote/auth.mjs';
import {handleSmartAdmin} from './admin.mjs';
import {createRuntimeAccess} from './runtime.mjs';
import {trustedOrigin} from './cors.mjs';
import {startObservation} from './telemetry.mjs';

const requestCap = 4 * Math.ceil(MAX_BYTES / 3) + 1024;
const experimentProject = 'gen-lang-client-0593667072';
const binaryTypes = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);
const reply = (status, body) => Response.json(body, {status, headers:{
  'cache-control':'no-store', 'x-content-type-options':'nosniff',
}});

export async function readCreditBalance(request,{verifyToken,readCredits}) {
  const bearer=request.headers.get('authorization');
  if(!bearer||bearer.length>8192||!/^Bearer [^\s,]+$/.test(bearer))return reply(401,{error:'ACCESS_DENIED'});
  let uid;
  try { ({uid}=await verifyToken(bearer.slice(7))); }
  catch { return reply(401,{error:'ACCESS_DENIED'}); }
  if(typeof uid!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(uid))return reply(401,{error:'ACCESS_DENIED'});
  try {
    const balance=await readCredits(uid);
    if(!balance)return reply(403,{error:'ACCESS_DENIED'});
    const {plan,remaining,busy,month}=balance;
    const [year,number]=month.split('-').map(Number);
    const renewal=new Date(Date.UTC(year,number,1)).toISOString().slice(0,10);
    return reply(200,{plan,remaining,busy,nextRenewalDate:plan==='premium'?renewal:null});
  } catch { return reply(503,{error:'USAGE_UNAVAILABLE'}); }
}

async function boundedJson(request, signal, limit=requestCap) {
  const declared = request.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > limit)) {
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
      if (length > limit) throw Error('FILE_TOO_LARGE');
      chunks.push(value);
    }
    signal.throwIfAborted();
    return JSON.parse(Buffer.concat(chunks, length).toString('utf8'));
  } finally {
    signal.removeEventListener('abort', cancel);
    await reader.cancel().catch(() => {});
  }
}

export async function boundedBinary(request, mimeType, signal) {
  const declared = request.headers.get('content-length') ?? '';
  if (!/^\d+$/.test(declared)) throw Error('INVALID_FILE');
  const length = Number(declared);
  if (!Number.isSafeInteger(length) || length < 1) throw Error('INVALID_FILE');
  if (length > MAX_BYTES) throw Error('FILE_TOO_LARGE');
  const reader = request.body?.getReader();
  if (!reader) throw Error('INVALID_FILE');
  const bytes = Buffer.allocUnsafe(length);
  let offset = 0;
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', cancel, {once:true});
  try {
    while (offset < length) {
      signal.throwIfAborted();
      const {done, value} = await reader.read();
      if (done || value.length > length-offset) throw Error('INVALID_FILE');
      bytes.set(value, offset);
      offset += value.length;
    }
    signal.throwIfAborted();
    if (!(await reader.read()).done) throw Error('INVALID_FILE');
    return {mimeType,bytes};
  } catch (error) {
    bytes.fill(0,0,offset);
    throw error;
  } finally {
    signal.removeEventListener('abort', cancel);
    await reader.cancel().catch(() => {});
  }
}

export function createCloudRunHandler(transport = fetch,{connect,writeTelemetry=event=>console.log(JSON.stringify(event))}={}) {
  const verifyFirebase = createFirebaseVerifier(experimentProject);
  let runtimeAccess;
  return {async fetch(request, env) {
    const url = new URL(request.url);
    const credits=url.pathname==='/v1/credits';
    const admin=url.pathname==='/v1/admin/ai';
    if (url.protocol !== 'https:' || (!credits&&!admin&&url.pathname !== '/v1/invoices') || url.search) {
      return reply(404, {error:'NOT_FOUND'});
    }
    if (request.method !== (credits?'GET':'POST')) return reply(405, {error:'METHOD_NOT_ALLOWED'});
    const origin=request.headers.get('origin');
    if (origin!==null && !trustedOrigin(origin,env.SMART_AI_UI_ORIGIN))return reply(403,{error:'ACCESS_DENIED'});
    if (env.FIREBASE_PROJECT_ID !== experimentProject ||
        env.FIRESTORE_EMULATOR_HOST || env.FIREBASE_AUTH_EMULATOR_HOST) {
      return reply(503, {error:'EXPERIMENT_UNAVAILABLE'});
    }
    const headers = {
      authorization:request.headers.get('authorization'),
      'x-request-id':request.headers.get('x-request-id'),
    };
    if (!credits&&!admin&&!validRequestId(headers['x-request-id'])) return reply(400, {error:'INVALID_REQUEST_ID'});
    const contentType = request.headers.get('content-type') ?? '';
    const binary = false; // JSON transport only for initial Cloud Run candidate.
    if (!credits && !binary && !/^application\/json(?:;|$)/i.test(contentType)) {
      return reply(415, {error:'INVALID_FILE'});
    }
    const deadline = AbortSignal.any([AbortSignal.timeout(30000), request.signal]);
    const start = Date.now();
    const counts = {subrequests:0, requestedFirestoreReads:0, confirmedFirestoreWrites:0,firestoreQueries:0};
    const observe=env.SMART_AI_TELEMETRY==='true'?startObservation(url.pathname,writeTelemetry):()=>{};
    let providerMetrics;
    const send=(status,body)=>{observe(status,{...counts,...providerMetrics});return reply(status,body);};
    const counted = async (target, options) => {
      if (++counts.subrequests > 60) throw Error('EXPERIMENT_SUBREQUEST_LIMIT');
      if (target.endsWith(':batchGet')) counts.requestedFirestoreReads += JSON.parse(options.body).documents.length;
      if (target.endsWith(':runQuery')) counts.firestoreQueries++;
      const response = await transport(target, options);
      if (response.ok && target.endsWith(':commit')) counts.confirmedFirestoreWrites += JSON.parse(options.body).writes.length;
      return response;
    };
    try {
      const dbName = 'projects/' + experimentProject + '/databases/(default)';
      let db,verifyToken;
      if(connect){({db,verifyToken}=connect(deadline,counted));}
      else{
        runtimeAccess ??= createRuntimeAccess(env.SMART_AI_RUNTIME_IDENTITY);
        const access=()=>runtimeAccess(counted,deadline);
        db=createRestStore(dbName,'https://firestore.googleapis.com/v1/'+dbName+'/documents',
          access,deadline,counted,{abortedRetries:3});
        verifyToken=token=>verifyFirebase(token,access,counted,deadline);
      }
      if(admin){
        let body;
        try{body=await boundedJson(request,deadline,4096);}
        catch(error){return send(error.message==='FILE_TOO_LARGE'?413:400,{error:'INVALID_REQUEST'});}
        const result=await handleSmartAdmin(request,body,{db,verifyToken});
        return send(result.status,result.body);
      }
      const {readCredits,reserveUsage,finishOutcome}=createCommercialStore(db);
      if(credits){
        const response=await readCreditBalance(request,{verifyToken,readCredits});
        observe(response.status,counts);
        return response;
      }
      const readPermissions = uid => db.runTransaction(async tx => {
        const [account, role] = await tx.getAll(
          db.collection('raytechV345Accounts').doc(uid), db.collection('raytechV345Roles').doc(uid));
        return {account:account.data(), role:role.data()};
      }, {readOnly:true});
      const auth = await authorizePremium({method:'POST', headers, body:{feature:FEATURE}},
        {verifyToken, readPermissions});
      if (auth.status !== 200) return send(auth.status, {error:'ACCESS_DENIED'});
      let body;
      try {
        body = binary
          ? await boundedBinary(request, contentType, deadline)
          : await boundedJson(request, deadline);
      }
      catch (error) {
        if (deadline.aborted) return send(504, {error:'TIMEOUT'});
        return error.message === 'FILE_TOO_LARGE'
          ? send(413, {error:'FILE_TOO_LARGE'}) : send(400, {error:'INVALID_FILE'});
      }
      const provider = geminiProvider(env.RAYTECH_GEMINI_API_KEY, counted,
        metrics => { providerMetrics = metrics; }, binary);
      let result;
      try {
        result = await extractInvoice({method:'POST',headers,body},{
          verifyToken, readPermissions, reserveUsage, finishOutcome,
          provider:file => provider({...file,signal:AbortSignal.any([file.signal, deadline])}),
        }, {timeoutMs:27000, decodeFile:binary ? file => validateInvoiceBytes(file.mimeType,file.bytes) : undefined});
      } finally {
        if(binary)body.bytes.fill(0);
      }
      if (result.status === 200) {
        result.body.simulated = false;
        result.body.metrics = {...counts, ...providerMetrics, wallMs:Date.now() - start};
      }
      return send(result.status, result.body);
    } catch {
      return deadline.aborted ? send(504, {error:'TIMEOUT'}) : send(503, {error:'EXPERIMENT_UNAVAILABLE'});
    }
  }};
}

export default createCloudRunHandler();
