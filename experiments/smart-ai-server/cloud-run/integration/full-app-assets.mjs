import {readFile} from 'node:fs/promises';
import {join} from 'node:path';

const official=new URL('../../../../backend-v340/workspace-v345/official/',import.meta.url);
import {scripts} from './full-app-scripts.mjs';
const allowed=new Set(['css/styles.css','css/smart-login.css','raytech-icon-192.png','raytech-icon-512.png',
 'js/productionV2/cleanWorkspace.mjs','js/productionV2/smartLoginView.mjs','js/productionV2/smartAdminView.mjs',
 'js/productionV2/model.mjs','js/productionV2/smartAdminIdentity.mjs',...scripts.map(path=>'js/'+path)]);
const vendor=new Set(['tailwind.css','chart.umd.js','xlsx.full.min.js']);
const types={html:'text/html',css:'text/css',mjs:'text/javascript',js:'text/javascript',png:'image/png',webmanifest:'application/manifest+json'};
export async function fullAppAsset(path,vendorRoot){
 if(!vendorRoot)return;
 let key=path.slice('/app/'.length);
 if(!key){
  let html=await readFile(new URL('index.html',official),'utf8');
  html=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'')
   .replace(/<link\b[^>]*href="https?:[^"]+"[^>]*>/gi,'')
   .replaceAll('raytech-app-192.png','raytech-icon-192.png').replace('manifest.json','manifest.webmanifest')
   .replace('</head>','<link rel="stylesheet" href="./vendor/tailwind.css"><link rel="stylesheet" href="/ux/smart-ai.css"><link rel="stylesheet" href="/integration/lab.css"></head>')
   .replace('</body>','<script src="./vendor/xlsx.full.min.js"></script><script src="./vendor/chart.umd.js"></script><script type="module" src="/integration/full-app-ui.mjs"></script></body>');
  return {type:types.html,data:html};
 }
 if(key==='sw.js'){
  const cache='raytech-smart-ai-0851-shell';
  const base=['/app/','/app/manifest.webmanifest',...Array.from(allowed,path=>'/app/'+path),
   ...Array.from(vendor,path=>'/app/vendor/'+path),'/integration/full-app-ui.mjs',
   '/integration/full-app-scripts.mjs','/integration/review-store.mjs','/integration/mount.mjs','/integration/review.mjs','/integration/lab.css',
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
  id:'/app/',name:'Raytech CG · Experimental',short_name:'Raytech CG Lab',start_url:'/app/',scope:'/app/',display:'standalone',
  icons:[192,512].map(size=>({src:'raytech-icon-'+size+'.png',sizes:size+'x'+size,type:'image/png'})),
 })};
 const file=key.startsWith('vendor/')&&vendor.has(key.slice(7))?join(vendorRoot,key.slice(7)):
  allowed.has(key)?new URL(key,official):null;
 if(file)return {type:types[key.split('.').at(-1)],data:await readFile(file)};
}
export const officialCopyPaths=['index.html',...allowed];
