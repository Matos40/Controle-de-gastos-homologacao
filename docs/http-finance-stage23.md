# Etapa 23: HTTP autenticado em laboratorio

A etapa 22 foi validada pelo usuario em duas execucoes: 19/19, 16/16,
22/22, 20/20 e 22/22, total 99/99. No ambiente isolado, npm audit
informou 0 vulnerabilidades com override de @grpc/grpc-js 1.14.7.
Esses resultados sao observados, nao uma homologacao de producao.

O MetadataLookupWarning foi rastreado ate gcp-metadata, chamado por
google-auth-library e google-gax; a causa do timeout ainda nao foi
determinada. O aviso nao bloqueou os testes.

O HTTP desta etapa:
- nao e integrado ao frontend, nao e publicado e nao usa Firebase real;
- exige emuladores Auth 127.0.0.1:9100 e Firestore 127.0.0.1:8094;
- recebe POST /v1/initialize, /v1/submit e /v1/audit;
- exige Authorization: Bearer <ID token do Auth Emulator>;
- ignora qualquer UID do corpo; identidade deriva do token;
- limita o corpo a 128 KiB, desabilita cache e evita detalhes internos
  nas respostas de erro;
- usa regras Firestore que negam acesso direto dos clientes;
- usa porta HTTP efemera ligada somente a 127.0.0.1.

Executar no Windows (CMD):
cd /d C:\Users\dasle\raytech-cg-desenvolvimento
git pull origin develop
set NODE_PATH=C:\Users\dasle\raytech-firebase-seguranca\node_modules
set FIRESTORE_EMULATOR_HOST=127.0.0.1:8094
set FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9100
firebase emulators:exec --config tests\emulator-http-finance\firebase.json --only auth,firestore --project demo-raytech-cg-http-lab "node tests\emulator-http-finance\http.test.cjs"

Meta: 20/20 testes, code 0. Nenhum teste foi executado pelo assistente.
Nao adicionar CORS amplo, nao expor na rede, nao usar tokens de producao.
O servidor HTTP nao esta pronto para implantacao real.
