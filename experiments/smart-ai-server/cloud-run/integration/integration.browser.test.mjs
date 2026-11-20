import assert from 'node:assert/strict';
import {test} from 'node:test';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {startLab} from './server.mjs';

const {chromium,webkit,devices}=await import(process.env.PLAYWRIGHT_MODULE?
 pathToFileURL(process.env.PLAYWRIGHT_MODULE).href:'playwright');
const file={name:'fatura-sintetica.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\n%%EOF\n')};
const enter=async(page,profile='free')=>{
 await page.locator('#profile').selectOption(profile);
 await page.getByRole('button',{name:'Entrar no laboratório'}).click();
 await page.getByRole('button',{name:'Smart AI',exact:true}).click();
};

for(const [name,engine,device] of [['desktop',chromium,{viewport:{width:1280,height:900}}],
 ['Android',chromium,devices['Pixel 7']],['iOS',webkit,devices['iPhone 13']]]){
 test('laboratório '+name+' — modalidades, revisão, isolamento e logout',async t=>{
  const lab=await startLab({recovery:true}),browser=await engine.launch();
  t.after(async()=>{await browser.close();await lab.close();});
  const context=await browser.newContext(device),page=await context.newPage();
  const outside=[];
  await context.route('**/*',route=>{
   if(route.request().url().startsWith(lab.origin+'/'))return route.continue();
   outside.push(route.request().url());return route.abort();
  });
  await page.goto(lab.origin);
  await enter(page);
  await page.getByText('Créditos Free').waitFor();
  await page.getByRole('button',{name:'Chave API',exact:true}).click();
  await page.getByRole('dialog').waitFor();
  await page.getByRole('button',{name:'Fechar',exact:true}).click();
  await page.getByRole('button',{name:'Smart AI',exact:true}).click();
  await page.locator('[data-file]').setInputFiles(file);
  await page.getByRole('button',{name:'Ler fatura'}).click();
  await page.getByRole('button',{name:'Revisar lançamentos'}).click();
  const review=page.getByRole('region',{name:'Revisão da fatura'});
  await review.getByText('Fatura reconciliada').waitFor();
  assert.equal(await review.locator('[data-totals]').getByText(/38,55/).count(),2);
  assert.equal(await review.getByLabel('Parcela atual').inputValue(),'2');
  assert.equal(await review.getByLabel('Valor (R$)').last().inputValue(),'-R$\u00a06,25');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(process.env.RAYTECH_SCREENSHOTS)await page.screenshot({path:join(process.env.RAYTECH_SCREENSHOTS,name+'-revisao.png'),fullPage:true});
  await review.getByLabel('Selecionar').nth(1).uncheck();
  assert.match(await review.locator('[data-selected]').textContent(),/12,65/);
  await review.getByLabel('Selecionar').nth(1).check();
  await review.getByLabel('Descrição').first().fill('Descrição revisada');
  await review.getByLabel('Selecionar').first().uncheck();
  await review.getByRole('button',{name:'Confirmar simulação'}).click();
  await page.getByText('Simulação confirmada. Nenhum lançamento foi gravado.').waitFor();
  await page.getByRole('button',{name:'Sair',exact:true}).click();
  assert.equal(await page.locator('#workspace').textContent(),'');
  await enter(page,'premium');
  await page.getByText('Créditos Premium').waitFor();
  await page.getByText(/Próxima renovação/).waitFor();
  assert.equal(await page.locator('[data-count]').textContent(),'15');
  if(name==='desktop'){
   await context.setOffline(true);
   await page.getByRole('button',{name:'Atualizar saldo'}).click();
   await page.getByText(/Sem conexão/).waitFor();
   assert.ok(await page.getByRole('button',{name:'Ler fatura'}).isDisabled());
  }
  assert.deepEqual(outside,[]);
  assert.deepEqual(await page.evaluate(async()=>[localStorage.length,(await indexedDB.databases()).length,(await caches.keys()).length]),[0,0,0]);
 });
}

