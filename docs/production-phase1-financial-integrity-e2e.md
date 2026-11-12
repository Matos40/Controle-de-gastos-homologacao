# Raytech CG - Fase 1: auditoria financeira ponta a ponta

Escopo: branch develop, testes sinteticos em memoria, sem Firebase,
localStorage, rede, dados reais, publicacao ou sincronizacao.

## Cenario
Quatro meses (setembro a dezembro de 2026), com salario, renda extra,
despesa fixa cujo valor muda a cada mes, aporte classificado como
investimentos, cartao com tres parcelas e mesma origem, encerramento
da sequencia em dezembro, marcador de exclusao de outra origem,
status pago/pendente, orcamento e fechamento mensal.

## Procedimento
1. Construir historico ficticio e fingerprint por mes.
2. Registrar saldos segundo a formula do aplicativo.
3. Gerar plano de migracao e validar hashes/contrato.
4. Aplicar em sessao em memoria com controle de revisao.
5. Comparar IDs, valores, categorias, parcelas, exclusoes,
   metadados, status e saldos.
6. Executar rollback e exigir igualdade estrutural do original.
7. Simular plano adulterado, revisao errada, origem divergente,
   tentativa de rollback indevido, ID duplicado, centavos invalidos,
   parcela fora da sequencia e exclusoes malformadas.

## Arquivos
- js/services/financeIntegrityE2ELab.js
- tests/production-phase1-integrity/integrity.test.cjs

## CMD
```bat
cd /d C:\Users\dasle\raytech-cg-desenvolvimento
git pull origin develop
node tests\production-phase1-integrity\integrity.test.cjs
```

Meta: 40/40. Testes ainda nao confirmados em ambiente local.

## Limites e riscos
- O mecanismo testa integridade de dados existentes, nao simula
  automaticamente as regras reais de heranca/edicao do app.
- A falha injetada e logica, antes do commit em memoria;
  nao representa interrupcao de energia, disco ou Firestore.
- Hash SHA-256 nao fornece autenticidade de origem.
- Comparacao de saldo segue a regra atual, nao extrato bancario.
- Nao testa backups historicos reais nem concorrencia distribuida.
- A migracao ainda nao esta integrada a aplicacao.
- Nao incluir dados pessoais reais nos logs de teste.

Status: NOT_READY_FOR_PRODUCTION. Main intocada.
