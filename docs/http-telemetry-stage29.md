# Etapa 29: observabilidade HTTP no laboratorio

Exclusivo da develop e emuladores; sem publicacao ou sincronizacao real.

- Modulo httpTelemetryLab.js: eventos anonimos de resposta HTTP e contadores por acao/status.
- Campos permitidos: event, action, status, outcome, durationMs.
- Sem token, UID, email, IP, headers, corpo financeiro, stack trace ou mensagem de excecao.
- Nao registra logs automaticamente; injetar sink explicitamente para testes ou
  integracao futura. Sink com falha nao pode quebrar operacoes financeiras.
- Integracao em httpFinanceLab.js registra status de respostas emitidas e timeout 408.
- Erros financeiros preservam o contrato anterior; nao adicionamos detalhes sensiveis.
- Metricas em memoria nao sao persistentes nem distribuidas.
- Timeout de operacao financeira nao foi introduzido.
- Nao cobre logging de bibliotecas externas (Firebase Admin/Google Auth), nem
  elimina MetadataLookupWarning; investigar separadamente.

## Teste local
cd /d C:\Users\dasle\raytech-cg-desenvolvimento
git pull origin develop
node tests\http-telemetry\telemetry.test.cjs

Meta: 20/20 testes aprovados. Depois repetir baterias HTTP 23, 24, 26
com emuladores e confirmar encerramento com code 0.
