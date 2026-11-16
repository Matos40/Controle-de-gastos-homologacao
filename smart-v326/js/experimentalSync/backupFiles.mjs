// Decoding only. No storage mutation or automatic propagation.
import {decodeMainBackup,encodeMainBackup} from '../productionV2/cleanWorkspace.mjs';
const fail=()=>{throw Error('EXPERIMENTAL_BACKUP_FILE');};
const normalize=x=>encodeMainBackup(decodeMainBackup(x));
export function decodeJsonFile(text){if(typeof text!=='string'||text.length>2000000)fail();return normalize(JSON.parse(text));}
export function decodeExcelRows(rows){
 if(!Array.isArray(rows)||!rows.length||rows.length>7)fail();
 const chunks=rows.map((r,i)=>{if(!r||r.Formato!=='RAYTECH_BACKUP'||r.Versão!==1||r.Parte!==i+1||r.Total!==rows.length||typeof r.JSON!=='string'||!r.JSON.length||r.JSON.length>30000)fail();return r.JSON;});
 return decodeJsonFile(chunks.join(''));
}
export function decodeExcelFile(bytes,XLSX){
 if(!(bytes instanceof Uint8Array)||bytes.byteLength>2000000||bytes.byteLength<1)fail();
 const wb=XLSX.read(bytes,{type:'array',sheetRows:9});
 const names=wb.SheetNames.filter(n=>n.toLowerCase().includes('backup'));
 if(names.length!==1||names[0]!=='Backup restauracao')fail();
 const sheet=wb.Sheets[names[0]];if(sheet['!fullref']&&sheet['!fullref']!==sheet['!ref'])fail();
 const rows=XLSX.utils.sheet_to_json(sheet,{defval:''});return decodeExcelRows(rows);
}
