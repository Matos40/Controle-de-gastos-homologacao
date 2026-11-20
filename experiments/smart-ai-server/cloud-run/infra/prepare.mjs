import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {trustedOrigin} from '../cors.mjs';

const projectId='raytech-ai-run-exp-v350';
const expectedImage=/^us-central1-docker\.pkg\.dev\/raytech-ai-run-exp-v350\/raytech-smart-ai\/candidate@sha256:[a-f0-9]{64}$/;
const load=name=>readFile(new URL(name,import.meta.url),'utf8');

export async function prepare({projectNumber,image,origin,secretVersion}){
 if(!/^\d{6,18}$/.test(projectNumber??'')||!expectedImage.test(image??'')||!trustedOrigin(origin,origin)||
    !/^[1-9]\d{0,9}$/.test(secretVersion??''))throw Error('INVALID_ISOLATED_INPUTS');
 const replacements={
  __COMPUTE_PROJECT_ID__:projectId,__COMPUTE_PROJECT_NUMBER__:projectNumber,
  __EXPERIMENT_IMAGE_DIGEST__:image,__EXPERIMENT_HTTPS_ORIGIN__:origin,__SECRET_VERSION_NUMBER__:secretVersion,
 };
 const render=source=>JSON.parse(source.replace(/__[A-Z_]+__/g,key=>replacements[key]??key));
 const [backend,gateway,resources]=await Promise.all(
  ['service.template.json','gateway.template.json','resources.plan.json'].map(async name=>render(await load(name))));
 if(resources.applyAuthorized!==false||backend.metadata.annotations['run.googleapis.com/ingress']!=='internal'||
    [backend,gateway].some(service=>service.metadata.annotations['run.googleapis.com/invoker-iam-disabled']!=='false'||
     service.spec.template.spec.containers[0].env.find(row=>/EXPERIMENT_ENABLED|GATEWAY_ENABLED/.test(row.name))?.value!=='false')){
  throw Error('PREPARATION_LOCK_MISSING');
 }
 return {backend,gateway,resources};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [input,output]=process.argv.slice(2);
 if(!input||!output||process.argv.length!==4)throw Error('Use: node infra/prepare.mjs <inputs.json> <new-directory>');
 const data=await prepare(JSON.parse(await readFile(input,'utf8')));
 const folder=resolve(output);
 await mkdir(folder);
 for(const [name,value] of Object.entries(data)){
  await writeFile(resolve(folder,name+'.json'),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
 }
 console.log('Manifestos locais gerados com serviços desabilitados. Nenhuma chamada Google Cloud.');
}
