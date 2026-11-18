// Run from workspace-v345 after extracting the approved icon ZIP locally.
// No remote operations; validates every new binary before editing source files.
import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const source=process.argv[2];
if(!source)throw Error('Usage: node integrate-app-identity.mjs <extracted-icon-directory>');
const expected={
 'raytech-app-192.png':[192,'4fc1e41a64e596cba5e5dcdb61654d01f392b2f1943025d2d8aced7db688d61f'],
 'raytech-app-512.png':[512,'526d411fcb7184547509c67cc934287a238cedaaa7beaeecd17ccdde552beb59'],
 'raytech-app-apple-180.png':[180,'e3054bce142ae58317ded25af7e7b25011a1a5caffe153e6f03fb3ab5a7034d1'],
 'raytech-app-favicon-32.png':[32,'2353a4e955158d5b13014237f45056e3589bbc17c08bf85ec3d449b7fea4f74e']
};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
for(const [name,[size,digest]] of Object.entries(expected)){
 const bytes=await readFile(path.join(source,name));
 if(sha(bytes)!==digest||bytes.readUInt32BE(16)!==size||bytes.readUInt32BE(20)!==size||bytes[25]!==6)throw Error('Invalid approved RGBA PNG: '+name);
}
const m=JSON.parse(await readFile('official/manifest.webmanifest','utf8'));
if(m.id!=='/raytech-cg-homologacao'||m.scope!=='/'||m.start_url!=='/'||m.display!=='standalone')throw Error('Installation identity changed');
m.name=m.short_name='Raytech CG';
m.icons=m.icons.map(icon=>({...icon,src:icon.sizes==='192x192'?'./raytech-app-192.png':icon.sizes==='512x512'?'./raytech-app-512.png':icon.src}));
const replace=(source,old,next)=>{if(!source.includes(old))throw Error('Missing integration anchor: '+old);return source.replace(old,next);};
let html=await readFile('official/index.html','utf8');
html=replace(html,'<link id="faviconLink" rel="icon" type="image/png" href="./raytech-icon-192.png">','<link id="faviconLink" rel="icon" type="image/png" sizes="32x32" href="./raytech-app-favicon-32.png">');
html=replace(html,'<link id="appleTouchIconLink" rel="apple-touch-icon" href="./raytech-icon-192.png">','<link id="appleTouchIconLink" rel="apple-touch-icon" sizes="180x180" href="./raytech-app-apple-180.png">');
let build=await readFile('build.mjs','utf8');
build=replace(build,'V34.6.2 · Homologação · Dados sintéticos','V34.6.3 · Homologação · Dados sintéticos');
let tests=await readFile('visual-refinement.test.mjs','utf8');
tests=replace(tests,'6(?:\\.[12])?','6(?:\\.[123])?');
tests=replace(tests,"import {readFileSync} from 'node:fs';","import {readFileSync} from 'node:fs';\nimport {createHash} from 'node:crypto';");
tests+="\ntest('approved transparent app identity assets are exact and installed separately from existing brand artwork',()=>{const m=JSON.parse(readFileSync(new URL('./dist/manifest.webmanifest',import.meta.url),'utf8'));assert.deepEqual(m.icons.map(i=>i.src),['./raytech-app-192.png','./raytech-app-512.png']);assert.match(html,/apple-touch-icon[^>]*raytech-app-apple-180\\.png/);assert.match(html,/rel=\"icon\"[^>]*raytech-app-favicon-32\\.png/);for(const [name,[size,digest]] of Object.entries("+JSON.stringify(expected)+")){const b=readFileSync(new URL('./dist/'+name,import.meta.url));assert.equal(b.readUInt32BE(16),size);assert.equal(b.readUInt32BE(20),size);assert.equal(b[25],6);assert.equal(createHash('sha256').update(b).digest('hex'),digest);}});\n";
for(const name of Object.keys(expected))await copyFile(path.join(source,name),path.join('official',name));
await writeFile('official/manifest.webmanifest',JSON.stringify(m,null,2)+'\n');
await writeFile('official/index.html',html);
await writeFile('build.mjs',build);
await writeFile('visual-refinement.test.mjs',tests);
console.log('V34.6.3 assets integrated and verified. Run build/CI before deployment.');
