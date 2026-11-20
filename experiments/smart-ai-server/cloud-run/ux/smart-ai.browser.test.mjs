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
 mountSmartAI(document.getElementById('root'),{
  getIdToken:async()=>location.search==='?premium'?'fixture-premium':'fixture-free',
  onUpgrade:()=>document.body.dataset.upgrade='yes',
  onReview:value=>document.body.dataset.review=String(value.items.length),
 });
 </script></html>`;

async function lab(){
 const state={remaining:2,requests:0,mode:'success',ids:[]};
 const assets={'/smart-ai.css':'text/css','/smart-ai.mjs':'text/javascript'};
 const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/'){res.writeHead(200,{'content-type':'text/html'});res.end(html);return;}
  if(Object.hasOwn(assets,url.pathname)){
   res.writeHead(200,{'content-type':assets[url.pathname]});
   res.end(await readFile(new URL('.'+url.pathname,import.meta.url)));return;
  }
  const premium=req.headers.authorization==='Bearer fixture-premium';
  if(!premium&&req.headers.authorization!=='Bearer fixture-free'){res.writeHead(401).end();return;}
  const send=(status,body)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(body));};
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
