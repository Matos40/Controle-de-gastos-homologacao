import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {chromium} from 'playwright';
import {version} from './official/release.mjs';

const dist = new URL('./dist/', import.meta.url);
const origin = 'https://raytech-cg-homologacao.web.app';
const authFixture = `
export async function openSmartLoginAuth() {
  const profile = sessionStorage.getItem('fixture-profile');
  const uid = 'fixture-' + profile;
  return {invoiceBackendAvailable:false,currentUid:()=>uid,
    onSession:fn=>fn({uid,displayName:'Pessoa Google fictícia'}),
    profile:async()=>({uid,plan:profile==='premium'?'premium':'free',blocked:false}),
    role:async()=>['owner','admin'].includes(profile)?profile:null,
    watchAccount:()=>()=>{},watchRole:()=>()=>{},admin:()=>({}),
    extractInvoice:()=>{window.fixtureUnsafeCalls++;throw Error('Unexpected invoice');},
    authorizeInvoice:()=>{window.fixtureUnsafeCalls++;throw Error('Unexpected authorization');}};
}`;
const cloudFixture = `
export async function openProductionCloud() {
  const uid = 'fixture-' + sessionStorage.getItem('fixture-profile');
  return {currentUid:()=>uid,onSession:fn=>fn({uid,displayName:'Pessoa Google fictícia'}),
    approved:async who=>{if(who!==uid)throw Error('UID');window.fixtureCloudReads++;return {writeEnabled:sessionStorage.getItem('fixture-profile')!=='free'};},
    read:async who=>{if(who!==uid)throw Error('UID');window.fixtureCloudReads++;return null;},
    send:async()=>{window.fixtureUnsafeCalls++;throw Error('Unexpected write');}};
}`;
const mime = {html:'text/html',css:'text/css',mjs:'text/javascript',js:'text/javascript',png:'image/png',
  woff2:'font/woff2',webmanifest:'application/manifest+json',svg:'image/svg+xml'};

test('published shell has one version, preserved backup controls and isolated Hosting configuration', async () => {
  const html = await readFile(new URL('index.html', dist), 'utf8');
  for (const id of ['pwaInstalledBadge','raytechHeaderVersion','raytechInstallVersion','smartPwaOpen',
    'smartPwaNotice','smartAdminOpen','premiumInvoiceButton','premiumApiKeyButton','productionCloudInspect']) {
    assert.equal(html.split('id="' + id + '"').length, 2, id);
  }
  for (const action of ['exportToExcel','exportData','productionCloudBackup','handleJsonImport']) {
    assert.ok(html.includes(action), action);
  }
  assert.ok(html.includes('v' + version + '</span>'));
  assert.ok(html.includes('V' + version + ' · Homologação · Dados sintéticos'));
  const hosting = JSON.parse(await readFile(new URL('./hosting.json', import.meta.url)));
  assert.deepEqual(Object.keys(hosting), ['hosting']);
  assert.equal(hosting.hosting.site, 'raytech-cg-homologacao');
});

test('protected UX hooks retain the original Premium presentation and cloud logout', async () => {
  const html = await readFile(new URL('index.html', dist), 'utf8');
  assert.match(html, /<dialog id="premiumAiNotice"[^>]*>[\s\S]*?Recurso exclusivo Premium[\s\S]*?premiumAiNoticeClose/);
  assert.match(html, /<div class="v345-account" hidden>/);
  assert.ok(!html.includes('id="v3468Logout"'));
  assert.match(html, /id="incomeBaseHelpToggle"[^>]*aria-controls="incomeBaseHelp"/);
  assert.match(html, /id="productionCloudProfile"[\s\S]*?id="productionCloudLogout"/);
});

