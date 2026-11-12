# Etapa 27: limites de frequencia, concorrencia e timeouts HTTP

Escopo exclusivo de laboratorio na branch develop. Sem deploy, sem main,
sem integracao com frontend, sem sincronizacao real.

## Implementacao
- js/services/httpGuardsLab.js: janela fixa em memoria por token apresentado,
  120 requests/minuto por token, 32 requisicoes simultaneas por processo.
- HTTP 429 {error:"rate_limited"} ou 503 {error:"server_busy"}.
- Guardas liberadas em finally, inclusive se o backend falhar.
- HTTP timeout de inatividade durante recebimento: 10 segundos (408).
- headersTimeout 10 segundos, requestTimeout 15 segundos.
- Timeout desabilitado antes da transacao financeira para evitar
  resposta de falha enquanto uma operacao ainda pode confirmar no Firestore.
- Esses limites NAO sao protecao distribuida, nem politica de producao.
- Rate limit por token apresentado nao impede ataques com tokens diferentes.
- Nao ha deadline seguro para transacao Firestore nesta etapa; exige
  desenho de consulta de status/idempotencia antes de impor deadline.

## Testes
20 testes locais deterministas, sem emuladores. Depois executar as tres
baterias HTTP (23,24,26) em emuladores como regressao.

CMD Windows:
cd /d C:\Users\dasle\raytech-cg-desenvolvimento
git pull origin develop
node tests\http-guards\guards.test.cjs

Meta: 20/20 e code 0.

Para regressao:
set NODE_PATH=C:\Users\dasle\raytech-firebase-seguranca\node_modules
set FIRESTORE_EMULATOR_HOST=127.0.0.1:8094
set FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9100
firebase emulators:exec --config tests\emulator-http-finance\firebase.json --only auth,firestore --project demo-raytech-cg-http-lab "node tests\emulator-http-finance\http.test.cjs"
firebase emulators:exec --config tests\emulator-http-finance\firebase.json --only auth,firestore --project demo-raytech-cg-http-lab "node tests\emulator-http-resilience\resilience.test.cjs"
firebase emulators:exec --config tests\emulator-http-finance\firebase.json --only auth,firestore --project demo-raytech-cg-http-lab "node tests\emulator-http-validation\validation.test.cjs"

Nota: testes unitarios nao simulam slowloris real nem carga distribuida.
