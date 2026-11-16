// Isolated Smart Sync candidate. Never connect to production.
export const PRODUCTION_CONFIG=Object.freeze({enabled:true,syncEnabled:true,firebase:Object.freeze({
  apiKey: 'AIzaSyAlOok-2bV9QigR6PyjRgHMLjFLIoPDWpw',
  authDomain: 'raytech-cg-homologacao.firebaseapp.com',
  projectId: 'raytech-cg-homologacao',
  storageBucket: 'raytech-cg-homologacao.firebasestorage.app',
  messagingSenderId: '195471491370',
  appId: '1:195471491370:web:b7e5a0a5a218d16f7a9e53'
})});
export function requireProductionConfig(config,location){const f=config?.firebase;if(config?.enabled!==true||config.syncEnabled!==true||location?.origin!=='https://matos40.github.io'||!['/Controle-de-gastos-homologacao/smart-v326/','/Controle-de-gastos-homologacao/smart-v326/index.html'].includes(location.pathname)||f?.projectId!=='raytech-cg-homologacao'||f.authDomain!=='raytech-cg-homologacao.firebaseapp.com')throw Error('HML_SMART326_ISOLATION');return Object.freeze({...f});}
