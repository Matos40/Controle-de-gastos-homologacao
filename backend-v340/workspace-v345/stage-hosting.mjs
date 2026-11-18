import {createHash} from 'node:crypto';
import {cp, mkdir, readFile, readdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {version} from './official/release.mjs';

const root = 'dist';
const worker = 'raytech-pwa-sw.js';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const hosting = JSON.parse(await readFile('hosting.json', 'utf8'));
if (Object.keys(hosting).join() !== 'hosting' || hosting.hosting.site !== 'raytech-cg-homologacao' ||
    hosting.hosting.public !== root || hosting.hosting.predeploy || hosting.hosting.postdeploy) {
  throw Error('Destino de Hosting inválido.');
}
const script = await readFile(path.join(root, worker), 'utf8');
const inventory = new Map(JSON.parse(script.match(/^const BUILD = (.*);\r?\n/)[1]).files.map(
  ([url, hash]) => [url.slice(1).split('/').map(decodeURIComponent).join('/'), hash]));
const files = (await readdir(root,{recursive:true, withFileTypes:true}))
  .filter(entry => entry.isFile())
  .map(entry => path.relative(root,path.join(entry.parentPath,entry.name)).split(path.sep).join('/')).sort();
const entries = await Promise.all(files.map(async file => [file, digest(await readFile(path.join(root,file)))]));
if (inventory.size !== files.length - 1 || !files.includes(worker) ||
    entries.some(([file, hash]) => file !== worker && inventory.get(file) !== hash)) {
  throw Error('Inventário PWA diverge dos arquivos do candidato.');
}
const html = await readFile(path.join(root,'index.html'),'utf8');
if (!html.includes('v' + version + '</span>') || !html.includes('V' + version + ' · Homologação')) {
  throw Error('A versão do cabeçalho diverge do release.');
}
await mkdir('hosting-release');
await cp(root, 'hosting-release/dist', {recursive:true});
await cp('hosting.json', 'hosting-release/hosting.json');
await writeFile('hosting-release/expected.json', JSON.stringify(entries));
console.log('V' + version + ' · ' + files.length + ' arquivos verificados');
