import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {initializeTestEnvironment, assertFails, assertSucceeds} from '@firebase/rules-unit-testing';
import {doc, getDoc, setDoc, updateDoc, serverTimestamp, writeBatch} from 'firebase/firestore';
import {chromium} from 'playwright';
import {serve} from './serve.mjs';

const projectId = 'demo-raytech-v340';
const authHost = '127.0.0.1:19099';
const dbHost = '127.0.0.1';
if (process.env.FIREBASE_AUTH_EMULATOR_HOST !== authHost ||
    process.env.FIRESTORE_EMULATOR_HOST !== dbHost + ':18080' ||
    process.env.GCLOUD_PROJECT !== projectId) throw Error('DEMO_EMULATORS_REQUIRED');
let env, server, browser;
const accounts = {};
const account = (db, uid) => doc(db, 'raytechV345Accounts', uid);
const usage = (db, uid) => doc(db, 'raytechV345Usage', uid);
const role = (db, uid) => doc(db, 'raytechV345Roles', uid);
const origin = 'http://127.0.0.1:15003';
const password = 'synthetic-only-345';

async function seedAccount(name, plan, operator) {
  const email = name + '@example.test';
  const response = await fetch('http://' + authHost + '/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-v345', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({email, password, returnSecureToken: true}),
  });
  assert.equal(response.status, 200);
  const uid = (await response.json()).localId;
  accounts[name] = {uid, email};
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(account(db, uid), {uid, name, plan, blocked: false, ...(name === 'premium' ? {limits: {minute: 2, day: 2, month: 100}} : {})});
    if (operator) await setDoc(role(db, uid), {role: operator, active: true});
  });
}
before(async () => {
  env = await initializeTestEnvironment({projectId, firestore: {host: dbHost, port: 18080}});
  for (const [name, plan, operator] of [
    ['owner', 'free', 'owner'], ['admin', 'free', 'admin'],
    ['premium', 'premium'], ['free', 'free'],
  ]) await seedAccount(name, plan, operator);
  server = await serve();
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  await env?.cleanup();
});
const dbAs = name => env.authenticatedContext(accounts[name].uid).firestore();
test('Firestore isolates accounts, protects privileged profiles and requires atomic finance receipts', async () => {
  const premium = accounts.premium.uid;
  const db = dbAs('premium');

  if (process.env.V345_COMBINED_RULES === '1') {
    await assertSucceeds(setDoc(doc(db, 'users', premium, 'test', 'synthetic'), {ok: true}));
    await assertFails(getDoc(doc(dbAs('free'), 'users', premium, 'test', 'synthetic')));
  }
  await assertFails(getDoc(account(db, accounts.free.uid)));
  await assertFails(updateDoc(account(db, premium), {plan: 'free'}));
  await assertFails(setDoc(role(db, premium), {active: true, role: 'owner'}));
  await assertFails(updateDoc(account(dbAs('owner'), accounts.admin.uid), {plan: 'premium'}));
  await assertFails(setDoc(usage(dbAs('free'), accounts.free.uid), {at: serverTimestamp(), minute: 1, day: 1, month: 1}));
  const ref = doc(db, 'raytechV345Finance', premium, 'banks', 'v2-main');
  const op = '12345678-1234-4123-8123-123456789abc';
  const receipt = doc(ref, 'receipts', op);
  const data = {marker: 'raytech-financial-production-v2', revision: 1, lastOperationId: op, hash: 'a'.repeat(64), payload: '{}'};
  await assertFails(setDoc(ref, data));
  const batch = writeBatch(db);
  batch.set(ref, data);
  batch.set(receipt, {operationId: op, parentId: '', revision: 1, hash: data.hash});
  await assertSucceeds(batch.commit());
  await assertFails(getDoc(doc(dbAs('owner'), 'raytechV345Finance', premium, 'banks', 'v2-main')));
  await assertFails(updateDoc(receipt, {hash: 'b'.repeat(64)}));
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    const {deleteDoc} = await import('firebase/firestore');
    const head = doc(db, 'raytechV345Finance', premium, 'banks', 'v2-main');
    await deleteDoc(doc(head, 'receipts', op));
    await deleteDoc(head);
  });
});

