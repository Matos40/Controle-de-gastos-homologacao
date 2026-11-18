import {googleProfileFromAdmin} from '../official/js/productionV2/googleAdminProfile.mjs';

const project = 'raytech-cg-homologacao';
const token = process.env.RAYTECH_HML_ADMIN_ACCESS_TOKEN;
const apply = process.argv.slice(2).includes('--apply');
if (!token || process.argv.slice(2).some(arg => arg !== '--apply')) {
  throw Error('Provide an authorized short-lived OAuth token and optionally --apply.');
}

const rulesApi = 'https://firebaserules.googleapis.com/v1/';
const authApi = 'https://identitytoolkit.googleapis.com/v1/projects/' + project;
const documents = 'https://firestore.googleapis.com/v1/projects/' + project + '/databases/(default)/documents';

async function request(url, method = 'GET', body) {
  const response = await fetch(url, {
    method, headers: {Authorization: 'Bearer ' + token, 'Content-Type': 'application/json'},
    body: body == null ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw Error(method + ' ' + new URL(url).hostname + ' HTTP ' + response.status);
  return response.json();
}

const release = await request(rulesApi + 'projects/' + project + '/releases/cloud.firestore');
if (apply) {
  const ruleset = await request(rulesApi + release.rulesetName);
  if (!ruleset.source.files.some(file => file.content.includes('function validGoogleProfile(') &&
      file.content.includes("affectedKeys().hasOnly(['googleProfile'])"))) {
    throw Error('The authorized Google profile rules are not active.');
  }
}

const records = [];
let pageToken;
do {
  const query = new URLSearchParams({pageSize: '50'});
  if (pageToken) query.set('pageToken', pageToken);
  const page = await request(documents + '/raytechHml34741Accounts?' + query);
  records.push(...(page.documents ?? []));
  pageToken = page.nextPageToken;
} while (pageToken);

const totals = {checked: records.length, changes: 0, applied: 0, skipped: 0};
for (let offset = 0; offset < records.length; offset += 50) {
  const batch = records.slice(offset, offset + 50);
  const localId = batch.map(record => record.name.split('/').at(-1));
  const auth = await request(authApi + '/accounts:lookup', 'POST', {localId});
  const byUid = new Map((auth.users ?? []).map(user => [user.localId, user]));
  for (const [index, record] of batch.entries()) {
    const uid = localId[index];
    const user = byUid.get(uid);
    if (record.fields?.uid?.stringValue !== uid || !user) { totals.skipped++; continue; }
    const stored = record.fields?.googleProfile?.mapValue?.fields;
    const existing = stored && Object.fromEntries(Object.entries(stored).map(([key, value]) =>
      [key, value.stringValue ?? Number(value.integerValue)]));
    const next = googleProfileFromAdmin(user, existing);
    if (!next) continue;
    totals.changes++;
    if (!apply) continue;
    const query = new URLSearchParams({'updateMask.fieldPaths': 'googleProfile',
      'currentDocument.updateTime': record.updateTime});
    const fields = Object.fromEntries(Object.entries(next).map(([key, value]) =>
      [key, typeof value === 'string' ? {stringValue: value} : {integerValue: String(value)}]));
    await request(documents + '/raytechHml34741Accounts/' + encodeURIComponent(uid) + '?' + query, 'PATCH',
      {fields: {googleProfile: {mapValue: {fields}}}});
    totals.applied++;
  }
}
console.log(JSON.stringify({project, mode: apply ? 'apply' : 'dry-run', ruleset: release.rulesetName, ...totals}));