test('Smart Admin do laboratório — reautenticação do Owner e auditoria em memória',async t=>{
 const lab=await startLab({mode:'suspended',recovery:true}),browser=await chromium.launch();
 t.after(async()=>{await browser.close();await lab.close();});
 const page=await browser.newPage();
 await page.goto(lab.origin);
 await enter(page,'owner');
 await page.getByText(/Leituras suspensas temporariamente/).waitFor();
 await page.getByRole('button',{name:'Smart Admin AI',exact:true}).click();
 await page.getByText(/Suspensa pelo limite financeiro/).waitFor();
 await page.getByLabel('Revisei o faturamento e confirmo a reativação').check();
 page.once('dialog',dialog=>dialog.accept());
 await page.getByRole('button',{name:'Reautenticar e reativar'}).click();
 await page.getByText(/1 alterações registradas/).waitFor();
 if(process.env.RAYTECH_SCREENSHOTS)await page.screenshot({path:join(process.env.RAYTECH_SCREENSHOTS,'smart-admin.png'),fullPage:true});
});

test('orçamento no painel — níveis, consumo superior a 100% e ausência de observação',async t=>{
 const browser=await chromium.launch();
 t.after(()=>browser.close());
 for(const [cents,level,percent] of [[null,null,null],[100,'normal',10],[250,'attention',25],
  [500,'alert',50],[750,'preventive',75],[1250,'critical',125]]){
  const lab=await startLab({observedCents:cents,recovery:true});
  const page=await browser.newPage();
  try{
   await page.goto(lab.origin);
   await enter(page,'owner');
   await page.getByRole('button',{name:'Smart Admin AI',exact:true}).click();
   await page.getByText('Proteção financeira Smart AI',{exact:true}).waitFor();
   if(level){
    await page.locator('progress[data-level='+level+']').waitFor();
    assert.equal(await page.locator('progress').getAttribute('value'),String(Math.min(100,percent)));
    assert.ok((await page.locator('[data-budget-level]').textContent()).includes(percent+'%'));
   }else{
    await page.getByText('Aguardando atualização do faturamento').waitFor();
    assert.equal(await page.locator('progress').isVisible(),false);
   }
   if(process.env.RAYTECH_SCREENSHOTS)await page.screenshot({path:join(process.env.RAYTECH_SCREENSHOTS,'orcamento-'+(level??'aguardando')+'.png'),fullPage:true});
  }finally{await page.close();await lab.close();}
 }
});

