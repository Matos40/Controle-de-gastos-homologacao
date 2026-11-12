# Fase 1: persistencia e recuperacao de exclusoes (laboratorio)

Escopo: exclusivamente develop, dados sinteticos, sem alteracoes no aplicativo real.

## Modelo experimental
- Estado isolado {selectedMonth,months,deletions}. O registro deletions
  pertence ao MES DE DESTINO e pode existir antes do proprio mes financeiro.
- memoryDisk simula armazenamento com bytes JSON, revisao monotona e
  troca atomica. open(disk) simula reinicializacao e valida o estado.
- mark e idempotente, com controle de versao otimista.
- recreate usa installmentDeletionPolicyLab.plan para bloquear apenas
  parcelas marcadas, preservando outras origens e evitando duplicidade.
- backup usa backupRecoveryLab.createBackup/verifyBackup com SHA-256.
- restore exige revisao e recusa, por padrao, backup que removeria
  marcadores de exclusao atualmente conhecidos. allowRollback=true
  simula aprovacao EXPLICITA de restauracao regressiva.
- Falhas before, partial e after_prepare sao simuladas ANTES do
  commit unico em memoria. Nao sao testes de fsync, crash de processo,
  banco remoto ou atomicidade fisica.

## Decisao de seguranca
SHA-256 sem assinatura nao autentica quem criou o backup.
Um backup antigo pode ser valido e mesmo assim perder exclusoes
mais recentes. O laboratorio exige aprovacao explicita nesse caso.
Nao transportar esse booleano diretamente para a UI sem
autenticacao, confirmacao, trilha de auditoria e politica de merge.

## Limitacoes
O modelo nao representa todas as colecoes financeiras do app
(salario, despesas fixas, investimentos, etc.). Ele nao substitui
um backup financeiro completo. Os testes nao exercitam a
persistencia real via localStorage, a interface, os dados de
usuarios ou Firebase. A integracao e a migracao permanecem
bloqueadas ate especificacao e revisao adicionais.

## Execucao Windows
```bat
cd /d C:\Users\dasle\raytech-cg-desenvolvimento
git pull origin develop
node tests\production-phase1-persistence\persistence.test.cjs
```

Meta: 43/43 testes; aguardando execucao local.
Gate: NOT_READY_FOR_PRODUCTION.
