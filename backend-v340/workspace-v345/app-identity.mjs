// Build-only PNG transformation. No new dependency; original artwork remains untouched.
import {inflateSync,deflateSync} from 'node:zlib';
const signature=Buffer.from([137,80,78,71,13,10,26,10]);
const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
export function decodeIcon(bytes){
 if(!bytes.subarray(0,8).equals(signature))throw Error('Invalid PNG');
 let w,h,channels;const chunks=[];
 for(let i=8;i<bytes.length;){
  const n=bytes.readUInt32BE(i),type=bytes.toString('ascii',i+4,i+8),data=bytes.subarray(i+8,i+8+n);i+=n+12;
  if(type==='IHDR'){w=data.readUInt32BE(0);h=data.readUInt32BE(4);channels=data[9]===6?4:data[9]===2?3:0;if(data[8]!==8||!channels||data[10]||data[11]||data[12])throw Error('Unsupported icon PNG format');}
  if(type==='IDAT')chunks.push(data);
  if(type==='IEND')break;
 }
 if(!w||!h||w!==h||w>1024)throw Error('Invalid official icon dimensions');
 const raw=inflateSync(Buffer.concat(chunks)),stride=w*channels,pixels=Buffer.alloc(w*h*channels);
 if(raw.length!==(stride+1)*h)throw Error('Invalid scanlines');
 for(let y=0;y<h;y++){
  const filter=raw[y*(stride+1)];if(filter>4)throw Error('Invalid filter');
  for(let x=0;x<stride;x++){const i=y*stride+x,a=x>=channels?pixels[i-channels]:0,b=y?pixels[i-stride]:0,c=y&&x>=channels?pixels[i-stride-channels]:0;pixels[i]=(raw[y*(stride+1)+1+x]+[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter])&255;}
 }
 const rgba=Buffer.alloc(w*h*4);
 for(let i=0;i<w*h;i++){pixels.copy(rgba,i*4,i*channels,i*channels+3);rgba[i*4+3]=channels===4?pixels[i*channels+3]:255;}
 return {w,h,rgba};
}
function chunk(type,data){
 const head=Buffer.alloc(8);head.writeUInt32BE(data.length);head.write(type,4,'ascii');let crc=0xffffffff;
 for(const v of Buffer.concat([head.subarray(4),data])){crc^=v;for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
 const tail=Buffer.alloc(4);tail.writeUInt32BE((crc^0xffffffff)>>>0);return Buffer.concat([head,data,tail]);
}
function encode({w,h,rgba}){
 const header=Buffer.alloc(13);header.writeUInt32BE(w);header.writeUInt32BE(h,4);header[8]=8;header[9]=6;
 const rows=Buffer.alloc((w*4+1)*h);for(let y=0;y<h;y++)rgba.copy(rows,y*(w*4+1)+1,y*w*4,(y+1)*w*4);
 return Buffer.concat([signature,chunk('IHDR',header),chunk('IDAT',deflateSync(rows,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
export function transparentOfficialIcon(bytes){
 const decoded=decodeIcon(bytes),{w,h,rgba}=decoded,bg=Array.from(rgba.subarray(0,3)),seen=new Uint8Array(w*h),queue=new Int32Array(w*h);let head=0,tail=0;
 // Only near-background pixels connected to the perimeter may become transparent.
 // Interior dark blue surfaces, lock and circuits are never recolored.
 const add=i=>{if(seen[i])return;seen[i]=1;const k=i*4;if(rgba[k+3]===0||Math.max(...bg.map((v,c)=>Math.abs(v-rgba[k+c])))<=12)queue[tail++]=i;};
 for(let x=0;x<w;x++){add(x);add((h-1)*w+x);}
 for(let y=0;y<h;y++){add(y*w);add(y*w+w-1);}
 while(head<tail){const i=queue[head++],x=i%w,y=Math.floor(i/w);rgba[i*4+3]=0;if(x)add(i-1);if(x<w-1)add(i+1);if(y)add(i-w);if(y<h-1)add(i+w);}
 if(tail<w*h*.1||tail>w*h*.6||rgba[(Math.floor(h/2)*w+Math.floor(w/2))*4+3]!==255)throw Error('Unexpected official icon silhouette');
 return encode(decoded);
}
