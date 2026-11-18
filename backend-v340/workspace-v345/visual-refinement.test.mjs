import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('./dist/index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('./official/css/v345.css',import.meta.url),'utf8');
test('profile retains unique existing action hooks and accessible native disclosure',()=>{for(const id of ['smartAdminOpen','v345Logout','v345Identity','v345Avatar','productionCloudHeader'])assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);assert.match(html,/<details class="v345-profile">/);assert.match(html,/V34\.5\.1 · Homologação · Dados sintéticos/);});
test('mobile and reduced motion styles retained',()=>{assert.match(css,/@media\(max-width:639px\)/);assert.match(css,/prefers-reduced-motion/);assert.match(css,/\.v345-usage progress/);});
