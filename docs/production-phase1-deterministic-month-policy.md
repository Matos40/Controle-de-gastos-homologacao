# Raytech CG | Fase 1 | I06 politica mensal deterministica

## Divergencias observadas no codigo real (somente leitura)
- ensureMonthExists cria um mes e inicializa deletedInstallmentOrigins=[]; nao consulta tombstones futuros.
- syncFromPreviousMonth consulta marcadores no mes destino, mas exige que o mes ja exista.
- ensureMonthExists usa ultimo mes disponivel como fallback, mesmo sem continuidade cronologica; sync usa apenas mes imediatamente anterior.
- Ambos geram IDs aleatorios e datas baseadas no dia corrente.
- Origem legada e inferida de id em ambos; isso pode mascarar ambiguidade.
- sync preserva despesa fixa editada pelo titulo; criacao copia fixos quando mes ausente.
- Nenhuma funcao real foi alterada.

## Politica proposta
1. Os dois modos chamam o mesmo planejador puro e produzem resultado igual.
2. Somente mes anterior cronologico, sem fallback silencioso.
3. IDs e datas deterministicas em laboratorio; nenhuma escrita.
4. Marcadores por mes de destino, inclusive meses futuros, bloqueiam parcela.
5. Parcela sem installmentOriginId comprovado exige revisao manual.
6. Origem duplicada, destino legado ambiguo e titulos fixos homonimos
   impedem aplicar TODO o plano (fail-closed).
7. Mes existente preserva edicoes, investimentos, receitas, IDs e parcelas.
8. Mes fechado nao e modificado.
9. O plano nao e aplicado automaticamente; retorna proposed e original.

## Limites
A politica nao substitui funcoes reais e nao faz sincronizacao.
A correspondencia de despesas fixas por titulo e apenas provisoria,
nao equivale a uma identidade persistente de despesa. Nao foi testada
concorrencia, restauracao em dispositivos reais ou integracao UI.
A equivalencia dos modos e garantida apenas pelo planejador experimental.
I06 segue aberto para integracao.

## Testar
```bat
cd /d C:\Users\dasle\raytech-cg-desenvolvimento
git pull origin develop
node tests\production-phase1-month-policy\month-policy.test.cjs
```
Meta 48/48; nao executados localmente. Historico confirmado 1116.
Gate NOT_READY_FOR_INTEGRATION / NOT_READY_FOR_PRODUCTION.
