# Fase 1 - I01: contrato financeiro v3 experimental

## Escopo
Somente develop. Nenhuma alteracao nas funcoes reais, main, dados financeiros,
Firebase, publicacao ou sincronizacao.

## Estrutura
Envelope v3 de laboratorio: format, version=3, schema=1, sourceHash,
source, ledger, checksum. Ledger: selectedMonth, months, deletions.
deletions associa mes de DESTINO a marcadores origem:numero, inclusive
para meses ainda nao criados. Campos originais permanecem intactos em
source e months, incluindo IDs, despesas fixas, investimentos, parcelas,
saldos e deletedInstallmentOrigins legados.

## Conversao reversivel
fromLegacy extrai marcadores embutidos sem os apagar.
createV3 pode acrescentar marcadores futuros em meses ausentes.
verifyV3 confere hashes, consistencia e reconstrucao a partir da fonte.
rollback devolve a fonte original; exportLegacy bloqueia downgrade
quando perderia marcadores futuros nao vazios.
importLegacyBackup aceita envelope raytech-finance-lab v1 valido.
NAO e suporte generico a todo backup JSON/XLSX do app, nem ao
manifesto versionedBoundaryBridgeLab v2.

## Limitacoes e riscos remanescentes
- O contrato v3 nao foi integrado ao app real nem ao sync.
- O contrato de producao v1 continua recusando campo deletions.
- O backup v1 e SHA-256 nao autenticado; quem controla os dados
  pode recalcular hashes. Sem assinatura, MAC ou criptografia.
- Fonte original fica duplicada no envelope, com limite de 2 MiB
  por objeto canonico; avaliar custo e dados pessoais.
- Apenas importacao de snapshots legados que ja atendem
  productionDataContractLab. Legado incompleto requer migracao
  anterior validada.
- Marcadores embutidos e externos para meses existentes devem
  ser iguais. Conflitos bloqueiam a conversao, sem merge implicito.
- A origem da parcela nao e inferida; risco I02 continua aberto.
- Nao representa persistencia duravel nem rollback remoto.
- I01 ganha prototipo verificavel, mas NAO esta resolvido para
  integracao ate compatibilizacao do contrato, backup real e E2E.

## Executar
```bat
cd /d C:\Users\dasle\raytech-cg-desenvolvimento
git pull origin develop
node tests\production-phase1-v3-contract\v3.test.cjs
```

Meta 48/48; pendente confirmacao local.
NOT_READY_FOR_INTEGRATION / NOT_READY_FOR_PRODUCTION.