for(const [name,engine,device] of [['desktop',chromium,{viewport:{width:1280,height:900}}],
 ['Android',chromium,devices['Pixel 7']],['iOS',webkit,devices['iPhone 13']]]){
 test('aplicativo completo '+name+' — dashboard, importação e catálogo original',async t=>{
  assert.ok(process.env.RAYTECH_APP_VENDOR,'RAYTECH_APP_VENDOR deve indicar dependências locais aprovadas');
  const lab=await startLab({observedCents:500,recovery:true}),browser=await engine.launch();
  t.after(async()=>{await browser.close();await lab.close();});
  const page=await browser.newPage(device);page.setDefaultTimeout(8000);
  const requests=[];
  const capture=async label=>{if(process.env.RAYTECH_SCREENSHOTS)await page.screenshot({path:join(process.env.RAYTECH_SCREENSHOTS,'app-'+name+'-'+label+'.png')});};
  await page.route('**/*',route=>{
   if(route.request().url().startsWith(lab.origin+'/'))return route.continue();
   requests.push(route.request().url());return route.abort();
  });
  await page.goto(lab.origin+'/app/');
  await page.getByLabel('Perfil experimental').selectOption('owner');
  await page.getByRole('button',{name:'Entrar com Google'}).click();
  await page.locator('#smartAccountApp').waitFor();
  await page.evaluate(()=>switchTab('card'));
  await page.locator('#tabContentCard').waitFor();
  await capture('dashboard');
  await page.locator('#headerToolsToggleBtn').click();
  await page.locator('#premiumInvoiceButton').click();
  await page.getByRole('button',{name:'Chave API',exact:true}).waitFor();
  await capture('modalidades');
  await page.getByRole('button',{name:'Smart AI',exact:true}).click();
  await page.waitForFunction(()=>!document.getElementById('invoiceFileInput').disabled);
  await page.locator('[data-file]').setInputFiles(file);
  await page.getByRole('button',{name:'Extrair Gastos com IA'}).click();
  await page.getByRole('button',{name:'Revisar lançamentos'}).click();
  const review=page.getByRole('region',{name:'Revisão da fatura'});
  await review.getByLabel('Categoria').first().selectOption('alimentacao');
  assert.match(await review.locator('[data-selected]').textContent(),/38,55/);
  await capture('categorias');
  await review.getByRole('button',{name:'Confirmar simulação'}).click();
  await page.getByText('Simulação confirmada. Nenhum lançamento foi gravado.').waitFor();
  await page.evaluate(()=>closeOcrModal());
  await page.locator('.v345-account summary').click();
  await page.locator('#smartAdminOpen').click();
  await page.getByText('Smart AI Monitor',{exact:true}).click();
  await page.getByRole('heading',{name:'Consumo e proteção Smart AI',exact:true}).waitFor();
  const smart=page.locator('[data-smart-admin-ai]');
  await smart.getByLabel('Pesquisar por nome, e-mail ou UID').fill('perfil');
  await smart.getByRole('button',{name:'Pesquisar',exact:true}).click();
  await smart.getByRole('button',{name:'Próxima página'}).click();
  await smart.getByRole('button',{name:/Perfil fictício owner/}).waitFor();
  await smart.getByRole('button',{name:'Atualizar indicadores'}).click();
  await smart.getByText('Auditoria administrativa',{exact:true}).click();
  await smart.locator('progress[data-level=alert]').waitFor();
  await capture('admin');
  if(name==='desktop'){
   await page.getByRole('button',{name:'Exibir detalhes'}).first().click();
   const detail=page.locator('#smartAdminHost dialog[open]');
   await detail.getByText(/créditos disponíveis.*cotas legadas separadas/).waitFor();
   await capture('detalhes');
  }
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.deepEqual(requests,[]);
  assert.equal(await page.evaluate(()=>localStorage.length),0);
 });
}

test('native workspace keeps role checks on the server and restores invoice navigation',async t=>{
 const lab=await startLab({recovery:true}),browser=await chromium.launch();
 t.after(async()=>{await browser.close();await lab.close();});
 const session=async(profile,query='')=>{
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  await page.goto(lab.origin+'/app/'+query);
  await page.getByLabel('Perfil experimental').selectOption(profile);
  await page.getByRole('button',{name:'Entrar com Google'}).click();
  await page.locator('#smartAccountApp').waitFor();
  return page;
 };
 for(const role of ['free','premium']){
  const page=await session(role);
  assert.equal(await page.locator('.v345-account').isVisible(),false);
  await page.evaluate(()=>{localStorage.setItem('role','owner');document.querySelector('#smartAdminOpen').hidden=false;});
  const login=await page.request.post(lab.origin+'/lab/session',{headers:{origin:lab.origin},data:{action:'login',profile:role}});
  const data=await login.json();
  const denied=await page.request.post(lab.origin+'/v1/admin/ai',{headers:{authorization:'Bearer '+data.token},data:{action:'overview'}});
  assert.equal(denied.status(),403);
  await page.close();
 }
 for(const role of ['admin','owner']){
  const page=await session(role);
  assert.equal(await page.locator('.v345-account').isVisible(),true);
  await page.locator('.v345-account summary').click();
  assert.equal(await page.locator('#smartAdminOpen').isVisible(),true);
  await page.close();
 }
 const page=await session('free'),modal=page.locator('#ocrModal');
 const open=async()=>{
  await page.locator('#headerToolsToggleBtn').click();
  await page.locator('#premiumInvoiceButton').click();
  await modal.waitFor();
 };
 await open();
 await modal.getByRole('button',{name:'Fechar leitura de fatura'}).click();
 await modal.waitFor({state:'hidden'});
 await open();
 await modal.getByRole('button',{name:'Chave API',exact:true}).click();
 assert.equal(await modal.isVisible(),false);
 const key=page.locator('#apiKeyModal');
 assert.equal(await key.locator('#geminiApiKeyInput').isDisabled(),true);
 if(process.env.RAYTECH_SCREENSHOTS)await key.screenshot({path:join(process.env.RAYTECH_SCREENSHOTS,'modal-chave-api.png')});
 await key.getByRole('button',{name:'Cancelar'}).click();
 await modal.waitFor();
 await page.keyboard.press('Escape');await modal.waitFor({state:'hidden'});
 await open();
 await page.waitForFunction(()=>!document.getElementById('invoiceFileInput').disabled);
 await page.locator('#ocrDropZone').evaluate(zone=>{
  const transfer=new DataTransfer();
  transfer.items.add(new File(['%PDF-1.4\n%%EOF\n'],'arrastado.pdf',{type:'application/pdf'}));
  zone.dispatchEvent(new DragEvent('drop',{dataTransfer:transfer,bubbles:true,cancelable:true}));
 });
 await modal.getByText('PDF selecionado',{exact:true}).waitFor();
 await page.evaluate(()=>{
  const transfer=new DataTransfer();
  transfer.items.add(new File(['png'],'colado.png',{type:'image/png'}));
  document.dispatchEvent(new ClipboardEvent('paste',{clipboardData:transfer,bubbles:true,cancelable:true}));
 });
 assert.equal(await modal.locator('[data-filename]').textContent(),'colado.png');
 await modal.getByRole('button',{name:'Cancelar',exact:true}).click();
 await modal.waitFor({state:'hidden'});
 await page.close();
});

