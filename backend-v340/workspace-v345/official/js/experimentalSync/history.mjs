// Bounded, append-only experimental review history. First slot retains B1 compatibility.
import {canonical} from '../productionV2/model.mjs';
export const ARCHIVE_SLOTS=8;
export const ARCHIVE_CHARS=2400000;
const fail=()=>{throw Error('EXPERIMENTAL_ARCHIVE_CAPACITY');};
export function archiveRows(storage,key){const out=[];for(let i=0;i<ARCHIVE_SLOTS;i++){const k=i===0?key:key+':'+i,raw=storage.getItem(k);if(raw!==null){if(!out.length&&i!==0||out.length!==i)fail();out.push({key:k,raw,value:JSON.parse(raw)});}}return out;}
export function appendArchive(storage,key,value){const rows=archiveRows(storage,key),encoded=JSON.stringify(value);const existing=rows.find(x=>canonical(x.value)===canonical(value));if(existing)return existing.key;if(rows.length>=ARCHIVE_SLOTS||rows.reduce((a,x)=>a+x.raw.length,0)+encoded.length>ARCHIVE_CHARS)fail();const k=rows.length===0?key:key+':'+rows.length;if(storage.getItem(k)!==null)fail();storage.setItem(k,encoded);if(storage.getItem(k)!==encoded)throw Error('EXPERIMENTAL_ARCHIVE_WRITE');return k;}
