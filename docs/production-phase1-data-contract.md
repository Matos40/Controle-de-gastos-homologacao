# Raytech CG: Fase 1 de preparacao para producao (laboratorio)

**Estado:** proposta de contrato, nao migracao aprovada, nao producao.
Branch develop. Nao alterar main; nao habilitar Firestore real, Auth real
ou sincronizacao.

## Evidencias no codigo existente
- `js/state.js`: `appDb = {selectedMonth,months}`, `salary`,
  `expenses`, `cardExpenses`, `extraIncomes`.
- Saldo calculado como salario + extras + saldo anterior - despesas -
  parcelas do cartao. Campos observados: `amount` e
  `installmentValue`.
- `js/services/httpInputValidationLab.js` ja valida forma basica.
- `js/services/trustedFinanceBackendLab.js` usa
  `users/{uid}/trustedFinanceLab/control` e transacoes com revisoes,
  recibos e idempotencia. A identidade vem do token validado no
  backend de emulador, nao do corpo HTTP.
- `js/state.js` declara chaves locais de API Gemini e PIN, que
  nao devem integrar payload financeiro sincronizado.

## Contrato PROPOSTO (nao integrado)
`js/services/productionDataContractLab.js` valida:
1. `selectedMonth` no formato AAAA-MM e existente em `months`.
2. Cada mes com `salary`, `expenses`, `cardExpenses`,
   `extraIncomes`.
3. Valores monetarios finitos, representaveis em centavos; limite
   de magnitude do laboratorio.
4. IDs validos e unicos por colecao e mes; limites de quantidade.
5. UID de path seguro, e verificacao de proprietario autenticado.
6. Payload com somente `selectedMonth` e `months`: sem API key/PIN.

**Atencao:** esse contrato e propositalmente mais restritivo que
alguns formatos legados; nao deve ser aplicado a dados reais sem
inventario de amostras, migracao e compatibilidade testadas.
Nao verifica todos os campos de cada despesa nem a semantica completa
de parcelamentos, exclusoes, investimentos e recorrencias.
A verificacao de proprietario e uma funcao isolada: o endpoint real
ainda NAO usa esse modulo. Os testes NAO demonstram isolamento real
entre usuarios no Firestore de producao.

## Regras de privacidade propostas
- Nunca sincronizar chave Gemini, PIN, imagens temporarias ou tokens.
- UID deve vir de Firebase Auth verificado no servidor, nunca do
  payload escolhido pelo cliente.
- Segregar por usuario e negar acesso cruzado; regras de seguranca
  revisadas e testes de invasao em emulador antes de deploy.
- Minimizar logs: sem valores financeiros, nomes, tokens ou segredos.
- Definir retencao, exportacao, exclusao, restauracao e consentimento
  ou outra base legal aplicavel, com revisao LGPD.
- Cifrar trafego e dados em repouso conforme desenho futuro.

## Integridade e pendencias
- Evitar floats no armazenamento remoto definitivo: definir
  inteiros em centavos e migracao de compatibilidade.
- Definir invariantes para parcelas, saldo carregado, duplicatas,
  exclusoes, revisoes e conflitos entre dispositivos.
- Revisar estrategia de restauracao, idempotencia e rollback.
- Validar dados legados com casos reais anonimizados antes de
  ativar qualquer bloqueio por contrato.

## Testes locais
```bat
cd /d C:\Users\dasle\raytech-cg-desenvolvimento
git pull origin develop
node tests\production-phase1\contract.test.cjs
```
Meta: 26/26 testes aprovados. Nao exige Firebase ou rede.
Resultado pendente de execucao pelo usuario.

## Gate da Fase 1
Aprovacao dos testes do contrato nao encerra a Fase 1 completa.
Ainda falta inventario de esquema legado, ameacas, LGPD, regras
Firestore e validacao dinamica de isolamento com contas distintas.
Decisao permanece NOT_READY_FOR_PRODUCTION.
