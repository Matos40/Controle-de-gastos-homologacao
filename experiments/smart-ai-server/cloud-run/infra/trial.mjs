import {invoices} from './fixtures.mjs';
import {decodeInvoice} from '../invoice.mjs';
import {FEATURE} from '../policy.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';

// Preparation only. This program has no network or credential input.
const prepared=[];
const [flag,dir]=process.argv.slice(2);
if(flag&&(flag!=='--write'||!dir||process.argv.length!==4))throw Error('Use: node infra/trial.mjs [--write <new-directory>]');
if(dir)await mkdir(dir);
for(const {mimeType,bytes,sha256} of invoices()){
 const body={feature:FEATURE,mimeType,data:bytes.toString('base64')};
 const artifact=decodeInvoice(body);
 if(!artifact.bytes.equals(bytes))throw Error('FIXTURE_ROUNDTRIP_FAILED');
 const fileName='synthetic-invoice-'+bytes.length+(mimeType==='image/png'?'.png':'.pdf');
 if(dir)await writeFile(resolve(dir,fileName),bytes,{flag:'wx'});
 prepared.push({fileName,mimeType,bytes:bytes.length,sha256,jsonBytes:Buffer.byteLength(JSON.stringify(body)),
  expected:{establishment:'LOJA TESTE',date:'2026-11-07',amount:12.34,installments:'1/1'}});
}
const manifest=JSON.stringify({remoteExecutionAuthorized:false,route:'/v1/invoices',method:'POST',fixtures:prepared},null,2)+'\n';
if(dir)await writeFile(resolve(dir,'trial-manifest.json'),manifest,{flag:'wx'});
console.log(manifest);