async function login(page, name) {
  await page.locator('#labCredentials [name=email]').fill(accounts[name].email);
  await page.locator('#labCredentials [name=password]').fill(password);
  await page.getByRole('button', {name: 'Entrar no laboratório'}).click();
  await page.locator('#smartAccountApp').waitFor({state: 'visible'});
  const skip = page.locator('#onboardingSkip');
  if (await skip.isVisible()) await skip.click();
  await page.waitForFunction(() => window.productionCleanWorkspaceReady === true ||
    new URLSearchParams(location.search).get('workspace') === 'legacy');
}
test('Chromium integrates synthetic finance, review, quota, role changes and session switching', async () => {
  const context = await browser.newContext({viewport: {width: 390, height: 844}, acceptDownloads: true});
  try {
    const external = [];
    await context.route('**/*', route => {
      if (['15003', '19099', '18080'].includes(new URL(route.request().url()).port) &&
          new URL(route.request().url()).hostname === '127.0.0.1') return route.continue();
      external.push(route.request().url());
      return route.abort();
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin);
    await page.evaluate(() => localStorage.setItem('controle_gastos_multimonth_v3', 'banco-original'));
    await login(page, 'premium');
    await page.locator('#salaryInput').fill('2000');
    assert.equal(await page.evaluate(() => appDb.months[appDb.selectedMonth].salary), 2000);
    await page.locator('#headerToolsToggleBtn').click();
    await page.locator('#premiumInvoiceButton').click();
    await page.locator('#simulatedExtract').click();
    await page.locator('#simulatedConfirm').click();
    const readCards = () => page.evaluate(() => appDb.months[appDb.selectedMonth].cardExpenses.length);
    assert.equal(await readCards(), 2);
    await page.locator('#headerToolsToggleBtn').click();
    await page.locator('#premiumInvoiceButton').click();
    await page.locator('#simulatedExtract').click();
    await page.locator('#simulatedConfirm').click();
    assert.match(await page.locator('#simulatedStatus').textContent(), /já foi lançada/);
    assert.equal(await readCards(), 2);
    await page.locator('#simulatedClose').click();

    await page.locator('#headerToolsToggleBtn').click();
    await page.locator('#premiumInvoiceButton').click();
    await page.locator('#simulatedExtract').click();
    await page.getByText(/Cota atingida/).waitFor();
    assert.equal(await page.locator('#simulatedConfirm').isDisabled(), true);
    await page.locator('#simulatedClose').click();
    const head = doc(dbAs('premium'), 'raytechV345Finance', accounts.premium.uid, 'banks', 'v2-main');
    assert.equal((await getDoc(head)).exists(), false);
    const backups = await Promise.all([
      page.waitForEvent('download'),
      page.evaluate(() => exportData()),
    ]);
    assert.match(backups[0].suggestedFilename(), /\.json$/);
    const excel = await Promise.all([page.waitForEvent('download'), page.evaluate(() => exportToExcel())]);
    assert.match(excel[0].suggestedFilename(), /\.xlsx$/);
    await page.locator('#headerToolsToggleBtn').click();
    await page.locator('#productionCloudInspect').click();
    await page.locator('#productionCloudConsent').check();
    await page.locator('#productionCloudBackupSaved').check();
    await page.locator('#productionCloudSeed').click();
    await page.waitForFunction(() => ['online', 'synced'].includes(document.getElementById('productionCloudHeader').dataset.syncState));
    for (let retry = 0; retry < 20 && !(await getDoc(head)).exists(); retry++) {
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    const synced = (await getDoc(head)).data();
    assert.ok(synced, (await page.locator('#productionCloudStatus').textContent()) + ' ' + JSON.stringify(errors));
    assert.match(synced.payload, /Mercado fictício/);
    await context.setOffline(true);
    await page.locator('#salaryInput').fill('2500');
    assert.equal(await page.evaluate(() => appDb.months[appDb.selectedMonth].salary), 2500);
    await context.setOffline(false);
    let remoteSalary = null;
    for (let retry = 0; retry < 30 && remoteSalary !== 2500; retry++) {
      const remote = (await getDoc(head)).data();
      const state = JSON.parse(remote.payload);
      remoteSalary = state.months[state.selectedMonth].salary;
      if (remoteSalary !== 2500) await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert.equal(remoteSalary, 2500);
    await page.goto(origin + '?workspace=v2-clean');
    await page.locator('#smartAccountApp').waitFor({state: 'visible'});
    await page.waitForFunction(() => window.productionCleanWorkspaceReady === true);
    assert.equal(await readCards(), 0);
    await page.goto(origin + '?workspace=legacy');
    await page.locator('#smartAccountApp').waitFor({state: 'visible'});
    assert.equal(await page.evaluate(() => localStorage.getItem('controle_gastos_multimonth_v3')), 'banco-original');
    if (await page.locator('#onboardingSkip').isVisible()) await page.locator('#onboardingSkip').click();
    await page.locator('#v345Logout').click();
    await page.locator('[data-login-enter]').waitFor({state: 'visible'});
    await page.goto(origin);
    await login(page, 'owner');
    await page.setViewportSize({width: 1280, height: 900});
    assert.equal(await readCards(), 0);
    await page.locator('#smartAdminOpen').click();
    const premium = page.locator('.admin-row').filter({hasText: 'premium'});
    await premium.getByRole('button', {name: 'Editar cotas e acesso'}).click();
    await page.getByRole('spinbutton', {name: 'Minuto UTC', exact: true}).fill('1');
    await page.getByRole('button', {name: 'Salvar alterações'}).click();
    await page.getByText(/Alterações salvas/).waitFor();
    assert.equal(await page.locator('.admin-row[data-plan=admin]').getByRole('button').count(), 0);
    assert.equal(external.length, 0, external.join('\n'));
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('a funded local bank advances an empty revision and synchronizes across desktop and mobile', async () => {
  await seedAccount('sync', 'premium');
  const person = accounts.sync.uid;
  const path = db => doc(db, 'raytechV345Finance', person, 'banks', 'v2-main');
  const operationId = '12345678-1234-4123-8123-123456789123';
  const {createHash} = await import('node:crypto');
  const {blank} = await import('./official/js/productionV2/model.mjs');
  const ym = new Date().toISOString().slice(0, 7);
  const payload = JSON.stringify(blank(ym));
  const hash = createHash('sha256').update(payload).digest('hex');
  await env.withSecurityRulesDisabled(async context => {
    const head = path(context.firestore());
    await setDoc(head, {marker: 'raytech-financial-production-v2', revision: 1, lastOperationId: operationId, payload, hash});
    await setDoc(doc(head, 'receipts', operationId), {operationId, revision: 1, parentId: '', hash});
  });
  const desktop = await browser.newContext({viewport: {width: 1280, height: 900}});
  const mobile = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true});
  try {
    const pc=await desktop.newPage(), phone=await mobile.newPage();
    async function review(p) {
      await p.locator('#headerToolsToggleBtn').click();
      await p.locator('#productionCloudInspect').click();
      await p.locator('#productionCloudConsent').check();
      await p.locator('#productionCloudBackupSaved').check();
    }
    await pc.goto(origin);
    await login(pc, 'sync');
    await pc.locator('#salaryInput').fill('2070');
    await review(pc);
    assert.match(await pc.locator('#productionCloudPlan').textContent(), /sem dados financeiros/);
    assert.equal(await pc.locator('#productionCloudAdopt').isVisible(),false);
    await pc.locator('#productionCloudSeed').click();
    await pc.locator('#productionCloudHeader[data-sync-state=synced]').waitFor({timeout:5000}).catch(async e=>{throw Error(await pc.locator('#productionCloudStatus').textContent(),{cause:e});});
    const head = path(dbAs('sync'));
    assert.equal((await getDoc(head)).data().revision, 2);
    assert.equal((await getDoc(doc(head, 'receipts', operationId))).data().hash, hash);
    await phone.goto(origin);
    await login(phone, 'sync');
    assert.notEqual(await phone.locator('#productionCloudHeader').getAttribute('data-sync-state'),'synced');
    await review(phone);
    await phone.locator('#productionCloudAdopt').click();
    await phone.locator('#productionCloudHeader[data-sync-state=synced]').waitFor({timeout:6000}).catch(async e=>{throw Error(await phone.locator('#productionCloudStatus').textContent(),{cause:e});});
    async function propagate(source, destination, salary, direction) {
      const start = Date.now();
      await source.locator('#salaryInput').fill(String(salary));
      await source.locator('#salaryInput').blur();
      assert.notEqual(await source.locator('#productionCloudHeader').getAttribute('data-sync-state'),'synced');
      await destination.waitForFunction(value => appDb.months[appDb.selectedMonth].salary === value, salary, {timeout:10000});
      console.log(direction + ' ' + (Date.now()-start) + ' ms');
      await destination.locator('#productionCloudHeader[data-sync-state=synced]').waitFor({timeout:10000});
    }
    await propagate(pc,phone,2180,'desktop -> mobile');
    await propagate(phone,pc,2290,'mobile -> desktop');
    assert.equal((await getDoc(head)).data().revision,4);
  } finally {await mobile.close();await desktop.close();}
});
