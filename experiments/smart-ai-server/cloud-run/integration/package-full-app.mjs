import {cp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {native,officialCopyPaths,officialRoot,stripPersonalReader} from './full-app-assets.mjs';
const target=process.argv[2];
if(!target)throw Error('PACKAGE_DIRECTORY_REQUIRED');
const base=native?'official-34745':'backend-v340/workspace-v345/official';
for(const path of officialCopyPaths){
 const to=resolve(target,base,path);
 await mkdir(dirname(to),{recursive:true});
 if(path==='index.html')await writeFile(to,stripPersonalReader(await readFile(new URL(path,officialRoot),'utf8')));
 else await cp(new URL(path,officialRoot),to);
}
