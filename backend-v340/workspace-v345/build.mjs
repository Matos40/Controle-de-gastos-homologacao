import {cp, mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import {build} from 'esbuild';
import postcss from 'postcss';
import tailwind from 'tailwindcss';

const out = 'dist';
await rm(out, {force: true, recursive: true});
await mkdir(out);
await cp('official', out, {recursive: true});
await mkdir(out + '/vendor');

let html = await readFile('official/index.html', 'utf8');
const replace = (pattern, value) => {
  const next = html.replace(pattern, value);
  if (next === html) throw Error('Dashboard template changed: ' + pattern);
  html = next;
};
replace(/<!-- Tailwind CSS -->[\s\S]*?<\/script>\s*<link rel="stylesheet" href="\.\/css\/styles.css">/, `
<link rel="stylesheet" href="./vendor/tailwind.css">
<link rel="stylesheet" href="./vendor/fontawesome/css/all.min.css">
<link rel="stylesheet" href="./vendor/orbitron/latin-800.css">
<link rel="stylesheet" href="./vendor/orbitron/latin-900.css">
<link rel="stylesheet" href="./vendor/jakarta/latin-400.css">
<link rel="stylesheet" href="./vendor/jakarta/latin-500.css">
<link rel="stylesheet" href="./vendor/jakarta/latin-600.css">
<link rel="stylesheet" href="./vendor/jakarta/latin-700.css">
<link rel="stylesheet" href="./vendor/jakarta/latin-800.css">
<script src="./vendor/xlsx.full.min.js"></script>
<script src="./vendor/chart.umd.js"></script>
<link rel="stylesheet" href="./css/styles.css">
<link rel="stylesheet" href="./css/v345.css">`);
replace(/<link href="https:\/\/fonts.googleapis.com[^>]+>/, '');
replace(/<link id="pwaManifestLink"[^>]+>/, '');
replace(/<button\s+type="button"\s+id="(?:premiumApiKeyButton|pwaHeaderBtn)"[\s\S]*?<\/button>/g, '');
replace(/<!-- Modal Chave da API Gemini -->[\s\S]*?(?=  <main class="max-w-6xl)/, `
<dialog id="ocrModal" aria-labelledby="invoiceTitle" class="v345-dialog">
  <h2 id="invoiceTitle">Leitor simulado de fatura</h2>
  <p id="simulatedStatus" role="status"></p>
  <div id="simulatedReview"></div>
  <div class="v345-dialog-actions">
    <button type="button" class="admin-action" id="simulatedClose">Fechar</button>
    <button type="button" class="admin-action" id="simulatedExtract">Gerar amostra</button>
    <button type="button" class="admin-action" id="simulatedConfirm" disabled>Confirmar lançamentos</button>
  </div>
</dialog>
`);
replace(/<button type="button" data-login-enter/, `
<form id="labCredentials" hidden>
  <label>E-mail de teste <input type="email" name="email" required autocomplete="username"></label>
  <label>Senha de teste <input type="password" name="password" required autocomplete="current-password"></label>
</form>
<button type="button" data-login-enter`);
const inspection = html.match(/<button[^>]*id="productionCloudInspect"[^>]*>[\s\S]*?<\/button>/)?.[0];
if (!inspection) throw Error('Firestore review button missing');
replace(inspection, '');
replace(/<p hidden id="productionCloudStatus"/, inspection.replace('Verificar conta', 'Revisar vínculo com Firestore') + '<p hidden id="productionCloudStatus"');
replace(/<button id="smartAdminOpen"[\s\S]*?<\/button>/, '');
replace(/(<header class="raytech-header-shell[^>]*>)/, '$1' + `
<div class="v345-account">
  <span>V34.5 · Homologação · Dados sintéticos</span>
  <span id="v345Avatar" aria-hidden="true"></span><strong id="v345Identity"></strong>
  <button id="smartAdminOpen" hidden type="button" class="admin-action">Smart Admin</button>
  <button id="v345Logout" type="button" class="admin-action">Sair</button>
</div>`);
await writeFile(out + '/index.html', html);
const result = await postcss([tailwind({
  content: [{raw: html, extension: 'html'}, './official/js/**/*.{js,mjs}'],
  darkMode: 'class',
  theme: {extend: {fontFamily: {sans: ['Plus Jakarta Sans', 'sans-serif']}}},
})]).process('@tailwind base; @tailwind components; @tailwind utilities;', {from: undefined});
await writeFile(out + '/vendor/tailwind.css', result.css);
for (const [source, target] of [
  ['xlsx/dist/xlsx.full.min.js', 'xlsx.full.min.js'],
  ['chart.js/dist/chart.umd.js', 'chart.umd.js'],
  ['@fortawesome/fontawesome-free/css', 'fontawesome/css'],
  ['@fortawesome/fontawesome-free/webfonts', 'fontawesome/webfonts'],
  ['@fontsource/orbitron', 'orbitron'],
  ['@fontsource/plus-jakarta-sans', 'jakarta'],
]) await cp('node_modules/' + source, out + '/vendor/' + target, {recursive: true});
for (const [source, target] of [
  ['@fortawesome/fontawesome-free/LICENSE.txt', 'fontawesome/LICENSE.txt'],
  ['xlsx/LICENSE', 'xlsx-LICENSE.txt'],
  ['chart.js/LICENSE.md', 'chart-LICENSE.md'],
  ['tailwindcss/LICENSE', 'tailwind-LICENSE.txt'],
  ['firebase/README.md', 'firebase-NOTICE.md'],
]) await cp('node_modules/' + source, out + '/vendor/' + target);
const entry = 'js/productionV2/smartLoginOfficialBootstrap.mjs';
await build({entryPoints: ['official/' + entry], bundle: true, minify: true,
  treeShaking: true, format: 'esm', target: 'es2022', outfile: out + '/' + entry});
