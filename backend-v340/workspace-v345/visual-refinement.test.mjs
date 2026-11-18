import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('./dist/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('./official/css/v345.css',import.meta.url),'utf8');
test('profile retains unique existing action hooks and accessible native disclosure',()=>{for(const id of ['smartAdminOpen','v345Logout','v345Identity','v345Avatar','productionCloudHeader'])assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);assert.match(html,/<details class="v345-profile">/);assert.match(html,/V34\.(?:5\.1|6(?:\.[12])?) · Homologação · Dados sintéticos/);});
test('mobile and reduced motion styles retained',()=>{assert.match(css,/@media\(max-width:639px\)/);assert.match(css,/prefers-reduced-motion/);assert.match(css,/\.v345-usage progress/);});

test('PWA visual controls and local assets are present',()=>{for(const id of ['smartPwaOpen','smartPwaDialog','smartPwaInstall','smartPwaCheck','smartPwaNotice'])assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);assert.match(html,/data-pwa-splash/);assert.match(html,/pwa\/visual\.mjs/);assert.match(html,/css\/pwa-visual\.css/);});
test('PWA presentation distinguishes ready, waiting, failed and install availability',async()=>{const {pwaPresentation}=await import('./official/pwa/visual.mjs');assert.equal(pwaPresentation({phase:'ready',canInstall:true}).install,true);assert.equal(pwaPresentation({phase:'ready',canInstall:true,standalone:true}).install,false);assert.equal(pwaPresentation({phase:'update-waiting'}).waiting,true);assert.match(pwaPresentation({phase:'update-failed'}).status,/versão ativa/);assert.equal(pwaPresentation({phase:'unavailable'}).waiting,false);});

test('mobile drawer available height respects actual visual viewport and bottom navigation',async()=>{const {availableDrawerHeight}=await import('./official/ui/drawer-viewport.mjs');assert.equal(availableDrawerHeight({top:120,viewportBottom:740,navTop:680}),552);assert.equal(availableDrawerHeight({top:120,viewportBottom:500,navTop:680}),372);assert.equal(availableDrawerHeight({top:530,viewportBottom:500}),0);assert.match(html,/ui\/drawer-viewport\.mjs/);});

test('PWA install label is Raytech CG with unchanged installation identity',()=>{const m=JSON.parse(readFileSync(new URL('./dist/manifest.webmanifest',import.meta.url),'utf8'));assert.equal(m.name,'Raytech CG');assert.equal(m.short_name,'Raytech CG');assert.equal(m.id,'/raytech-cg-homologacao');assert.equal(m.start_url,'/');assert.equal(m.scope,'/');assert.equal(m.display,'standalone');});
