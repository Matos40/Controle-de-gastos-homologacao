// Explicit project and origin binding. No production project or arbitrary endpoint.
export const ORIGIN='http://127.0.0.1:15003';
const onlineOrigins=new Set(['https://raytech-cg-homologacao.web.app','https://raytech-cg-homologacao.firebaseapp.com']);
const localFirebase=Object.freeze({projectId:'demo-raytech-v340',apiKey:'demo-v345'});
const onlineFirebase=Object.freeze({
  apiKey: 'AIzaSyAlOok-2bV9QigR6PyjRgHMLjFLIoPDWpw',
  authDomain: 'raytech-cg-homologacao.firebaseapp.com',
  projectId: 'raytech-cg-homologacao',
  storageBucket: 'raytech-cg-homologacao.firebasestorage.app',
  messagingSenderId: '195471491370',
  appId: '1:195471491370:web:b7e5a0a5a218d16f7a9e53'
});
export const isOnlineOrigin=origin=>onlineOrigins.has(origin);
export const PRODUCTION_CONFIG=Object.freeze({enabled:true,syncEnabled:true,firebase:isOnlineOrigin(globalThis.location?.origin)?onlineFirebase:localFirebase});
export function requireProductionConfig(config=PRODUCTION_CONFIG,location=globalThis.location){
 if(config!==PRODUCTION_CONFIG)throw Error('INVALID_CONFIG');
 if(location?.origin===ORIGIN)return localFirebase;
 if(isOnlineOrigin(location?.origin))return onlineFirebase;
 throw Error('HOMOLOGATION_ORIGIN_REQUIRED');
}
export async function environment(){return {local:globalThis.location?.origin===ORIGIN,firebase:requireProductionConfig()};}
export function collectionName(name,origin=globalThis.location?.origin){
 if(!['Accounts','Roles','Audit','Finance'].includes(name))throw Error('INVALID_COLLECTION');
 if(origin===ORIGIN)return 'raytechV345'+name;
 if(isOnlineOrigin(origin))return 'raytechHml34741'+name;
 throw Error('HOMOLOGATION_ORIGIN_REQUIRED');
}
