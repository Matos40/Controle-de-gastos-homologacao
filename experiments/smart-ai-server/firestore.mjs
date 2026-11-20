const ref = name => ({
  name,
  collection: segment => ({doc: id => ref(name + '/' + segment + '/' + id)}),
});
const encode = value => {
  if (value === null) return {nullValue:null};
  if (typeof value === 'boolean') return {booleanValue:value};
  if (typeof value === 'string') return {stringValue:value};
  if (Number.isSafeInteger(value)) return {integerValue:String(value)};
  if (Array.isArray(value)) return {arrayValue:{values:value.map(encode)}};
  if (value && typeof value === 'object' && !Array.isArray(value)) return {mapValue:{fields:fields(value)}};
  throw Error('INVALID_DOCUMENT');
};
const fields = data => Object.fromEntries(Object.entries(data).map(([k,v])=>[k,encode(v)]));
const decode = value => {
  if ('integerValue' in value) {
    const n=Number(value.integerValue);
    if (!Number.isSafeInteger(n)) throw Error('INVALID_DOCUMENT');
    return n;
  }
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) return (value.arrayValue.values??[]).map(decode);
  if ('mapValue' in value) return unpack(value.mapValue.fields ?? {});
  throw Error('INVALID_DOCUMENT');
};
const unpack = data => Object.fromEntries(Object.entries(data).map(([k,v])=>[k,decode(v)]));

// The emulator accepts this synthetic authorization header. This adapter has no remote mode.
export function createEmulatorStore(signal, transport=fetch) {
  const db = 'projects/demo-raytech-v340/databases/(default)';
  const base = 'http://127.0.0.1:18080/v1/' + db + '/documents';
  return createRestStore(db, base, async () => 'owner', signal, transport);
}

export function createRestStore(db, base, accessToken, signal, transport=fetch, {abortedRetries=0}={}) {
  async function call(method, body, requestSignal=signal) {
    const r = await transport(base + ':' + method,{method:'POST',redirect:'manual',signal:requestSignal,
      headers:{authorization:'Bearer ' + await accessToken(),'content-type':'application/json'},body:JSON.stringify(body)});
    if (r.status===409 && abortedRetries>0) {
      const body=await r.json().catch(()=>null);
      if(body?.error?.status==='ABORTED')throw Error('FIRESTORE_TRANSACTION_ABORTED');
    }
    if (!r.ok) throw Error('FIRESTORE_UNAVAILABLE');
    return r.json();
  }
  async function runOnce(run, options) {
      const readOnly=options?.readOnly===true;
      const {transaction} = await call('beginTransaction',{options:readOnly?{readOnly:{}}:{readWrite:{}}});
      if (typeof transaction!=='string' || !transaction) throw Error('FIRESTORE_UNAVAILABLE');
      const writes=[];
      const queue=(r,data,kind)=>{
        const write={update:{name:r.name,fields:fields(data)}};
        if(kind==='create')write.currentDocument={exists:false};
        if(kind==='update'){write.currentDocument={exists:true};write.updateMask={fieldPaths:Object.keys(data)};}
        writes.push(write);
      };
      async function getAll(...refs) {
        if (writes.length) throw Error('READ_AFTER_WRITE');
        const results=await call('batchGet',{documents:refs.map(r=>r.name),transaction});
        const mapped=new Map(results.map(row=>row.found
          ? [row.found.name,{exists:true,data:()=>{
            const data=unpack(row.found.fields??{});
            if(row.found.name.startsWith(db+'/documents/raytechV345Accounts/'))delete data.limits;
            return data;
          }}]
          : [row.missing,{exists:false,data:()=>undefined}]));
        return refs.map(r=>{
          if(!mapped.has(r.name))throw Error('MISSING_SNAPSHOT');
          return mapped.get(r.name);
        });
      }
      let committed=false;
      try {
        async function findByIdPrefix(collection,prefix,fieldsToRead) {
          if(writes.length||!/^[A-Za-z0-9_]{1,80}$/.test(collection)||!/^[A-Za-z0-9_-]{2,128}$/.test(prefix))throw Error('INVALID_QUERY');
          const name=db+'/documents/'+collection+'/'+prefix;
          const condition=(op,referenceValue)=>({fieldFilter:{field:{fieldPath:'__name__'},op,value:{referenceValue}}});
          const rows=await call('runQuery',{transaction,structuredQuery:{from:[{collectionId:collection}],
            select:{fields:fieldsToRead.map(fieldPath=>({fieldPath}))},
            where:{compositeFilter:{op:'AND',filters:[condition('GREATER_THAN_OR_EQUAL',name),condition('LESS_THAN',name+'\uf8ff')]}},
            orderBy:[{field:{fieldPath:'__name__'},direction:'ASCENDING'}],limit:20}});
          return rows.filter(row=>row.document).map(({document})=>({
            id:document.name.split('/').at(-1),
            data:()=>unpack(document.fields??{}),
          }));
        }
        const result=await run({getAll,findByIdPrefix,get:async r=>(await getAll(r))[0],
          set:(r,d)=>queue(r,d,'set'),update:(r,d)=>queue(r,d,'update'),create:(r,d)=>queue(r,d,'create')});
        if(writes.length){await call('commit',{transaction,writes});committed=true;}
        return result;
      } finally {
        if(!committed)await call('rollback',{transaction},AbortSignal.timeout(500)).catch(()=>{});
      }
  }
  return {
    collection: name => ({doc:id=>ref(db+'/documents/'+name+'/'+id)}),
    async runTransaction(run, options) {
      for(let attempt=0;;attempt++){
        try{return await runOnce(run,options);}
        catch(error){
          if(error.message!=='FIRESTORE_TRANSACTION_ABORTED'||attempt>=abortedRetries)throw error;
          await delay(25+Math.floor(Math.random()*75),undefined,{signal});
        }
      }
    },
  };
}
import {setTimeout as delay} from 'node:timers/promises';

