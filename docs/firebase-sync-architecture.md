# Raytech CG — arquitetura de sincronização (Fase 1)

Status: **proposta técnica, sem integração ativa**. Branch: `develop`. Não modificar a produção até homologação.

## Objetivo e limites
- Login individual via Firebase Authentication; dados financeiros separados por `uid`.
- Firestore como fonte remota; cache local/offline preservado durante migração.
- Preservar o banco legado `controle_gastos_multimonth_v3` até validação e confirmação explícita do usuário.
- Nunca sincronizar `gemini_user_api_key`, `controle_gastos_pin_lock` ou outras credenciais/configurações privadas.
- GitHub Pages continua hospedando o front-end; **nenhum segredo de administrador Firebase** no navegador.

## Diagnóstico da base atual
- `js/state.js`: `appDb = { selectedMonth, months }`; saldo depende recursivamente de meses anteriores.
- `js/services/storageService.js`: `loadDatabase()` e `saveDatabase()` leem/gravam o JSON inteiro em localStorage.
- `js/app.js`: alterações mutam `appDb` e chamam `saveDatabase()`; criação/fechamento de meses herda fixos e parcelas.
- `js/services/excelService.js`: restauração de JSON/Excel pode substituir todo o banco, mediante confirmação.
- `sw.js`: cache de arquivos do PWA, não é mecanismo de sincronização de lançamentos.

## Contrato de repositório (proposto; não implementado)
```ts
interface FinanceRepository {
  loadLocalSnapshot(): Promise<LegacyDatabase | null>;
  exportLocalBackup(): Promise<LegacyDatabase>;
  getMonth(ym: string): Promise<MonthData | null>;
  listMonths(): Promise<string[]>;
  upsertExpense(ym: string, expense: Expense, expectedVersion?: number): Promise<void>;
  deleteExpense(ym: string, id: string, expectedVersion?: number): Promise<void>;
  upsertCardExpense(ym: string, card: CardExpense, expectedVersion?: number): Promise<void>;
  deleteCardExpense(ym: string, id: string, expectedVersion?: number): Promise<void>;
  upsertExtraIncome(ym: string, income: ExtraIncome, expectedVersion?: number): Promise<void>;
  updateMonthFields(ym: string, patch: MonthFields, expectedVersion?: number): Promise<void>;
  subscribeToMonth(ym: string, onChange: (data: MonthData) => void): () => void;
  getSyncStatus(): 'local-only' | 'offline' | 'pending' | 'synced' | 'conflict' | 'error';
}
```
A API acima é conceitual: validar nomes, operações e estratégia de versões antes de codificar. `selectedMonth` é preferência local por dispositivo, não estado financeiro compartilhado.

## Modelo Firestore proposto
```text
users/{uid}                         perfil mínimo, versão do esquema
users/{uid}/months/{yyyy-MM}        salário, orçamento, fechado, closedAt, versão
users/{uid}/months/{yyyy-MM}/expenses/{id}
users/{uid}/months/{yyyy-MM}/cardExpenses/{id}
users/{uid}/months/{yyyy-MM}/extraIncomes/{id}
users/{uid}/months/{yyyy-MM}/deletedInstallments/{originAndNumber}
users/{uid}/migration/{migrationId} auditoria da migração, sem segredos
```
Regras: autenticação obrigatória, `request.auth.uid == uid`, validação de campos/tipos/tamanhos e regras testadas no emulador. Separar projetos Firebase de homologação e produção.

## Regras de consistência
1. **Nunca** sincronizar `appDb` inteiro em cada `saveDatabase()`: dois aparelhos sobrescreveriam alterações.
2. Cada lançamento recebe ID global estável; preservar IDs legados ao importar e criar IDs novos via `crypto.randomUUID()` quando disponível.
3. Exclusões sincronizadas precisam de marcador persistente (tombstone) ou registro de operação, evitando ressurreição após reconexão.
4. Propagação de parcelas e fixos deve ser **idempotente**; chave determinística por origem + mês + número da parcela. Proteger fechamento/abertura de mês contra concorrência.
5. Edições concorrentes do mesmo registro: detectar versão conflitante e pedir resolução; **não** aceitar sobrescrita silenciosa.
6. Escritas offline: manter fila/estado visível; só mostrar “sincronizado” após confirmação remota.
7. Saldo mensal é **derivado**, nunca duplicar como fonte de verdade; recalcular quando meses anteriores mudarem.
8. Backup JSON/Excel continua disponível e deve operar sobre um snapshot coerente, sem substituir dados remotos automaticamente.

## Migração inicial (futura)
1. Exportar backup JSON do dispositivo de origem e validar o esquema.
2. Autenticar usuário e verificar se já existem dados remotos.
3. Se remoto vazio: apresentar resumo (meses, receitas, despesas, cartão) e pedir confirmação.
4. Importar com identificador de migração estável, operações idempotentes e relatório de contagens/checksums.
5. Verificar dados remotos, conferir saldos e só então marcar a migração como concluída.
6. Se remoto não vazio: **não sobrescrever nem mesclar automaticamente**; exigir fluxo de conciliação.
7. Manter backup legado até o usuário confirmar funcionamento em dois dispositivos.

## Matriz mínima de testes
- Login de dois usuários: um não acessa dados do outro (emulador de regras).
- Importação inicial repetida: sem duplicação.
- Celular cria despesa offline, PC edita outra: ambas persistem após reconexão.
- Ambos editam **a mesma** despesa: conflito detectado, sem perda silenciosa.
- Exclusão de parcela no PC e reconexão do celular: parcela não reaparece.
- Fechamento do mesmo mês em dois aparelhos: sem duplicar fixos/parcelas.
- Alteração de mês anterior: saldo acumulado recalculado.
- Restauração JSON/Excel: não substitui nuvem sem confirmação e validação.
- PIN e chave Gemini: nunca aparecem em documentos ou logs remotos.
- Falha de rede, permissão negada, quota excedida: erro visível, dados locais preservados.

## Próximas decisões antes de codificar
1. Criar **projeto Firebase de testes** e configurar Authentication/Firestore.
2. Definir estratégia de persistência offline do SDK Firestore, especialmente Safari/PWA iOS, e tratamento de múltiplas abas.
3. Especificar operações e regras de migração com dados sintéticos, sem usar dados financeiros reais.
4. Implementar primeiro um adaptador local com testes de regressão; depois adaptador Firestore.
