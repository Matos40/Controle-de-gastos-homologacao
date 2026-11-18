import {readFile,writeFile} from 'node:fs/promises';
const original=await readFile('online/firestore-additive.rules.txt','utf8');
const start=original.indexOf('match /raytechV345Usage/{uid}');
const end=original.indexOf('match /raytechV345Finance/',start);
if(start<0||end<0)throw Error('INVALID_RULES');
const block=original.slice(0,start)+'match /raytechV345Usage/{uid} { allow read, write: if false; }\n\n'+original.slice(end);
await writeFile('dist-firestore.rules',"rules_version = '2';\nservice cloud.firestore { match /databases/{database}/documents {\n"+block+"\nmatch /{document=**} { allow read, write: if false; }\n}}\n");