for(const [label,size] of [['desktop',{width:1280,height:900}],['mobile',{width:390,height:844}]]){
 test('equivalência de cabeçalho '+label+' com a V34.7.4.5 fixada',async t=>{
  const lab=await startLab({recovery:true}),browser=await chromium.launch();
  t.after(async()=>{await browser.close();await lab.close();});
  const pictures=[];
  for(const reference of [true,false]){
   const page=await browser.newPage({viewport:size});
   await page.goto(lab.origin+'/app/'+(reference?'?reference=1':''));
   await page.getByLabel('Perfil experimental').selectOption('owner');
   await page.getByRole('button',{name:'Entrar com Google'}).click();
   await page.locator('#smartAccountApp').waitFor();
   const header=page.locator('.raytech-header-shell');
   await header.waitFor();
   const version=page.locator('#raytechHeaderVersion');
   assert.match(await version.textContent(),reference?/34\.7\.4\.5/:/35\.0/);
   await page.evaluate(()=>document.fonts.ready);
   const variant=reference?'referencia':'candidato';
   if(process.env.RAYTECH_SCREENSHOTS)await header.screenshot({path:join(process.env.RAYTECH_SCREENSHOTS,'cabecalho-'+label+'-'+variant+'.png')});
   // Mask the approved version label and any layout space it reserves.
   const box=await header.boundingBox();
   pictures.push({width:box.width,height:box.height});
   await page.close();
  }
  assert.deepEqual(pictures[0],pictures[1]);
 });
}

