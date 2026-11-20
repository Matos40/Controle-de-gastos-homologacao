import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const fallback=new URL('../../../../backend-v340/workspace-v345/official/',import.meta.url);
const packaged=new URL('../../../../official-34745/',import.meta.url);
export const officialRoot=process.env.RAYTECH_OFFICIAL_SNAPSHOT?
 pathToFileURL(resolve(process.env.RAYTECH_OFFICIAL_SNAPSHOT)+'/'):
 existsSync(new URL('index.html',packaged))?packaged:fallback;
export const native=officialRoot!==fallback;
import {scripts} from './full-app-scripts.mjs';
const allowed=new Set(['css/styles.css','css/smart-login.css','raytech-icon-192.png','raytech-icon-512.png',
 'js/productionV2/cleanWorkspace.mjs','js/productionV2/smartLoginView.mjs','js/productionV2/smartAdminView.mjs',
 'js/productionV2/model.mjs','js/productionV2/smartAdminIdentity.mjs',...scripts.map(path=>'js/'+path)]);
const vendor=new Set(['tailwind.css','chart.umd.js','xlsx.full.min.js']);
if(native){
 for(const path of ['css/v345.css','css/pwa-visual.css','raytech-app-192.png','raytech-app-512.png','js/ui/drawer-viewport.mjs',
 'vendor/tailwind.css','vendor/chart.umd.js','vendor/xlsx.full.min.js','vendor/fontawesome/css/all.min.css'])allowed.add(path);
 for(const face of ['brands-400','regular-400','solid-900','v4compatibility'])for(const ext of ['woff2','ttf'])allowed.add('vendor/fontawesome/webfonts/fa-'+face+'.'+ext);
 for(const [dir,family,weights] of [['orbitron','orbitron',[800,900]],['jakarta','plus-jakarta-sans',[400,500,600,700,800]]]){
  for(const weight of weights){
   allowed.add('vendor/'+dir+'/latin-'+weight+'.css');
   for(const ext of ['woff2','woff'])allowed.add('vendor/'+dir+'/files/'+family+'-latin-'+weight+'-normal.'+ext);
  }
 }
}
const types={html:'text/html',css:'text/css',mjs:'text/javascript',js:'text/javascript',png:'image/png',woff:'font/woff',woff2:'font/woff2',ttf:'font/ttf',webmanifest:'application/manifest+json'};
export async function fullAppAsset(path,vendorRoot,reference=false){
 if(!vendorRoot)return;
 let key=path.slice('/app/'.length);
 if(!key){
  let html=await readFile(new URL('index.html',officialRoot),'utf8');
  html=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
   .replace(/<link\b[^>]*href="https?:[^"]+"[^>]*>/gi,'')
   .replace('manifest.json','manifest.webmanifest')
   .replace('</head>',(native?'':'<link rel="stylesheet" href="./vendor/tailwind.css">')+
    '<link rel="stylesheet" href="/ux/smart-ai.css"><link rel="stylesheet" href="/integration/lab.css"></head>')
   .replace('</body>','<script src="./vendor/xlsx.full.min.js"></script><script src="./vendor/chart.umd.js"></script><script type="module" src="/integration/full-app-ui.mjs"></script></body>');
  if(native)html=html.replace('</body>','<script type="module" src="./js/ui/drawer-viewport.mjs"></script></body>');
  if(!reference)html=html.replace(/v34\.7\.4\.5/gi,'V35.0');
  return {type:types.html,data:html};
 }
 if(key==='sw.js'){
  const cache='raytech-smart-ai-0852-shell';
  const base=['/app/','/app/manifest.webmanifest',...Array.from(allowed,path=>'/app/'+path),
   ...Array.from(vendor,path=>'/app/vendor/'+path).filter(path=>!allowed.has(path.slice(5))),'/integration/full-app-ui.mjs',
   '/integration/full-app-scripts.mjs','/integration/review-store.mjs','/integration/native-invoice.mjs','/integration/mount.mjs','/integration/review.mjs','/integration/lab.css',
   '/ux/smart-ai.mjs','/ux/smart-ai.css','/ux/smart-admin-ai.mjs','/ux/budget.mjs'];
  return {type:types.js,data:`
   const cacheName=${JSON.stringify(cache)},paths=${JSON.stringify(base)};
   self.addEventListener('install',event=>event.waitUntil(caches.open(cacheName).then(cache=>cache.addAll(paths))));
   self.addEventListener('fetch',event=>{
    const url=new URL(event.request.url);
    if(event.request.method==='GET'&&url.origin===self.location.origin&&paths.includes(url.pathname)){
     event.respondWith(fetch(event.request).catch(async()=>{
      const cached=await caches.match(url.pathname,{cacheName});
      return cached??Response.error();
     }));
    }
   });
  `};
 }
 if(key==='manifest.webmanifest')return {type:types.webmanifest,data:JSON.stringify({
  id:'/app/',name:'Raytech CG Ã‚Â· Experimental',short_name:'Raytech CG Lab',start_url:'/app/',scope:'/app/',display:'standalone',
  icons:[192,512].map(size=>({src:'raytech-icon-'+size+'.png',sizes:size+'x'+size,type:'image/png'})),
 })};
 const file=allowed.has(key)?new URL(key,officialRoot):key.startsWith('vendor/')&&vendor.has(key.slice(7))?join(vendorRoot,key.slice(7)):null;
 if(file)return {type:types[key.split('.').at(-1)],data:await readFile(file)};
}
export const officialCopyPaths=['index.html',...allowed];
