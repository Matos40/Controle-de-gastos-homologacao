# Raytech CG | Fase 1 - Risco I02: reconciliacao de parcelas legadas

## Escopo
Somente branch develop, laboratorio em memoria, dados sinteticos.
Sem alteracao de main, app real, Firebase, deploy ou sincronizacao.

## Politica conservadora
- Origem ausente: **manual_review**, sem criar, apagar, vincular ou inferir origem.
- Titulos, valores e sequencias semelhantes sao indícios, nunca prova.
- Duplicidade da mesma origem/numero: **manual_review**, sem criar.
- Origem explicita, unica e sequencia valida: **skip_deleted** se marcador
  no mes destino; **skip_existing** se ja existe; **create** caso contrario.
- Marcadores de exclusao por mes preservados; futuro aceito separadamente.
- Plano apenas declarativo: nao altera dados nem executa criacao real.
- Relatorio preserva IDs, despesas, investimentos, parcelas e saldos.
- Regras do contrato V3 e backup real continuam fora de integracao.

## Criterios para resolver I02 em producao
1. Definir mecanismo auditavel para aprovar manualmente vinculos de origem.
2. Persistir decisoes sem reescrever dados antigos silenciosamente.
3. Cobrir exclusao, restauracao, idempotencia e conflitos em armazenamento real.
4. Validar comportamento de criacao automatica e sincronizacao manual na UI.
5. Regressao multiusuario, backup e rollback sem perdas.
6. Revisao independente antes de liberar qualquer integracao.

## Executar
```bat
cd /d C:\Users\dasle\raytech-cg-desenvolvimento
git pull origin develop
node tests\production-phase1-legacy-reconciliation\reconciliation.test.cjs
```

Meta 40/40, pendente confirmacao do usuario. Historico anterior: 941 testes.
NOT_READY_FOR_INTEGRATION e NOT_READY_FOR_PRODUCTION.