test('server-only distribution excludes personal reader and rejects local privilege changes',async t=>{
 const lab=await startLab(),browser=await chromium.launch();
 t.after(async()=>{await browser.close();await lab.close();});
 const page=await browser.newPage();
 const html=await page.request.get(lab.origin+'/app/');
 assert.match(html.headers()['content-security-policy'],/connect-src 'self'/);
 assert.doesNotMatch(await html.text(),/geminiApiKeyInput|premiumApiKeyButton|apiKeyModal|processInvoiceWithGemini|aistudio\.google/);
 for(const path of ['/integration/recovery-invoice.mjs','/integration/lab-ui.mjs','/integration/mount.mjs','/app/js/services/geminiService.js']){
  assert.equal((await page.request.get(lab.origin+path)).status(),404);
 }
 assert.doesNotMatch(await (await page.request.get(lab.origin+'/app/sw.js')).text(),/recovery-invoice|geminiService/);
 await page.goto(lab.origin+'/app/');
 await page.getByLabel('Cenário experimental').selectOption('free-0');
 await page.getByRole('button',{name:'Entrar com Google'}).click();
 await page.locator('#smartAccountApp').waitFor();
 await page.locator('#headerToolsToggleBtn').click();
 await page.locator('#premiumInvoiceButton').click();
 const modal=page.locator('#ocrModal');
 await modal.getByText('Créditos esgotados',{exact:true}).waitFor();
 assert.equal(await modal.locator('[data-file]').isDisabled(),true);
 assert.equal(await modal.locator('[data-send]').isDisabled(),true);
 assert.equal(await modal.getByText('Disponível',{exact:true}).isVisible(),false);
 assert.equal(await modal.getByRole('button',{name:'Smart AI',exact:true}).count(),0);
 assert.equal(await modal.getByRole('button',{name:'Chave API',exact:true}).count(),0);
 await page.evaluate(()=>{localStorage.setItem('legacyReader','true');document.body.append(document.createElement('button'));});
 assert.equal(await page.evaluate(()=>typeof globalThis.openApiKeyModal),'undefined');
 assert.equal((await page.request.post(lab.origin+'/v1/invoices',{data:{}})).status(),401);
 const login=await page.request.post(lab.origin+'/lab/session',{headers:{origin:lab.origin},data:{action:'login',profile:'free',scenario:'free-0'}});
 const {token}=await login.json();
 const denied=await page.request.post(lab.origin+'/v1/invoices',{headers:{authorization:'Bearer '+token,'x-request-id':'00000000-0000-4000-8000-000000000091'},
  data:{feature:'invoice-ai',mimeType:file.mimeType,data:file.buffer.toString('base64')}});
 assert.equal(denied.status(),429);
 if(process.env.RAYTECH_SCREENSHOTS)await modal.screenshot({path:join(process.env.RAYTECH_SCREENSHOTS,'server-only-free-esgotado.png')});
});

test('experimental PWA migrates only known obsolete caches and excludes invoices and sessions',async t=>{
 const lab=await startLab(),browser=await chromium.launch();
 t.after(async()=>{await browser.close();await lab.close();});
 const context=await browser.newContext(),page=await context.newPage();
 await page.goto(lab.origin+'/app/manifest.webmanifest');
 await page.evaluate(async()=>{
  await caches.open('foreign-cache');
  const obsolete=await caches.open('raytech-smart-ai-0852-shell');
  await obsolete.put('/app/js/services/geminiService.js',new Response('synthetic'));
 });
 await page.goto(lab.origin+'/app/');
 await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));
 await page.waitForFunction(async()=>!(await caches.keys()).includes('raytech-smart-ai-0852-shell'));
 const result=await page.evaluate(async()=>{
  const keys=await caches.keys(),cache=await caches.open('raytech-smart-ai-0854-shell');
  return {keys,paths:(await cache.keys()).map(request=>new URL(request.url).pathname)};
 });
 assert.ok(result.keys.includes('foreign-cache'));
 assert.ok(result.paths.includes('/app/'));
 assert.ok(!result.paths.some(path=>/geminiService|recovery|\/lab\/|\/v1\//.test(path)));
 await page.goto(lab.origin+'/app/?online=1');
 await context.setOffline(true);
 const response=await page.goto(lab.origin+'/app/?offline=1');
 assert.ok(response.fromServiceWorker());
});

