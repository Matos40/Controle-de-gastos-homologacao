import {readFile, writeFile} from 'node:fs/promises';

const rules = await readFile('online/firestore-additive.rules.txt', 'utf8');
await writeFile('dist-firestore.rules', `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
${rules}
  }
}
`);
