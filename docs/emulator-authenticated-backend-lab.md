# Etapa 20: Firebase Auth Emulator + backend financeiro

Branch develop somente. Firebase Auth Emulator porta 9098 e Firestore
Emulator porta 8092, projeto demo-raytech-cg-auth-backend.

Usuarios de teste sao criados via REST no Auth Emulator e recebem ID
tokens emitidos pelo emulador. O Firebase Admin SDK verifica os tokens
com verifyIdToken e extrai UID. O backend financeiro da etapa 19 usa
o UID verificado para separar revisoes e recibos. Regras do laboratorio
negam todo acesso Firestore direto de clientes.

AVISO DE SEGURANCA: o Auth Emulator aceita tokens de teste nao assinados
da mesma maneira que seu ambiente de desenvolvimento. Nunca configure
FIREBASE_AUTH_EMULATOR_HOST em producao. O script recusa iniciar sem
ambos os hosts locais exatos. Este laboratorio nao publica endpoint,
nao habilita login real do Raytech CG e nao acessa dados de producao.

LIMITES: nao testa revogacao, custom claims, MFA, expiracao em tempo
real, rate limits ou ataques HTTP. O verificador confia nas propriedades
do emulador, nao em um provedor de identidade real. Uma futura API
precisa verificar ID tokens em ambiente de producao com configuracao
segura, autorizacao, quotas e logs de auditoria. Nenhuma sincronizacao
real foi ativada.
