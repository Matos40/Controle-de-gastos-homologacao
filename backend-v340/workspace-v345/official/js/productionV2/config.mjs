import publicConfig from '../../../firebase-public.json' with {type:'json'};

export const ORIGIN = 'http://127.0.0.1:15003';
const homologationOrigins = new Set([
  'https://raytech-cg-homologacao.web.app',
  'https://raytech-cg-homologacao.firebaseapp.com',
]);
const localFirebase = Object.freeze({projectId: 'demo-raytech-v340', apiKey: 'demo-v345'});
const hosted = globalThis.location && homologationOrigins.has(globalThis.location.origin);
export const PRODUCTION_CONFIG = Object.freeze({
  enabled: true, syncEnabled: true,
  firebase: hosted ? Object.freeze({projectId: 'raytech-cg-homologacao'}) : localFirebase,
});
export function requireProductionConfig(config = PRODUCTION_CONFIG, location = globalThis.location) {
  if (config !== PRODUCTION_CONFIG) throw Error('V345_CONFIG');
  if (location?.origin === ORIGIN && config.firebase === localFirebase) return config.firebase;
  if (homologationOrigins.has(location?.origin) && config.firebase.projectId === 'raytech-cg-homologacao') return config.firebase;
  throw Error('V345_ORIGIN');
}
export async function environment() {
  const expected = requireProductionConfig();
  if (expected === localFirebase) return {local: true, firebase: localFirebase};
  const firebase = Object.freeze(publicConfig);
  if (firebase.projectId !== expected.projectId ||
      firebase.authDomain !== 'raytech-cg-homologacao.firebaseapp.com' ||
      firebase.appId !== '1:195471491370:web:b7e5a0a5a218d16f7a9e53' || !firebase.apiKey) {
    throw Error('V345_PROJECT_MISMATCH');
  }
  return {local: false, firebase};
}