test('server-only Premium exhaustion preserves renewal and the neutral finance indicator',async t=>{
 const lab=await startLab(),browser=await chromium.launch();
 t.after(async()=>{await browser.close();await lab.close();});
 const page=await browser.newPage();
 const start=async(profile,scenario)=>{
  await page.goto(lab.origin+'/app/');
  await page.getByLabel('Perfil experimental').selectOption(profile);
  await page.getByLabel('Cenário experimental').selectOption(scenario);
  await page.getByRole('button',{name:'Entrar com Google'}).click();
  await page.locator('#smartAccountApp').waitFor();
 };
 await start('premium','premium-0');
 await page.locator('#headerToolsToggleBtn').click();
 await page.locator('#premiumInvoiceButton').click();
 const modal=page.locator('#ocrModal');
 await modal.getByText('Créditos esgotados',{exact:true}).waitFor();
 await modal.getByText(/Próxima renovação em/).waitFor();
 assert.equal(await modal.locator('[data-file]').isDisabled(),true);
 if(process.env.RAYTECH_SCREENSHOTS)await modal.screenshot({path:join(process.env.RAYTECH_SCREENSHOTS,'server-only-premium-esgotado.png')});
 await start('owner','');
 await page.locator('.v345-account summary').click();
 await page.locator('#smartAdminOpen').click();
 await page.getByText('Smart AI Monitor',{exact:true}).click();
 await page.getByText('Aguardando atualização do faturamento',{exact:true}).waitFor();
 const budget=page.locator('[data-budget-meter]');
 assert.ok(await budget.locator('progress[data-level=unavailable]').isVisible());
 assert.match(await budget.textContent(),/Percentual indisponível/);
 assert.equal(await page.locator('[data-search]').isVisible(),false);
 const unified=page.locator('#smartAdminHost .admin-tools input');
 await unified.fill('premium@example.invalid');
 await unified.press('Enter');
 await page.getByRole('button',{name:/Perfil fictício premium/}).waitFor();
 if(process.env.RAYTECH_SCREENSHOTS)await budget.screenshot({path:join(process.env.RAYTECH_SCREENSHOTS,'server-only-orcamento-neutro.png')});
});

