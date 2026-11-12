# Fase 1: equivalencia de regras financeiras reais x laboratorio

Escopo: somente develop. Nenhuma alteracao nas funcoes de producao.

## Metodologia
O teste usa node:vm com extratos das funcoes reais de
js/state.js e js/services/storageService.js. O estado e inteiramente
sintetico. Funcoes de interface e persistencia sao substituidas por
stubs sem efeitos. Isso verifica as regras executadas, nao somente
uma reimplementacao independente.

## Regras observadas
- calculateMonthNetBalance: salario + entradas extras + saldo
  imediatamente anterior - despesas - parcelas do cartao.
  Investimentos registrados em expenses reduzem o saldo.
- syncFromPreviousMonth: nao sobrescreve despesas existentes
  com mesmo titulo; evita duplicacao de parcelas por origem
  ou titulo/numero e respeita deletedInstallmentOrigins do mes atual.
- ensureMonthExists: herda salario/orcamento, despesas fixas
  com novo ID, paid=false, parcelas pendentes avancadas, com
  novo ID e origem preservada; nao herda investimentos avulsos.
  Cria deletedInstallmentOrigins vazio.

## Divergencia documentada (nao corrigida)
A criacao automatica nao consulta marcadores de exclusao do
mes anterior ao herdar parcelas. A sincronizacao manual consulta
marcadores do mes atual. A semantica exata de exclusao entre
meses deve ser especificada antes de modificar comportamento.
O teste registra o comportamento atual, nao o considera seguro.

## Limites
- A extracao por delimitadores de chaves e adequada apenas
  ao codigo atual; mudancas de sintaxe exigem manutencao.
- A VM executa as funcoes reais com mocks; nao testa DOM,
  localStorage, fluxos completos de usuario, calendario real,
  colisoes de IDs aleatorios, nem concorrencia.
- A equivalencia do modelo de saldos foi exercitada em dois
  meses consecutivos; ainda faltam cenarios de meses vazios,
  ausentes, grandes valores e contratos historicos.
- O modelo de migracao nao executa heranca nem sincronizacao.
  Nao afirmar equivalencia funcional completa.

## Executar
```bat
cd /d C:\Users\dasle\raytech-cg-desenvolvimento
git pull origin develop
node tests\production-phase1-equivalence\equivalence.test.cjs
```

Meta: 33/33; pendente execucao pelo usuario.
NOT_READY_FOR_PRODUCTION. Main intocada; sem deploy ou sync real.
