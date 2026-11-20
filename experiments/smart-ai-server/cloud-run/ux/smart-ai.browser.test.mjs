import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {pathToFileURL} from 'node:url';
import {test} from 'node:test';

const {chromium,webkit,devices}=await import(process.env.PLAYWRIGHT_MODULE?
  pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const fixture=Buffer.from('%PDF-1.4\n%%EOF\n');
const html=`<!doctype html><html lang="pt-BR"><meta charset="utf-8">
 <meta name="viewport" content="width=device-width, initial-scale=1">
 <title>Raytech CG Smart AI · Ensaio</title><link rel="stylesheet" href="/smart-ai.css">
 <main id="root"></main><script type="module">
 import {mountSmartAI} from '/smart-ai.mjs';
 import {mountSmartAdminAI} from '/smart-admin-ai.mjs';
 const root=document.getElementById('root');
 if(['?owner','?admin'].includes(location.search)){
  mountSmartAdminAI(root,{getIdToken:async()=>location.search.slice(1)});
 }else mountSmartAI(root,{
  getIdToken:async()=>location.search==='?premium'?'fixture-premium':'fixture-free',
  onUpgrade:()=>document.body.dataset.upgrade='yes',
  onReview:value=>document.body.dataset.review=String(value.items.length),
 });
 </script></html>`;

async function lab(){
 const state={remaining:2,requests:0,mode:'success',ids:[],settings:{enabled:true,budget:{day:30,month:60},version:0}};
 const assets={'/smart-ai.css':'text/css','/smart-ai.mjs':'text/javascript','/smart-admin-ai.mjs':'text/javascript'};
 const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/'){res.writeHead(200,{'content-type':'text/html'});res.end(html);return;}
  if(Object.hasOwn(assets,url.pathname)){
   res.writeHead(200,{'content-type':assets[url.pathname]});
   res.end(await readFile(new URL('.'+url.pathname,import.meta.url)));return;
  }
  const send=(status,body)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(body));};
  if(url.pathname==='/v1/admin/ai'){
   const role=req.headers.authorization?.slice(7);
   if(!['owner','admin'].includes(role))return send(403,{error:'ACCESS_DENIED'});
   const chunks=[];for await(const chunk of req)chunks.push(chunk);
   const body=JSON.parse(Buffer.concat(chunks));
   const period={free:{reserved:2,completed:1,failed:1,pending:0},
    premium:{reserved:1,completed:0,failed:0,pending:1},conversions:1};
   if(body.action==='overview')return send(200,{role,settings:state.settings,day:period,month:period,monthlyAverage:0.5});
   if(body.action==='search'&&body.prefix==='fixture')return send(200,{rows:[{uid:'fixture-test',name:'Conta fictícia'}]});
   if(body.action==='credits'&&body.uid==='fixture-test')return send(200,{plan:'free',remaining:1,busy:false});
   if(body.action==='configure'&&role==='owner'&&body.expectedVersion===state.settings.version){
    state.settings={enabled:body.enabled,budget:{day:body.day,month:body.month},version:body.expectedVersion+1};
    return send(200,{settings:state.settings});
   }
   return send(400,{error:'INVALID_REQUEST'});
  }
  const premium=req.headers.authorization==='Bearer fixture-premium';
  if(!premium&&req.headers.authorization!=='Bearer fixture-free'){res.writeHead(401).end();return;}
  if(url.pathname==='/v1/credits')return send(200,premium?
   {plan:'premium',remaining:15,busy:false,nextRenewalDate:'2027-01-01'}:
   {plan:'free',remaining:state.remaining,busy:false,nextRenewalDate:null});
  if(url.pathname!=='/v1/invoices'||req.method!=='POST'){res.writeHead(404).end();return;}
  const chunks=[];
  for await(const chunk of req)chunks.push(chunk);
  const {feature,mimeType,data}=JSON.parse(Buffer.concat(chunks));
  assert.equal(feature,'invoice-ai');assert.equal(mimeType,'application/pdf');assert.equal(data,fixture.toString('base64'));
  state.requests++;state.ids.push(req.headers['x-request-id']);
  if(state.mode==='hold')await new Promise(resolve=>{state.release=resolve;});
  if(state.mode==='refund')return send(502,{error:'PROCESSING_FAILED',creditRefunded:true});
  if(state.mode==='rate')return send(429,{error:'RATE_LIMIT'});
  if(state.mode==='unknown')return send(503,{error:'OUTCOME_UNAVAILABLE'});
  state.remaining--;
  return send(200,{items:[{}],requiresReview:true});
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {state,url:'http://127.0.0.1:'+server.address().port,
  close:()=>new Promise(resolve=>server.close(resolve))};
}

const chromiumOptions=process.env.PLAYWRIGHT_CHROMIUM_PATH?
 {executablePath:process.env.PLAYWRIGHT_CHROMIUM_PATH}:{};
const waitText=(page,selector,needle)=>page.waitForFunction(
 ([target,text])=>document.querySelector(target)?.textContent.includes(text),[selector,needle]);
