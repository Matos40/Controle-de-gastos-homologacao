import {readFile, writeFile} from 'node:fs/promises';

const block = await readFile('online/firestore-additive.rules.txt', 'utf8');
const [base] = process.argv.slice(2);
const anchor = 'match /databases/{database}/documents {';
const wrap = `rules_version = '2';
service cloud.firestore {
  ${anchor}
  }
}
`;
const rules = base ? await readFile(base, 'utf8') : wrap;
const sections = rules.split(anchor);
if (sections.length !== 2 || rules.includes('raytechV345')) throw Error('EXPECTED_UNMODIFIED_FIRESTORE_RULES');
await writeFile('dist-firestore.rules', sections[0] + anchor + '\n' + block + '\n' + sections[1]);
