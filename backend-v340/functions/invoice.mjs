import {authorizePremium,FEATURE} from './policy.mjs';
export const MAX_BYTES=10*1024*1024;
export const MAX_ITEMS=1000;
export const TIMEOUT_MS=15000;
const fail=(status,error)=>({status,body:{error}});
const exact=(obj,keys)=>obj!==null&&typeof obj==='object'&&!Array.isArray(obj)&&Object.keys(obj).length===keys.length&&keys.every(k=>Object.hasOwn(obj,k));
const formats={
 'application/pdf':b=>b.length>=14&&/^%PDF-\d\.\d(?:\r|\n)/.test(b.subarray(0,12).toString('ascii'))&&/%%EOF\s*$/.test(b.subarray(-1024).toString('ascii')),
 'image/png':b=>b.length>=33&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&b.toString('ascii',12,16)==='IHDR'&&b.readUInt32BE(8)===13&&b.readUInt32BE(16)>0&&b.readUInt32BE(20)>0&&b.readUInt32BE(16)*b.readUInt32BE(20)<=40000000&&b.subarray(-12).equals(Buffer.from([0,0,0,0,73,69,78,68,174,66,96,130])),
 'image/jpeg':b=>b.length>=8&&b[0]===255&&b[1]===216&&b[2]===255&&b[b.length-2]===255&&b[b.length-1]===217,
 'image/webp':b=>b.length>=20&&b.toString('ascii',0,4)==='RIFF'&&b.readUInt32LE(4)===b.length-8&&b.toString('ascii',8,12)==='WEBP'&&['VP8 ','VP8L','VP8X'].includes(b.toString('ascii',12,16))
};
export function decodeInvoice(body){
 if(!exact(body,['feature','mimeType','data'])||body.feature!==FEATURE||typeof body.mimeType!=='string'||!Object.hasOwn(formats,body.mimeType)||typeof body.data!=='string')throw Error('INVALID_FILE');
 const s=body.data;
 if(s.length>4*Math.ceil(MAX_BYTES/3))throw Error('FILE_TOO_LARGE');
 if(!s.length||s.length%4||!/^[A-Za-z0-9+/]+={0,2}$/.test(s))throw Error('INVALID_FILE');
 const bytes=Buffer.from(s,'base64');
 if(bytes.length>MAX_BYTES)throw Error('FILE_TOO_LARGE');
 if(bytes.toString('base64')!==s||!formats[body.mimeType](bytes))throw Error('INVALID_FILE');
 return {mimeType:body.mimeType,bytes};
}
const money=n=>typeof n==='number'&&Number.isFinite(n)&&n>0&&n<=10000000&&Math.abs(n*100-Math.round(n*100))<1e-5;
const nullableMoney=n=>n===null||money(n);
const count=n=>Number.isInteger(n)&&n>=1&&n<=120;
const date=d=>d===null||typeof d==='string'&&/^20\d{2}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
const keys=['title','date','installmentValue','isInstallment','currentInstallment','installments','totalAmount'];
export function validateResult(items){
 if(!Array.isArray(items)||items.length>MAX_ITEMS)throw Error('INVALID_PROVIDER_RESPONSE');
 return items.map(row=>{
  if(!exact(row,keys)||!(row.title===null||typeof row.title==='string'&&row.title.trim().length>0&&row.title.length<=512&&!/[\x00-\x1f<>]/.test(row.title))||!date(row.date)||!nullableMoney(row.installmentValue)||!nullableMoney(row.totalAmount)||typeof row.isInstallment!=='boolean'||!(row.currentInstallment===null||count(row.currentInstallment))||!(row.installments===null||count(row.installments))||row.currentInstallment!==null&&row.installments!==null&&row.currentInstallment>row.installments||row.installments!==null&&row.isInstallment!==(row.installments>1))throw Error('INVALID_PROVIDER_RESPONSE');
  return Object.fromEntries(keys.map(k=>[k,row[k]]));
 });
}
export async function extractInvoice(req,deps,{timeoutMs=TIMEOUT_MS}={}){
 // Project-specific guard is enforced by the actual HTTP function before any SDK use.
 const authorize=()=>authorizePremium({method:req.method,headers:req.headers,query:req.query,body:{feature:FEATURE}},deps);
 const first=await authorize();
 if(first.status!==200)return fail(first.status,'ACCESS_DENIED');
 let file;
 try{file=decodeInvoice(req.body);}catch(e){return fail(e.message==='FILE_TOO_LARGE'?413:400,e.message==='FILE_TOO_LARGE'?'FILE_TOO_LARGE':'INVALID_FILE');}
 const controller=new AbortController();
 let timer;
 try{
  const result=await Promise.race([
   Promise.resolve().then(()=>deps.provider({...file,signal:controller.signal})),
   new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('TIMEOUT'));},timeoutMs);})
  ]);
  const items=validateResult(result);
  // Re-check account before delivering results; a downgrade during processing is denied.
  const final=await authorize();
  if(final.status!==200)return fail(final.status,'ACCESS_DENIED');
  return {status:200,body:{items,requiresReview:true,simulated:true}};
 }catch(e){return fail(controller.signal.aborted?504:502,controller.signal.aborted?'TIMEOUT':'PROCESSING_FAILED');}
 finally{clearTimeout(timer);controller.abort();file.bytes.fill(0);}
}
