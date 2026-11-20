import {cp,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {native,officialCopyPaths,officialRoot} from './full-app-assets.mjs';
const target=process.argv[2];
if(!target)throw Error('PACKAGE_DIRECTORY_REQUIRED');
const base=native?'official-34745':'backend-v340/workspace-v345/official';
for(const path of officialCopyPaths){
 const to=resolve(target,base,path);
 await mkdir(dirname(to),{recursive:true});
 await cp(new URL(path,officialRoot),to);
}
