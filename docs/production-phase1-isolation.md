# Fase 1 - Isolamento dinamico A/B (somente laboratorio)

## Escopo
- Branch develop; Auth Emulator em 127.0.0.1:9098 e Firestore Emulator
  em 127.0.0.1:8092, projeto demo-raytech-cg-auth-backend.
- Reutiliza configuracao do laboratorio autenticado e regras deny-all.
- Testes executam em projeto demo, sem deploy, sem dados financeiros reais,
  sem sincronizacao e sem alteracao do aplicativo em producao.

## O que e testado
31 testes dinamicos: dois usuarios criados no Auth Emulator, validacao
de tokens no Firebase Admin, estados e revisoes independentes, bloqueio
de leitura/escrita/exclusao/consultas por clientes A, B e anonimo,
operacoes via backend autenticado, idempotencia independente,
tentativa de token adulterado e integridade de head/recibos.

**Limitacao de seguranca importante:** as regras Firestore usadas sao
`deny all`. Isso demonstra que os clientes nao acessam diretamente
o banco, inclusive seus proprios dados. Nao demonstra que regras
de acesso direto por proprietario funcionariam. O backend Admin SDK
contorna as regras do cliente e isola dados por UID do token verificado.
`assertOwner` e apenas um contrato isolado; nao esta ligado a HTTP
real. Nao e auditoria de producao.

## Executar no CMD (Windows)
```bat
cd /d C:\Users\dasle\raytech-cg-desenvolvimento
git pull origin develop
set NODE_PATH=C:\Users\dasle\raytech-firebase-seguranca\node_modules
set FIRESTORE_EMULATOR_HOST=127.0.0.1:8092
set FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9098
set GOOGLE_CLOUD_PROJECT=demo-raytech-cg-auth-backend
set GCLOUD_PROJECT=demo-raytech-cg-auth-backend
firebase emulators:exec --config tests\emulator-authenticated-backend\firebase.json --only auth,firestore --project demo-raytech-cg-auth-backend "node tests\production-phase1-isolation\isolation.test.cjs"
```
Resultado esperado: 31/31 testes aprovados e Firebase CLI
`Script exited successfully (code 0)`.

## Proximas pendencias da Fase 1
- Inventariar formatos reais de dados legados, sem incluir segredos.
- Definir modelo financeiro completo, incluindo parcelas, investimentos
  e exclusoes, com migracao e retrocompatibilidade.
- Definir matriz de permissoes e politica de privacidade/LGPD.
- Validar regras definitivas no Firestore Emulator antes de considerar
  qualquer configuracao real.

Decisao mantida: NOT_READY_FOR_PRODUCTION.
