# Raytech CG - Fase 1: inventario de compatibilidade legado

Escopo: leitura de codigo e testes sinteticos na develop. Nenhum backup
real, dado pessoal ou sincronizacao foi acessado. NAO e migracao.

## Fontes inspecionadas
- js/state.js: appDb, categorias, calculo de saldo e chave de localStorage.
- js/services/storageService.js: heranca, parcelas, marcadores de exclusao,
  validacao/restauracao JSON e persistencia local.
- js/services/excelService.js: exportacao XLSX, aba Backup restauracao,
  importacao e exportacao JSON.
- js/services/deviceBoundaryLab.js e versionedBoundaryBridgeLab.js:
  payload compartilhado, preferencias locais e ponte de versoes.
- js/services/backupRecoveryLab.js: backup experimental em memoria.
- js/services/productionDataContractLab.js: contrato proposto.

## Inventario observado
| Objeto | Campos encontrados | Observacao |
|---|---|---|
| Raiz | selectedMonth, months | selectedMonth e preferencia local na ponte v2 |
| Mes | salary, budgetLimit, expenses, cardExpenses, extraIncomes, closed, closedAt, deletedInstallmentOrigins | Alguns campos opcionais em backups antigos |
| Despesa | id, title, category, amount, type, date, paid | type fixed gera heranca mensal com novo id |
| Cartao | id, title, category, installmentValue, totalAmount, isInstallment, installments, currentInstallment, installmentOriginId, date, paid | Origem pode faltar em dados antigos |
| Investimento | categoria investimentos em despesas | Deve permanecer gasto destinado a investimento, nao renda extra |
| Exclusao | deletedInstallmentOrigins, strings origem:parcela | Preserva intencao de exclusao ao herdar |
| JSON | JSON.stringify(appDb) | Restauracao substitui estado apos confirmacao |
| XLSX | Resumo mensal, Despesas gerais, Cartao de credito, Entradas extras, Backup restauracao | Aba de backup contem JSON em blocos |
| Backup lab | format/version/algorithm/checksum/payload | Formato experimental separado do JSON/XLSX real |

## Incompatibilidades concretas
1. `productionDataContractLab` exige salary e extraIncomes, enquanto
   `validateBackupDatabase` aceita ausencia desses campos.
2. Contrato proposto exige centavos exatos; validador legado aceita
   numeros finitos nao negativos, inclusive com mais casas decimais.
3. Contrato proposto exige ID em cada item; validador de backup legado
   nao exige ID em todas as entradas.
4. `installmentOriginId` e opcional em dados antigos; sem ele,
   deduplicacao depende de heuristicas por titulo/parcela/valor.
5. `deletedInstallmentOrigins` deve ser preservado para evitar
   ressurgimento de parcelas; nao basta importar apenas arrays de gastos.
6. `selectedMonth` integra backup local, mas fica fora do payload
   compartilhado v2. Nao pode ser tratado como dado remoto obrigatorio.
7. O Excel possui um caminho de restauracao integral e outro de
   importacao tabular. O segundo nao e equivalente ao primeiro:
   inferencias de categoria, parcelas e IDs podem perder semantica.
8. SHA-256 isolado do backup experimental nao autentica origem.
9. A categoria investimentos nao constitui uma entidade de investimento
   separada no esquema observado; regras futuras devem evitar dupla
   contagem.

## Nova ferramenta de inventario
`js/services/legacyCompatibilityAuditLab.js` recebe um objeto
financeiro JA carregado, devolve contagens e alertas e nao altera o
objeto. Nao le localStorage, arquivos, Firebase ou rede. Os testes
usam somente dados ficticios. Alertas nao sao migracoes automaticas.

## Comando CMD
```bat
cd /d C:\Users\dasle\raytech-cg-desenvolvimento
git pull origin develop
node tests\production-phase1-legacy\legacy.test.cjs
```
Meta: 25/25 testes aprovados. Execucao ainda pendente.

## Antes de qualquer migracao
- Inventariar com amostras ANONIMIZADAS as variantes reais do legado.
- Definir estrategia reversivel de normalizacao e inteiros em centavos.
- Preservar marcadores de exclusao e origem de parcelas.
- Diferenciar importacao XLSX tabular de restauracao integral.
- Exigir comparacao de saldos, IDs, totais, parcelas e rollback.
- Rever privacidade, permissao, retencao e LGPD.

Status: Fase 1 em andamento. NOT_READY_FOR_PRODUCTION.
Nao modificar main, nao publicar servicos, nao ativar sincronizacao real.
