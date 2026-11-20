import {deflateSync} from 'node:zlib';
import {createHash} from 'node:crypto';

const sizes=[100*1024,500*1024,2*1024*1024,10*1024*1024];
const lines=['LOJA TESTE','2026-11-07','BRL 12.34','1/1'];

function pdf(size){
 const stream=lines.map((line,i)=>`BT /F1 22 Tf 55 ${740-i*36} Td (${line}) Tj ET`).join('\n');
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
 let content='%PDF-1.4\n';
 const offsets=objects.map((object,i)=>{const at=content.length;content+=`${i+1} 0 obj\n${object}\nendobj\n`;return at;});
 const tail=offset=>'xref\n0 6\n0000000000 65535 f \n'+offsets.map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+
  `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF\n`;
 const gap=size-content.length-tail(size).length;
 const line='%'+'.'.repeat(78)+'\n',remainder=gap%80;
 content+=line.repeat(Math.floor(gap/80))+(remainder>1?'%'+'.'.repeat(remainder-2)+'\n':remainder===1?'\n':'');
 return Buffer.from(content+tail(content.length));
}

const glyphs={
 ' ':0x0000,L:0x4927,O:0x7b6f,J:0x124e,A:0x7bed,T:0x7492,E:0x79e7,S:0x79cf,B:0x6bae,R:0x6bad,
 '0':0x7b6f,'1':0x2492,'2':0x73e7,'3':0x73cf,'4':0x5bc9,'5':0x79cf,'6':0x79ef,
 '7':0x7249,'8':0x7bef,'9':0x7bcf,'-':0x01c0,'.':0x0002,'/':0x12a4,
};
const crcTable=Uint32Array.from({length:256},(_,n)=>{
 let value=n;for(let i=0;i<8;i++)value=(value>>>1)^((value&1)?0xedb88320:0);return value;
});
function chunk(type,data){
 const out=Buffer.alloc(data.length+12);
 out.writeUInt32BE(data.length);out.write(type,4);data.copy(out,8);
 let crc=0xffffffff;
 for(let i=4;i<out.length-4;i++)crc=(crc>>>8)^crcTable[(crc^out[i])&255];
 out.writeUInt32BE((crc^0xffffffff)>>>0,out.length-4);
 return out;
}
const width=256,height=150,scale=5;
const pixels=Buffer.alloc((width+1)*height,255);
for(let y=0;y<height;y++)pixels[y*(width+1)]=0;
for(const [row,line] of lines.entries())for(const [col,letter] of [...line].entries()){
 const glyph=glyphs[letter];
 for(let y=0;y<5;y++)for(let x=0;x<3;x++)if(glyph&(1<<(14-y*3-x))){
  const left=12+col*4*scale+x*scale,top=8+row*7*scale+y*scale;
  for(let p=0;p<scale;p++)pixels.fill(0,(top+p)*(width+1)+1+left,(top+p)*(width+1)+1+left+scale);
 }
}
const header=Buffer.alloc(13);
header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;
const start=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels))]);
const end=chunk('IEND',Buffer.alloc(0));
function png(size){
 const contents=Buffer.alloc(size-start.length-end.length-12,46);
 contents.write('Synthetic padding\0',0,'latin1');
 return Buffer.concat([start,chunk('tEXt',contents),end]);
}

export function* invoices(){
 for(const size of sizes)for(const [mimeType,make] of [['application/pdf',pdf],['image/png',png]]){
  const bytes=make(size);
  if(bytes.length!==size)throw Error('FIXTURE_SIZE_MISMATCH');
  yield {mimeType,bytes,sha256:createHash('sha256').update(bytes).digest('hex')};
 }
}
