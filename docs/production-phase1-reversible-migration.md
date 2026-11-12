# Raytech CG - Fase 1: migracao reversivel experimental

Escopo estritamente laboratorial, branch develop. Sem acesso a
localStorage, Firebase, DOM, rede, dados reais ou backup real.

## Modelo de execucao
1. Receber snapshot legado ficticio.
2. Validar estrutura e inventariar incompatibilidades.
3. Preservar copia original integral, incluindo IDs, valores, campos
   desconhecidos de mes, categorias, status, origem de parcelas,
   marcadores de exclusao, orcamento e fechamento.
4. Normalizar APENAS campos opcionais ausentes: salary -> 0,
   extraIncomes -> [].
5. Revalidar contrato proposto e comparar saldos por mes.
6. Gerar plano com hashes SHA-256 do original e normalizado.
7. Em sessao exclusivamente em memoria, aplicar com comparacao de
   revisao e hash de origem; rollback restaura original exato com
   verificacao de revisao e hash de estado normalizado.

## Restricoes importantes
- SHA-256 nao e assinatura nem prova de origem. Quem controla o plano
  pode recalcular os hashes. Nao usar como autenticacao de backup.
- Plano inclui dados originais e normalizados; manter somente no
  laboratorio e nunca registrar dados financeiros sensiveis em logs.
- Nao converte dinheiro para inteiros em centavos; apenas valida
  representabilidade. Conversao definitiva requer contrato separado.
- Saldo e calculado segundo a formula atual: salario + entradas
  extras - despesas - parcelas do cartao + saldo do mes anterior,
  quando existir. Nao representa conciliacao bancaria.
- Migracao rejeita formatos com IDs duplicados, fracao de centavo,
  estruturas invalidas e outras divergencias nao aprovadas.
- Rollback so e possivel quando o estado nao foi alterado apos
  a aplicacao. Sem sobrescrita silenciosa.
- Nenhum codigo foi integrado ao aplicativo real. Nao existe
  restauracao remota nem rollback persistente.
- A ausencia de `installmentOriginId` e preservada, nao inventada.
  Resolver heuristicas de legado exige revisao humana.
- Os testes usam somente dados sinteticos; nao comprovam que todos
  os backups historicos serao aceitos.

## Arquivos
- js/services/reversibleFinanceMigrationLab.js
- tests/production-phase1-migration/migration.test.cjs

## Comando Windows CMD
```bat
cd /d C:\Users\dasle\raytech-cg-desenvolvimento
git pull origin develop
node tests\production-phase1-migration\migration.test.cjs
```
Meta: 35/35. Resultado ainda nao executado pelo usuario.

## Gate pendente
Aprovacao local dos testes, auditoria de casos legados anonimizados,
estrategia definitiva de valores em centavos, autenticidade de backup,
privacidade, revisao de invariantes de parcelas e exclusoes.

NOT_READY_FOR_PRODUCTION. Main intocada. Sem deploy e sem sincronizacao.
