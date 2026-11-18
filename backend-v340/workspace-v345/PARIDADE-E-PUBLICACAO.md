# Paridade e publicação do Raytech CG

Referência de produção para a V34.7.4.4: V34.6.8, commit `b880872fc48e5832eb7f9d299d342ef5bf5c376d`. O SHA-256 do HTML servido é `19d4d8b53defc9666f48645d9b0a0f63dd4bf0cdd759cd9a3863974d10fef591`. A referência de homologação é a V34.7.4.3, commit `fe16c8427ba9640cad58b6ad011278ebda32b012`.

| Funcionalidade aprovada | Controle de regressão |
| --- | --- |
| Marca, logo, selo APP verde e versão única no cabeçalho e no instalador | `production-parity.test.mjs`, `visual-refinement.test.mjs` |
| Login Google, perfis verificados, isolamento de UID e revogação | `online/google-profile*.test.mjs`, `integration.test.mjs` |
| Smart Admin, sete colunas alinhadas, indicadores, filtros, pesquisa, proteção, auditoria e modal compacto | `smart-admin-modal.test.mjs`, `integration.test.mjs`, `online/online-rules.test.mjs` |
| Entradas do leitor e da chave de IA, restrições por plano, serviço online desativado e laboratório sintético | `production-parity.test.mjs`, `integration.test.mjs`, suítes de cotas e autorização do backend |
| Consentimento de vínculo, Free local, Premium isolado, recuperação, sincronização bidirecional e offline | `production-parity.test.mjs`, `scope.test.mjs`, `integration.test.mjs` |
| Menus, backup JSON, importação, exportação Excel, PWA, atualização e desktop/mobile | `production-parity.test.mjs`, `visual-refinement.test.mjs`, `integration.test.mjs`, `stage-hosting.mjs` |

## Diferenças de ambiente

O código comum fica no dashboard `official/`. A etiqueta de homologação, a conta de teste, o adaptador Firebase, a origem permitida, o escopo de armazenamento e a disponibilidade de IA são específicos do ambiente. Chaves Gemini, envio de documentos reais, Functions em nuvem e permissões de produção ficam fora do candidato de homologação. A entrada de chave em homologação apresenta o estado indisponível, sem coletar credenciais.

## Gate de publicação

1. Trabalhar a partir da revisão homologada. Transferir correções de paridade para os componentes comuns, com o menor delta compatível.
2. Executar o workflow de homologação completo. O estágio de empacotamento só roda após as suítes passarem e valida o destino, a versão e o inventário SHA-256 do Service Worker.
3. Publicar em homologação o artefato verificado, sem reconstruí-lo. Conferir todos os hashes servidos e registrar a versão de Hosting e o commit.
4. Para produção, exigir aprovação expressa do proprietário. Preparar e testar antes da aprovação um artefato que use a mesma revisão dos componentes comuns e somente a configuração de produção. Registrar a lista de arquivos específicos do ambiente e os hashes do candidato. Promover exatamente o artefato de produção validado, com as configurações de produção e sem alterações de origem, regras ou armazenamento.

Uma funcionalidade listada que falhe na validação bloqueia o empacotamento e a publicação. O gate valida o candidato do workflow. O acesso administrativo ao Hosting continua sujeito às permissões Firebase.
