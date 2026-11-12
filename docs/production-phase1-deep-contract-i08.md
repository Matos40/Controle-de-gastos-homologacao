# Fase 1 I08 | Auditoria profunda de contrato financeiro

Somente laboratorio Node, dados sinteticos. Nenhum codigo real de persistencia,
calculo, interface ou sincronizacao foi alterado.

## Escopo
- Valores monetarios finitos, nao negativos, ate duas casas, limite de contrato.
- Salario, orcamento, despesas fixas, variaveis e investimentos.
- Receitas extras, titulos, categorias, estados de pagamento.
- Sequencia de parcelas, origem explicita, duplicidade por origem e numero no mes.
- Datas calendarias reais e pertencentes ao mes.
- Fechamento mensal coerente e tombstones por mes, inclusive futuro.
- Saldos calculados entre meses e limite de magnitude configuravel.
- Nenhuma mutacao no snapshot analisado.

## Politicas propostas e lacunas
- Investimento categorizado como despesa fixa e sinalizado como ambiguo.
- Parcela legada sem origem explicita e rejeitada, exigindo reconciliacao I02.
- Correspondencia de parcela excluida usa marcador origin:numero.
- Campos de data e descricao opcionais em alguns registros para compatibilidade
  com o contrato anterior; obrigatoriedade completa exige decisao de produto.
- Saldo e calculado pelo modelo de laboratorio, nao comparado com UI real.
- Nao valida teto de credito, semantica de juros, inflacao, tributos, calendario
  bancario, totais de parcelamento ou autorizacao do usuario.
- Nao integra I08 ao app real. Gate permanece fechado.

## Executar
```bat
cd /d C:\Users\dasle\raytech-cg-desenvolvimento
git pull origin develop
node tests\production-phase1-deep-contract-i08\deep-contract.test.cjs
```
Meta: 48/48, ainda nao confirmados pelo usuario.
Historico anterior: 1211; potencial: 1259.
NOT_READY_FOR_INTEGRATION / NOT_READY_FOR_PRODUCTION.
