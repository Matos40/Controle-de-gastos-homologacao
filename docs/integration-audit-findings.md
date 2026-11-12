# Raytech CG — auditoria integrada de laboratórios (develop)

Status: **testes de auditoria preparados; execução local pendente**.
Escopo: somente dados fictícios, emulador Firestore e Storage injetado em memória.
Nenhum arquivo de interface, `appDb`, chave de produção ou regras do Firebase real foi modificado.

## Cobertura da bateria

`tests/integration-audit/integration.test.cjs` contém 15 verificações: leitura local, conversão,
IDs legados, interrupção, retomada, reconstrução integral, reenvio, divergências de salário
e parcelas excluídas, isolamento de usuários, fila offline, contratos incompatíveis,
preferência de mês, manifesto incompleto e preservação de dados locais/segredos fictícios.

## Riscos arquiteturais identificados (não corrigidos nesta fase)

1. **Contrato da fila incompatível com registros financeiros reais.**
   `operationQueueLab.js` aceita `expense`/`cardExpense`/`extraIncome`,
   com `title` e `amountCents`; o conversor usa coleções
   `expenses`/`cardExpenses`/`extraIncomes`, valores como `amount` e
   `installmentValue`. Requer adaptador explícito, sem arredondamento silencioso
   e com preservação de campos antes de integrar o app.
2. **Manifesto não indica conclusão.** O laboratório grava manifesto antes de
   meses e registros. Migração parcial pode ter manifesto presente.
   Apenas auditoria de contagem e reconstrução completa permite concluir.
   Antes de uso real, adicionar estado final de migração com protocolo transacional
   ou equivalente e validação independente.
3. **`selectedMonth` remoto é preferência local.** O manifesto contém
   `selectedMonth` para reconstruir o backup, mas não deve impor navegação
   no outro dispositivo após sincronização. Separar preferência de dispositivo
   do estado financeiro compartilhado.

## Limitações relevantes

- `monthMigrationLab` representa **snapshot imutável de migração**, não edição
  versionada de mês em produção. Divergências bloqueiam, não são mescladas.
- Auditoria de reconstrução compara dados remotos com um plano local confiável.
  Não constitui verificação criptográfica independente do conteúdo remoto.
- Os testes não provam durabilidade em dispositivos físicos, offline real de
  navegadores, proteção contra dados maliciosos, limites de documentos,
  recuperação de migração com vários planos concorrentes ou compatibilidade iOS.
- Nenhuma aprovação autoriza conectar Firebase real ou alterar `main`.

## Comando

```bat
cd /d C:\Users\dasle\raytech-cg-desenvolvimento
git pull origin develop
set NODE_PATH=C:\Users\dasle\raytech-firebase-testes\node_modules
firebase emulators:exec --config tests\emulator-month-migration\firebase.json --only firestore --project demo-raytech-cg-audit "node tests\integration-audit\integration.test.cjs"
```
