// No real provider, credentials, outbound calls or secret values in this laboratory.
export const FUTURE_SECRET_NAME='RAYTECH_GEMINI_API_KEY';
export async function simulatedGemini({signal}){
 if(signal.aborted)throw Error('CANCELLED');
 return [{title:'Compra fictícia',date:'2026-11-01',installmentValue:25,isInstallment:false,currentInstallment:1,installments:1,totalAmount:25}];
}