test('credit scenarios bind the commercial plan on the server and render six exact balances',async t=>{
 const lab=await startLab(),browser=await chromium.launch();
 t.after(async()=>{await browser.close();await lab.close();});
 const cases=[['free-full','free',2,2],['free-1','free',1,2],['free-0','free',0,2],['premium-full','premium',15,15],
  ['premium-partial','premium',2,15],['premium-0','premium',0,15]];
 const page=await browser.newPage();
 for(const [scenario,plan,remaining,cap] of cases){
  const wrong=plan==='free'?'premium':'free',headers={origin:lab.origin};
  const auth=await page.request.post(lab.origin+'/lab/session',{headers,data:{action:'login',profile:wrong,scenario}});
  const session=await auth.json();
  assert.equal(session.profile,plan);
  const res=await page.request.get(lab.origin+'/v1/credits',{headers:{authorization:'Bearer '+session.token}});
  const actual=await res.json();
  assert.equal(actual.plan,plan);assert.equal(actual.remaining,remaining);
  if(plan==='premium')assert.match(actual.nextRenewalDate,/^\d{4}-\d{2}-01$/);
  else assert.equal(actual.nextRenewalDate,null);
  if(remaining===0){
   const denied=await page.request.post(lab.origin+'/v1/invoices',{headers:{authorization:'Bearer '+session.token,
    'x-request-id':'00000000-0000-4000-8000-000000000092'},
    data:{feature:'invoice-ai',mimeType:file.mimeType,data:file.buffer.toString('base64')}});
   assert.equal(denied.status(),429);
  }
  await page.goto(lab.origin+'/app/?utm_source=codex');
  await page.getByLabel('Perfil experimental').selectOption(wrong);
  await page.getByLabel('Cenário experimental').selectOption(scenario);
  assert.equal(await page.getByLabel('Perfil experimental').inputValue(),plan);
  assert.equal(await page.getByLabel('Perfil experimental').isDisabled(),true);
  await page.getByRole('button',{name:'Entrar com Google'}).click();
  await page.locator('#smartAccountApp').waitFor();
  await page.locator('#headerToolsToggleBtn').click();
  await page.locator('#premiumInvoiceButton').click();
  const modal=page.locator('#ocrModal');
  await modal.getByText('Plano '+(plan==='free'?'Free':'Premium'),{exact:true}).waitFor();
  assert.equal(await modal.locator('[data-count]').textContent(),String(remaining));
  assert.equal(await modal.locator('[data-cap]').textContent(),'de '+cap);
  assert.equal(await modal.locator('[data-used]').textContent(),'Utilizados: '+(cap-remaining));
  const bar=await modal.locator('[data-credit-progress]').evaluate(el=>({value:el.value,max:el.max,height:getComputedStyle(el).height}));
  assert.deepEqual(bar,{value:remaining,max:cap,height:'6px'});
  await page.waitForFunction(()=>!document.querySelector('#ocrModal [data-refresh]').disabled);
  assert.equal(await modal.locator('[data-file]').isDisabled(),remaining===0);
  assert.match(await modal.locator('[data-renewal]').textContent(),plan==='premium'?/Próxima renovação em 01\//:/Vitalícios/);
  if(process.env.RAYTECH_SCREENSHOTS)await modal.screenshot({path:join(process.env.RAYTECH_SCREENSHOTS,'creditos-'+scenario+'.png')});
  await page.keyboard.press('Escape');
  await page.locator('#headerToolsToggleBtn').click();
  await page.locator('#productionCloudLogout').click();
  await page.getByLabel('Cenário experimental').waitFor();
 }
 assert.equal((await page.request.get(lab.origin+'/app?utm_source=codex')).status(),200);
 assert.equal((await page.request.get(lab.origin+'/v1/credits?utm_source=codex')).status(),404);
});

test('compact monitor shows four responsive cards and separates unavailable, zero and simulated consumption',async t=>{
 const lab=await startLab(),browser=await chromium.launch();
 t.after(async()=>{await browser.close();await lab.close();});
 for(const [scenario,columns,label] of [['',2,'indisponivel'],['cost-0',2,'zero'],['cost-75',2,'75'],
  ['cost-125',2,'125'],['cost-75',1,'mobile']]){
  const page=await browser.newPage(columns===1?devices['Pixel 7']:{viewport:{width:1280,height:900}});
  await page.goto(lab.origin+'/app/');
  await page.getByLabel('Perfil experimental').selectOption('owner');
  await page.getByLabel('Cenário experimental').selectOption(scenario);
  await page.getByRole('button',{name:'Entrar com Google'}).click();
  await page.locator('.v345-account summary').click();
  await page.locator('#smartAdminOpen').click();
  await page.getByText('Smart AI Monitor',{exact:true}).click();
  const grid=page.locator('.raytech-ai-monitor-grid');await grid.waitFor();
  assert.equal(await grid.locator(':scope > *').count(),4);
  assert.equal(await grid.evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),columns);
  assert.equal(await page.getByText('Consumo e orçamento indisponíveis.',{exact:true}).count(),0);
  const observed=await grid.locator('[data-finance-observed]').textContent();
  if(!scenario)assert.match(observed,/Aguardando/);
  else if(scenario==='cost-0')assert.match(observed,/R\$\s0,00.*0%/);
  else assert.match(observed,scenario==='cost-75'?/75%/:/125%/);
  await grid.getByLabel('Valor estimado por tentativa em reais').fill('0.5');
  assert.match(await grid.locator('[data-estimate]').textContent(),/Diária: R\$\s15,00.*Mensal: R\$\s30,00/);
  assert.equal(await grid.getByLabel('Limite diário (UTC)').evaluate(el=>getComputedStyle(el).borderRadius),'8px');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(process.env.RAYTECH_SCREENSHOTS)await grid.screenshot({path:join(process.env.RAYTECH_SCREENSHOTS,'monitor-'+label+'.png')});
  await page.close();
 }
 const page=await browser.newPage();
 await page.goto(lab.origin+'/app/');
 await page.getByLabel('Cenário experimental').selectOption('cloud-attention');
 await page.getByRole('button',{name:'Entrar com Google'}).click();
 await page.locator('#headerToolsToggleBtn').click();
 await page.getByText('Atenção · simulação',{exact:true}).waitFor();
 if(process.env.RAYTECH_SCREENSHOTS)await page.locator('#productionCloudPanel').screenshot({path:join(process.env.RAYTECH_SCREENSHOTS,'nuvem-atencao.png')});
 await page.close();
});
