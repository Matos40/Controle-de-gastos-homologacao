import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from '/tmp/raytech-rc-browser/node_modules/playwright/index.mjs';
import {assertLocalEmulators} from './emulator-guard.mjs';
assertLocalEmulators();
const root='http://127.0.0.1:15002';let server,browser;
after(async()=>{await browser?.close();server?.kill();});
test('Practical profile selector uses four synthetic roles and rejects external origin',async()=>{
 server=spawn(process.execPath,['functions/admin-panel-server.mjs'],{env:{...process.env,RAYTECH_PRACTICAL:'1'},stdio:'ignore'});
 let ready=false;for(let i=0;i<150;i++){try{ready=(await fetch(root+'/api/lab-enabled')).ok;if(ready)break;}catch{}await new Promise(r=>setTimeout(r,200));}assert.ok(ready);
 assert.equal((await fetch(root+'/api/lab-profile',{method:'POST',headers:{origin:'https://example.invalid','content-type':'application/json'},body:'{"role":"owner"}'})).status,403);
 browser=await chromium.launch({headless:true});const context=await browser.newContext();await context.route('**/*',r=>r.request().url().startsWith(root+'/')?r.continue():r.abort());const page=await context.newPage();
 for(const [role,label] of [['free','Acesso negado'],['premium','Acesso autorizado'],['admin','Acesso autorizado'],['owner','Acesso autorizado']]){
  await page.goto(root+'/rc');await page.locator('#lab-role').selectOption(role);await page.locator('#lab-select').click();
  await page.waitForFunction(label=>document.querySelector('#access').textContent===label,label);
  assert.equal(await page.locator('#token').inputValue(),'');assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);
 }
 await page.goto(root);await page.locator('#lab-role').selectOption('owner');await page.locator('#lab-select').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Consulta concluída'));
 await page.locator('#logout').click();assert.equal(await page.locator('#lab-identity').textContent(),'');await context.close();
});
