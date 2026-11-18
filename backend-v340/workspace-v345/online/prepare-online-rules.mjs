import {readFile,writeFile} from 'node:fs/promises';
const block=await readFile(new URL('./firestore-hml34741.rules.txt',import.meta.url),'utf8');
await writeFile(new URL('./generated-online.rules',import.meta.url),"rules_version = '2';\nservice cloud.firestore { match /databases/{database}/documents {\n"+block+"\nmatch /{document=**} { allow read, write: if false; }\n}}\n");