test('online homologation renders all four profiles without enabling IA or bypassing cloud consent', {timeout:45000}, async t => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  for (const profile of ['owner','admin','premium','free']) {
    const context = await browser.newContext({serviceWorkers:'block'});
    await context.addInitScript(profile => {
      sessionStorage.setItem('fixture-profile',profile);
      window.fixtureUnsafeCalls=window.fixtureCloudReads=0;
    }, profile);
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      const file = url.pathname.slice(1) || 'index.html';
      const contentType = mime[file.split('.').at(-1)] ?? 'application/octet-stream';
      const body = file.endsWith('/smartLoginOfficialBootstrap.mjs')
        ? await readFile(new URL('./official/' + file, import.meta.url))
        : file.endsWith('/smartLoginOfficialAuth.mjs') ? authFixture
        : file.endsWith('/firebaseAdapter.mjs') ? cloudFixture
        : await readFile(new URL(file, dist));
      await route.fulfill({contentType, body});
    });
    const page = await context.newPage();
    page.setDefaultTimeout(6000);
    await page.goto(origin);
    await page.locator('#smartAccountApp').waitFor({state:'visible'});
    await page.waitForFunction(() => document.querySelector('#productionCloudStatus')?.textContent.startsWith('Conta Google conectada.'));
    assert.match(await page.locator('#v345Identity').textContent(), /Pessoa Google fictícia/);
    for (const width of [1280,390]) {
      await page.setViewportSize({width,height:844});
      const privileged = ['owner','admin'].includes(profile);
      assert.equal(await page.locator('.v345-profile').isVisible(), privileged);
      assert.equal(await page.locator('.v345-environment').isVisible(), privileged);
      if (!privileged) assert.equal(await page.locator('.v345-account').evaluate(node=>node.getBoundingClientRect().height), 0);
      assert.ok(await page.locator('#pwaInstalledBadge').isVisible());
      assert.equal(await page.locator('#raytechHeaderVersion').textContent(), 'v' + version);
      assert.ok(await page.locator('#raytechHeaderVersion').isVisible());
      const help = page.getByRole('button',{name:'Ajuda sobre renda base'});
      assert.ok(await help.evaluate(btn=>btn.getBoundingClientRect().left-btn.previousElementSibling.getBoundingClientRect().right>=6));
      await help.click();
      assert.equal(await help.getAttribute('aria-expanded'),'true');
      assert.ok(await page.locator('#incomeBaseHelp').isVisible());
      await help.click();
      assert.equal(await page.locator('#incomeBaseHelp').isVisible(),false);
      await page.locator('#headerToolsToggleBtn').click();
      const securityButtons = await page.locator('#smartPwaOpen').evaluate(button =>
        [...button.parentElement.querySelectorAll(':scope > button')].map(item=>item.textContent.trim()));
      assert.deepEqual(securityButtons,['Chave API','Senha PIN','Instalar App']);
      assert.equal(await page.locator('#productionCloudName').textContent(),'Pessoa Google fictícia');
      assert.equal(await page.locator('#productionCloudPlanLabel').textContent(),profile==='premium'?'Premium':'Free');
      assert.ok(await page.locator('#productionCloudLogout').isEnabled());
      assert.ok(await page.locator('#premiumInvoiceIndicator').evaluate((icon,premium)=>icon.classList.contains(premium?'fa-crown':'fa-lock')&&icon.classList.contains('text-amber-400'),profile==='premium'));
      await page.locator('#premiumInvoiceButton').click();
      const invoice = page.getByRole('dialog',{name:'Leitor de fatura com IA'});
      if (profile === 'premium') {
        assert.match(await invoice.locator('#simulatedStatus').textContent(), /desativado/);
        assert.ok(await invoice.locator('#simulatedExtract').isDisabled());
        assert.ok(await invoice.locator('#simulatedConfirm').isDisabled());
        for (const id of ['ocrDropZone','ocrProcessBtn']) {
          assert.ok(await invoice.locator('#'+id).isVisible());
          assert.ok(await invoice.locator('#'+id).isDisabled());
        }
        await invoice.getByRole('button',{name:'Fechar'}).click();
      } else {
        assert.equal(await invoice.isVisible(),false);
        const offer = page.getByRole('dialog',{name:'Recurso exclusivo Premium'});
        assert.ok(await offer.isVisible());
        await offer.getByRole('button',{name:'Entendi'}).click();
      }
      await page.locator('#headerToolsToggleBtn').click();
      await page.locator('#premiumApiKeyButton').click();
      const key = page.getByRole('dialog',{name:'Chave Gemini API'});
      assert.equal(await key.locator('input').count(),0);
      await key.getByRole('button',{name:'Fechar'}).click();
    }
    await page.locator('#headerToolsToggleBtn').click();
    const review = page.locator('#productionCloudInspect');
    if (profile === 'free') {
      assert.equal(await review.isVisible(),false);
      await review.evaluate(button=>button.click());
      assert.equal(await page.evaluate(()=>window.fixtureCloudReads),0);
    } else if (profile === 'premium') {
      assert.ok(await review.isVisible());
      assert.equal(await page.evaluate(()=>window.fixtureCloudReads),0);
      await review.click();
      await page.locator('#productionCloudPlan').getByText(/Na nuvem/).waitFor();
      assert.equal(await page.locator('#productionCloudConsent').isChecked(),false);
      assert.equal(await page.locator('#productionCloudBackupSaved').isChecked(),false);
    }
    assert.deepEqual(await page.evaluate(() => window.fixtureUnsafeCalls),0);
    await context.close();
  }
});
