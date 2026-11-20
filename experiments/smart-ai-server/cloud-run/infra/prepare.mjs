import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {trustedOrigin} from '../cors.mjs';
import {BACKEND_AUDIENCE,COMPUTE_PROJECT,COMPUTE_PROJECT_NUMBER,FIREBASE_PROJECT,REGION,RUNTIME_IDENTITY} from '../projects.mjs';

const imagePrefix=REGION+'-docker.pkg.dev/'+COMPUTE_PROJECT+'/raytech-smart-ai/candidate@sha256:';
const prohibitedHost=/^(?:matos40\.github\.io|(?:www\.)?raytech\.ia\.br|(?:raytech-cg-producao|raytech-cg-homologacao|raytech-3d)\.(?:web\.app|firebaseapp\.com))$/;
const load=name=>readFile(new URL(name,import.meta.url),'utf8');

export async function prepare({projectId=COMPUTE_PROJECT,projectNumber,image,origin,secretVersion}){
 if(projectId!==COMPUTE_PROJECT||projectNumber!==COMPUTE_PROJECT_NUMBER||typeof image!=='string'||
    !image.startsWith(imagePrefix)||!/^[a-f0-9]{64}$/.test(image.slice(imagePrefix.length))||
    !trustedOrigin(origin,origin)||prohibitedHost.test(new URL(origin).hostname)||
    !/^[1-9]\d{0,9}$/.test(secretVersion??''))throw Error('INVALID_ISOLATED_INPUTS');
 const replacements={
  __COMPUTE_PROJECT_ID__:projectId,__COMPUTE_PROJECT_NUMBER__:projectNumber,
  __EXPERIMENT_FIREBASE_PROJECT__:FIREBASE_PROJECT,__BACKEND_AUDIENCE__:BACKEND_AUDIENCE,
  __EXPERIMENT_IMAGE_DIGEST__:image,__EXPERIMENT_HTTPS_ORIGIN__:origin,__SECRET_VERSION_NUMBER__:secretVersion,
 };
 const render=source=>JSON.parse(source.replace(/__[A-Z_]+__/g,key=>replacements[key]??key));
 const [backend,gateway,resources,iam,monitoring]=await Promise.all(
  ['service.template.json','gateway.template.json','resources.plan.json','permissions.json','monitoring.json']
   .map(async name=>render(await load(name))));
 const backendEnv=Object.fromEntries(backend.spec.template.spec.containers[0].env.map(row=>[row.name,row.value]));
 if([resources,iam,monitoring].some(plan=>plan.applyAuthorized!==false)||
    resources.budgetPush.enabled!==false||backendEnv.SMART_AI_FINANCE_PUSH_ENABLED!=='false'||
    backendEnv.SMART_AI_RUNTIME_IDENTITY!==RUNTIME_IDENTITY||backendEnv.FIREBASE_PROJECT_ID!==FIREBASE_PROJECT||
    resources.projectId!==COMPUTE_PROJECT||iam.firebaseProject!==FIREBASE_PROJECT||
    backend.metadata.annotations['run.googleapis.com/ingress']!=='internal'||
    [backend,gateway].some(service=>service.metadata.annotations['run.googleapis.com/invoker-iam-disabled']!=='false'||
     service.spec.template.spec.containers[0].env.find(row=>/EXPERIMENT_ENABLED|GATEWAY_ENABLED/.test(row.name))?.value!=='false')){
  throw Error('PREPARATION_LOCK_MISSING');
 }
 return {backend,gateway,resources,iam,monitoring};
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
