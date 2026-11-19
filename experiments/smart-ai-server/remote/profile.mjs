import {generateKeyPairSync,sign,verify} from 'node:crypto';
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const token=Buffer.from('synthetic claims'),signature=sign('RSA-SHA256',token,privateKey);
function measure(fn,n=20) {
 for(let i=0;i<4;i++) fn();
 const start=process.cpuUsage();
 for(let i=0;i<n;i++) fn();
 const {user,system}=process.cpuUsage(start);
 return Math.round((user+system)/n)/1000;
}
for (const size of [102400,10485760]) {
 const file=Buffer.alloc(size,46);file.write('%PDF-1.4\n');file.write('%%EOF\n',size-6);
 const base64=file.toString('base64'),obj={feature:'invoice-ai',mimeType:'application/pdf',data:base64};
 const json=Buffer.from(JSON.stringify(obj)),pieces=[];
 for(let i=0;i<json.length;i+=65536)pieces.push(json.subarray(i,i+65536));
 console.log(JSON.stringify({size,readCopiesMs:measure(()=>Buffer.concat(pieces,json.length).toString('utf8')),parseMs:measure(()=>JSON.parse(json.toString('utf8'))),canonicalRegexMs:measure(()=>/^[A-Za-z0-9+/]+={0,2}$/.test(base64)),decodeMs:measure(()=>Buffer.from(base64,'base64')),reencodeCompareMs:measure(()=>file.toString('base64')===base64),binarySignatureMs:measure(()=>/^%PDF-\d\.\d(?:\r|\n)/.test(file.subarray(0,12).toString('ascii'))&&/%%EOF\s*$/.test(file.subarray(-1024).toString('ascii'))),providerJsonMs:measure(()=>JSON.stringify({...obj,data:file.toString('base64')})),rsaVerifyMs:measure(()=>verify('RSA-SHA256',token,publicKey,signature),200)}));
}
