import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from '/tmp/raytech-rc-browser/node_modules/playwright/index.mjs';
import {assertLocalEmulators} from './emulator-guard.mjs';
assertLocalEmulators();
const root='http://127.0.0.1:15002';let server,browser;
after(async()=>{await browser?.close();server?.kill();});
test('V34.4 official neon view, integrated admin and invoice, local-only Chromium',async()=>{
 server=spawn(process.execPath,['functions/admin-panel-server.mjs'],{env:{...process.env,RAYTECH_PRACTICAL:'1'},stdio:'ignore'});
 let ready=false;for(let i=0;i<150;i++){try{ready=(await fetch(root+'/app')).ok;if(ready)break;}catch{}await new Promise(r=>setTimeout(r,200));}assert.ok(ready);
 browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1280,height:800}});const external=[];await context.route('**/*',r=>{if(r.request().url().startsWith(root+'/'))return r.continue();external.push(r.request().url());return r.abort();});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const login=async role=>{await page.locator('#profile').selectOption(role);await page.locator('[data-login-enter]').click();await page.locator('#smartAccountApp').waitFor({state:'visible'});};
 const text=async(selector,value)=>page.waitForFunction(({selector,value})=>document.querySelector(selector)?.textContent.includes(value),{selector,value});
 await page.goto(root+'/app');await login('free');await page.locator('#premiumInvoiceButton').click();assert.ok(await page.locator('#extract').isDisabled());assert.ok(await page.locator('#smartAdminOpen').isHidden());await page.locator('#logout').click();
 await login('admin');await page.locator('#smartAdminOpen').click();await text('#smartAdminHost','Conta Premium');await page.locator('#v3472Outcomes').waitFor({state:'visible'});assert.equal(await page.locator('#v3472Outcomes .admin-stat').count(),4);await page.getByRole('textbox',{name:'Buscar usuários'}).fill('Conta Premium');await page.getByRole('button',{name:'Editar limites'}).click();for(const k of ['minute','day','month'])await page.locator('input[name='+k+']').fill('1');await page.getByRole('button',{name:'Salvar limites'}).click();await text('#smartAdminHost','Mês: 0/1');await page.locator('#logout').click();
 await login('premium');await page.locator('#premiumInvoiceButton').click();await page.locator('#extract').click();await text('#items','Compra fictícia');await page.locator('#confirm').click();await text('#invoiceStatus','Nenhum lançamento financeiro salvo');await page.locator('#extract').click();await text('#invoiceStatus','Cota atingida');await page.locator('#logout').click();
 await page.setViewportSize({width:390,height:844});await login('owner');await page.locator('#smartAdminOpen').click();await text('#smartAdminHost','Limite diário atingido');await page.locator('#v3472Outcomes').waitFor({state:'visible'});await text('#smartAdminHost','Concluídas: 1');assert.equal(await page.locator('#v3472Outcomes .admin-stat').count(),4);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);assert.deepEqual(external,[]);assert.deepEqual(errors,[]);await page.locator('#logout').click();assert.ok(await page.locator('#smartAccountApp').isHidden());await context.close();
});
