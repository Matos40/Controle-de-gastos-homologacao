# Fase 1: politica proposta de exclusao de parcelas (laboratorio)

Somente branch develop. Nenhuma funcao real alterada.

## Regra proposta (ainda nao aprovada para producao)
1. Uma exclusao de parcela especifica usa chave
   installmentOriginId:currentInstallment no MES DE DESTINO.
2. A chave bloqueia somente aquela origem e aquele numero.
   Outras origens e numeros permanecem elegiveis.
3. Uma sincronizacao repetida nao deve recriar uma parcela
   marcada nem duplicar uma parcela ja presente.
4. A criacao automatica deve consultar um registro de exclusoes
   persistido para o mes de destino, inclusive quando o mes
   financeiro ainda nao existe. Este registro externo e uma
   proposta, nao existe no app atual.
5. Exclusoes de uma parcela especifica nao sao propagadas
   automaticamente para outras parcelas/meses.
6. Para legado sem origem estavel, o laboratorio recusa inferir
   identidade; exige tratamento humano ou migracao explicita.
7. Duplicatas ambiguas e marcadores malformados sao rejeitados.

## Comportamento real comparado
- syncFromPreviousMonth consulta deletedInstallmentOrigins
  do mes atual e bloqueia a parcela correspondente.
- ensureMonthExists cria deletedInstallmentOrigins:[] e
  herda parcelas do mes anterior sem consultar registro
  externo do destino.
- Portanto, uma exclusao destinada a um mes ainda nao
  criado nao tem onde ser representada hoje. A diferenca
  e documentada, nao corrigida.
- Marcadores do mes anterior NAO equivalem automaticamente
  a exclusoes de parcelas futuras; copiar todos para o
  proximo mes poderia apagar parcelas legitimas.

## Limites
Os testes usam node:vm para executar as duas funcoes reais
com mocks. Nao validam UI, exclusao real de parcelas,
persistencia entre dispositivos, restore nem sincronizacao remota.
O modelo proposto nao foi integrado ao aplicativo.

## Execucao
```bat
cd /d C:\Users\dasle\raytech-cg-desenvolvimento
git pull origin develop
node tests\production-phase1-deletion-policy\deletion.test.cjs
```
Meta: 36/36, aguardando confirmacao local.
Status: NOT_READY_FOR_PRODUCTION.
