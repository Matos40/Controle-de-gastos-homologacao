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

## Execução do teste negativo no Firebase Console

1. Abra Firebase Console > projeto `raytech-cg-homologacao` > Firestore Database > Rules.
2. Antes de alterar regras, use o simulador de regras (quando disponível) ou o Firebase Emulator Suite.
3. Selecione operação `get` e caminho de documento **existente** `/users/UID_A/syncTests/expense-lab/items/ID_A`. O caminho deve ter IDs reais de teste, não os textos `UID_A`/`ID_A`.
4. Execute como usuário autenticado com `auth.uid = UID_A`: resultado esperado **ALLOW**.
5. Repita com `auth.uid = UID_B` (UID diferente): resultado esperado **DENY**.
6. Repita sem autenticação: resultado esperado **DENY**.
7. Execute um `create` como UID B em `/users/UID_A/syncTests/expense-lab/items/ID_NOVO`: resultado esperado **DENY**.
8. Teste um `create` do proprietário com campo extra `gemini_user_api_key` usando as **regras propostas no emulador**: resultado esperado **DENY**.

**Cuidado:** o resultado ALLOW de uma leitura não prova que o documento existe. Para o teste positivo, use um registro fictício existente. O simulador pode ter interface diferente conforme a versão do Console. Não cole tokens de autenticação nem dados financeiros no chat.

**Pendência de segurança:** as regras propostas limitam formato e propriedade dos documentos, mas ainda precisam de testes de transações de recibos e concorrência. Não devem ser publicadas como definitivas sem essa validação.
