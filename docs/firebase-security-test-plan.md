# Validação de segurança Firebase — laboratório Raytech CG

**Status: proposta NÃO publicada no Firebase.** As regras em `docs/firestore-homologacao-regras-propostas.rules` precisam ser revisadas e testadas no Rules Playground/Emulator antes da publicação manual. Não substitua as regras atuais sem verificar os fluxos existentes.

## Isolamento entre contas

1. Conta A: criar `Conta A Teste` em Despesas fictícias e uma operação offline pendente.
2. Em outro navegador/perfil (não na mesma aba), entrar com conta Google B.
3. Confirmar que B não vê `Conta A Teste`, nem os rascunhos/fila local da conta A.
4. Conta B: criar `Conta B Teste`; conta A não deve enxergá-la.
5. No Rules Playground ou Emulator, autenticar como UID B e tentar ler/gravar `users/{UID_A}/syncTests/expense-lab/items/{ID_A}`: **PERMISSION_DENIED**.
6. Autenticar como UID A e ler seu próprio registro: **permitido**.

**Importante:** a UI não exibir registros alheios não comprova bloqueio de acesso. O teste negativo nas regras é obrigatório.

## Regras e regressões

- Testar escrita/leitura `connection-check` e `cross-device-demo`.
- Testar criar, editar, excluir logicamente e listar `expense-lab/items`.
- Testar criação de recibo de edição/exclusão e leitura de recibo já existente.
- Negar gravação com campos extras (como `gemini_user_api_key` ou `pin`), sem autenticação e com UID divergente.
- Negar update com versão igual/menor, delete físico e alteração de `operationId`.
- Não liberar coleções financeiras reais nesta etapa.

## Antes da migração

Auditar concorrência multiaba, filas com mesmo alvo, reenvio após confirmação perdida, recuperação de erros permanentes e contas trocadas no mesmo dispositivo. Fazer backup JSON completo e comparação de contagens e valores, sem enviar PIN ou chave Gemini.
