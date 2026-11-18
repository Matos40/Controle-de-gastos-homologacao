// Candidate restricted to local emulators.
export const ORIGIN='http://127.0.0.1:15003';
const localFirebase=Object.freeze({projectId:'demo-raytech-v340',apiKey:'demo-v345'});
export const PRODUCTION_CONFIG=Object.freeze({enabled:true,syncEnabled:true,firebase:localFirebase});
export function requireProductionConfig(config=PRODUCTION_CONFIG,location=globalThis.location){
 if(config!==PRODUCTION_CONFIG||location?.origin!==ORIGIN)throw Error('V3473_LOCAL_ONLY');return localFirebase;
}
export async function environment(){return {local:true,firebase:requireProductionConfig()};}
