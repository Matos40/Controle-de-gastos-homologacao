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
  const lab=await startLab(),browser=await engine.launch();
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
  assert.equal(await review.getByText(/38,55/).count(),2);
  assert.equal(await review.getByLabel('Parcela atual').inputValue(),'2');
  assert.equal(await review.getByLabel('Valor em centavos').last().inputValue(),'-625');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(process.env.RAYTECH_SCREENSHOTS)await page.screenshot({path:join(process.env.RAYTECH_SCREENSHOTS,name+'-revisao.png'),fullPage:true});
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
 const lab=await startLab({mode:'suspended'}),browser=await chromium.launch();
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
