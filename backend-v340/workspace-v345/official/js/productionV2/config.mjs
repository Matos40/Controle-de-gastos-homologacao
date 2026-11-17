export const ORIGIN='http://127.0.0.1:15003';
export const PRODUCTION_CONFIG=Object.freeze({enabled:true,syncEnabled:true,firebase:Object.freeze({projectId:'demo-raytech-v340'})});
export function requireProductionConfig(config=PRODUCTION_CONFIG,location=globalThis.location){if(location?.origin!==ORIGIN||config!==PRODUCTION_CONFIG)throw Error('LAB_ONLY');return config.firebase;}
