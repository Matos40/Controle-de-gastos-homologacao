export const PROJECT='demo-raytech-v340';
export function assertLocalEmulators(env=process.env){
 if(env.GCLOUD_PROJECT!==PROJECT||env.FIREBASE_AUTH_EMULATOR_HOST!=='127.0.0.1:19099'||env.FIRESTORE_EMULATOR_HOST!=='127.0.0.1:18080')throw Error('EMULATOR_ONLY');
}
