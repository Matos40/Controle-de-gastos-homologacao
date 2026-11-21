import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,existsSync} from 'node:fs';
import {basename,dirname,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const home=dirname(fileURLToPath(import.meta.url));
const contract=JSON.parse(readFileSync(resolve(home,'trial-launch-contract.json'),'utf8'));
const expected={
 service:['trial-control-runtime.mjs','trialControlConfig'],
 worker:['trial-job-runtime.mjs','runSyntheticTrialJob'],
 controller:['trial-execution-approval.mjs','runControllerFromEnv']
};
for(const [role,[file,entry]] of Object.entries(expected)){
 test('08.6.4.11: '+role+' is a real file-backed ESM entrypoint',async()=>{
  const config=contract[role];
  assert.deepEqual(config.command,['node']);
  assert.deepEqual(config.args,[
   '/app/experiments/smart-ai-server/cloud-run/bridge-runtime/'+file]);
  assert.equal(config.args.length,1);
  const entryfile=resolve(home,basename(config.args[0]));
  assert.ok(existsSync(entryfile),'missing checked-in entrypoint '+entryfile);
  // Must resolve the real relative import graph, never a data: parent URL.
  const loaded=await import(pathToFileURL(entryfile).href);
  assert.equal(typeof loaded[entry],'function');
 });
}
test('08.6.4.11: execution contract prohibits inline JS, data URLs and eval',()=>{
 const text=JSON.stringify(contract);
 assert.ok(!text.includes('data:text/javascript'));
 assert.ok(!text.includes('--eval'));
 assert.ok(!text.includes('--input-type'));
 assert.ok(!text.includes(' -e '));
 assert.deepEqual(Object.keys(contract).filter(k=>k!=='description').sort(),
  ['controller','service','worker']);
});
