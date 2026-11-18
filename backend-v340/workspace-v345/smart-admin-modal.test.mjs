import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {chromium} from 'playwright';

const origin = 'http://localhost:34742';
const uid = 'synthetic-fixture-full-uid-123456789012345678901234567890';
const accounts = [
  {uid, name: 'Nome provisionado', plan: 'free', blocked: false,
    googleProfile: {name: 'Pessoa fictícia', email: 'fixture@example.test', photo: '',
      createdAtMs: 1700000000123, lastLoginSeconds: 1700000500},
    limits: {minute: 3, day: 20, month: 100}, usageUnavailable: true},
  {uid: 'owner', name: 'Owner fictício', role: 'owner', plan: 'free', blocked: false,
    photo: 'https://lh3.googleusercontent.com/a/synthetic-profile'},
  {uid: 'admin', name: 'Admin fictício', role: 'admin', plan: 'free', blocked: false},
];

test('modal compacto responsivo preserva proteção, cópia, cancelamento e edição', {timeout: 30000}, async t => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const context = await browser.newContext({permissions: ['clipboard-read', 'clipboard-write']});
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.href === 'https://lh3.googleusercontent.com/a/synthetic-profile') {
      return route.fulfill({contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8"/></svg>'});
    }
    if (url.origin !== origin) return route.abort();
    if (url.pathname === '/') {
      return route.fulfill({contentType: 'text/html; charset=utf-8', body: `
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="stylesheet" href="/vendor/tailwind.css">
        <link rel="stylesheet" href="/css/v345.css">
        <button id="smartAdminOpen" hidden>Smart Admin</button><section id="smartAdminHost" hidden></section>`});
    }
    if (!/^\/(css\/v345\.css|vendor\/tailwind\.css|js\/productionV2\/(smartAdmin(?:View|Identity)|googleAdminProfile)\.mjs)$/.test(url.pathname)) {
      return route.abort();
    }
    const contentType = url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript';
    await route.fulfill({contentType, body: await readFile(new URL('./dist' + url.pathname, import.meta.url))});
  });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  await page.goto(origin);
  await page.evaluate(async accounts => {
    const {mountAdmin} = await import('/js/productionV2/smartAdminView.mjs');
    const {adminIdentity} = await import('/js/productionV2/googleAdminProfile.mjs');
    window.changes = [];
    mountAdmin({uid: 'operator', role: 'admin', api: {
      role: async () => 'admin', list: async () => accounts.map(adminIdentity), audit: async () => [],
      monitor: async () => ({unavailable: true}),
      change: async (...args) => { window.changes.push(args); },
    }});
  }, accounts);
  await page.getByRole('button', {name: 'Smart Admin', exact: true}).click();
  const dialog = page.getByRole('dialog');
  const openDetails = name => page.getByRole('button', {name: 'Exibir detalhes de ' + name}).click();
  await page.getByRole('button', {name: 'Exibir detalhes de Pessoa fictícia'}).waitFor();
  const rows = page.locator('.admin-row');
  assert.equal(await page.locator('.admin-stat').count(), 6);
  assert.equal(await rows.locator('[data-role=owner]').textContent(), 'Owner');
  assert.equal(await rows.locator('[data-role=admin]').textContent(), 'Admin');
  assert.equal(await rows.first().locator('.v345-admin-avatar').textContent(), 'PF');
  await rows.filter({hasText: 'Owner fictício'}).locator('.v345-admin-avatar img').waitFor();
  assert.equal(await rows.first().getByRole('button').count(), 1);
  const search = page.getByRole('searchbox', {name: 'Buscar contas'});
  for (const query of ['Pessoa fictícia', 'fixture@example.test']) {
    await search.fill(query);
    assert.equal(await rows.count(), 1);
    assert.ok(await rows.first().getByText('fixture@example.test').isVisible());
  }
  await search.fill('');
  for (const [width, height, columns] of [[1366, 768, 2], [1024, 600, 2], [390, 640, 1], [320, 568, 1]]) {
    await page.setViewportSize({width, height});
    const rowLayout = await rows.first().evaluate(row => ({
      bands: Array.from(row.children, cell => getComputedStyle(cell).gridRowStart),
      columns: getComputedStyle(row).gridTemplateColumns.split(' ').length,
      overflow: row.scrollWidth - row.clientWidth,
      emailBelow: row.children[1].offsetTop >= row.children[0].offsetTop + row.children[0].offsetHeight,
    }));
    assert.equal(rowLayout.columns, columns === 2 ? 7 : 3);
    assert.equal(rowLayout.emailBelow, columns === 1);
    assert.ok(rowLayout.overflow <= 1);
    if (columns === 2) assert.deepEqual(new Set(rowLayout.bands), new Set(['auto']));
    await openDetails('Pessoa fictícia');
    assert.ok(await dialog.getByRole('heading', {name: 'Pessoa fictícia'}).isVisible());
    assert.ok(await dialog.getByText('Smart AI Usage').isVisible());
    assert.equal(await dialog.getByText('—', {exact:true}).count(), 0);
    const layout = await dialog.evaluate(node => ({
      columns: getComputedStyle(node.querySelector('.admin-detail-columns')).gridTemplateColumns.split(' ').length,
      quotaTops: Array.from(node.querySelectorAll('input'), input => input.getBoundingClientRect().top),
      width: node.clientWidth, overflowX: node.scrollWidth - node.clientWidth,
      overflowY: node.scrollHeight - node.clientHeight,
    }));
    assert.equal(layout.columns, columns);
    assert.equal(new Set(layout.quotaTops).size, 1);
    assert.ok(layout.width < width && layout.overflowX <= 1);
    if (columns === 2) {
      assert.ok(layout.width >= 790 && layout.overflowY <= 1);
      for (const name of ['Cancelar', 'Salvar alterações']) {
        const box = await dialog.getByRole('button', {name, exact: true}).boundingBox();
        assert.ok(box && box.y + box.height <= height);
      }
    }
    await dialog.getByRole('button', {name: 'Copiar UID'}).click();
    await dialog.getByText('UID copiado.').waitFor();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), uid);
    await dialog.getByRole('button', {name: 'Cancelar'}).click();
  }

  for (const name of ['Owner fictício', 'Admin fictício']) {
    await openDetails(name);
    assert.ok(await dialog.getByText('Conta protegida').isVisible());
    assert.equal(await dialog.locator('input, select, button[type=submit]').count(), 0);
    await dialog.getByRole('button', {name: 'Fechar', exact: true}).click();
  }
  assert.deepEqual(await page.evaluate(() => window.changes), []);
  await openDetails('Pessoa fictícia');
  await dialog.getByRole('combobox', {name: 'Plano'}).selectOption('premium');
  await dialog.getByRole('combobox', {name: 'Situação'}).selectOption('true');
  const minute = dialog.getByRole('spinbutton', {name: 'Minuto UTC'});
  await minute.fill('30');
  const save = dialog.getByRole('button', {name: 'Salvar alterações'});
  await save.click();
  await dialog.getByText(/Cotas inválidas/).waitFor();
  assert.deepEqual(await page.evaluate(() => window.changes), []);
  await minute.fill('4');
  await dialog.getByRole('spinbutton', {name: 'Dia UTC'}).fill('22');
  await dialog.getByRole('spinbutton', {name: 'Mês UTC'}).fill('120');
  await save.click();
  await dialog.waitFor({state: 'hidden'});
  assert.deepEqual(await page.evaluate(() => window.changes), [
    [uid, {plan: 'premium', blocked: true, limits: {minute: 4, day: 22, month: 120}}],
  ]);
});