const select=page=>page.locator('[data-file]').setInputFiles({name:'fatura.pdf',mimeType:'application/pdf',buffer:fixture});

test('desktop Chromium: lock, Premium action, double-submit guard, refresh and review',async()=>{
 const {state,url,close}=await lab();
 let browser;
 try{
  browser=await chromium.launch(chromiumOptions);
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  await page.goto(url);
  await waitText(page,'[data-count]','2');
  await page.getByRole('button',{name:'Conhecer o Premium'}).click();
  assert.equal(await page.locator('body').getAttribute('data-upgrade'),'yes');
  await select(page);state.mode='hold';
  await page.locator('[data-form]').evaluate(form=>{
   form.dispatchEvent(new SubmitEvent('submit',{cancelable:true}));
   form.dispatchEvent(new SubmitEvent('submit',{cancelable:true}));
  });
  await waitText(page,'[data-send]','Processando');
  assert.equal(await page.locator('[data-send]').isDisabled(),true);
  for(let attempt=0;attempt<100&&!state.release;attempt++)await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(typeof state.release,'function');
  state.release();state.mode='success';
  await waitText(page,'[data-count]','1');
  assert.equal(state.requests,1);
  await page.getByRole('button',{name:'Revisar lançamentos'}).click();
  assert.equal(await page.locator('body').getAttribute('data-review'),'1');
  await select(page);await page.getByRole('button',{name:'Ler fatura'}).click();
  await waitText(page,'[data-count]','0');
  assert.equal(await page.getByText('Créditos esgotados').isVisible(),true);
  assert.equal(await page.locator('[data-send]').isDisabled(),true);
 }finally{state.release?.();await browser?.close();await close();}
});

test('Android Chromium: responsive layout and distinct rate limit, refund and unknown outcome',async()=>{
 const {state,url,close}=await lab();
 let browser;
 try{
  browser=await chromium.launch(chromiumOptions);
  const page=await browser.newPage(devices['Pixel 7']);
  await page.goto(url);await waitText(page,'[data-count]','2');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await select(page);state.mode='refund';await page.locator('[data-send]').click();
  await waitText(page,'[data-status]','O crédito foi restituído.');
  await waitText(page,'[data-send]','Ler fatura');
  assert.equal(await page.locator('[data-count]').textContent(),'2');
  state.mode='rate';await page.locator('[data-send]').click();
  await waitText(page,'[data-status]','Limite de tentativas por minuto');
  await waitText(page,'[data-send]','Ler fatura');
  state.mode='unknown';await page.locator('[data-send]').click();
  await waitText(page,'[data-status]','indisponível');
  assert.doesNotMatch(await page.locator('[data-status]').textContent(),/restituído/);
  assert.notEqual(state.ids[0],state.ids[1]);
  assert.equal(state.ids[1],state.ids[2]);
 }finally{await browser?.close();await close();}
});

test('iOS WebKit: Premium monthly renewal and no sideways scrolling',{skip:process.env.SKIP_WEBKIT==='1'},async()=>{
 const {url,close}=await lab();
 let browser;
 try{
  browser=await webkit.launch();
  const page=await browser.newPage(devices['iPhone 13']);
  await page.goto(url+'?premium');
  await waitText(page,'[data-renewal]','01/01/2027');
  assert.equal(await page.locator('[data-count]').textContent(),'15');
  assert.equal(await page.locator('[data-upgrade]').isVisible(),false);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 }finally{await browser?.close();await close();}
});

test('Smart Admin: mobile Owner controls, desktop Admin read-only, search, credits and cost estimate',async()=>{
 const {state,url,close}=await lab();
 let browser;
 try{
  browser=await chromium.launch(chromiumOptions);
  const page=await browser.newPage(devices['Pixel 7']);
  await page.goto(url+'?owner');
  await waitText(page,'[data-admission]','habilitadas');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.getByLabel('Pesquisar por início do UID').fill('fixture');
  await page.getByRole('button',{name:'Pesquisar',exact:true}).click();
  await page.getByRole('button',{name:'Conta fictícia · fixture-test'}).click();
  await waitText(page,'[data-credit]','1 créditos disponíveis');
  await page.getByLabel('Valor estimado por tentativa em reais').fill('0.5');
  await waitText(page,'[data-estimate]','1,50');
  await page.getByLabel('Aceitar novas leituras de IA').uncheck();
  await page.getByLabel('Limite diário (UTC)').fill('12');
  await page.getByLabel('Limite mensal (UTC)').fill('35');
  await page.getByRole('button',{name:'Salvar configuração'}).click();
  await waitText(page,'[data-status]','Configuração salva.');
  assert.deepEqual(state.settings,{enabled:false,budget:{day:12,month:35},version:1});
  const desktop=await browser.newPage({viewport:{width:1280,height:720}});
  await desktop.goto(url+'?admin');
  await waitText(desktop,'[data-admission]','suspensas');
  assert.equal(await desktop.locator('[data-config]').isVisible(),false);
  assert.match(await desktop.locator('[data-month]').textContent(),/Créditos restituídos/);
 }finally{await browser?.close();await close();}
});
