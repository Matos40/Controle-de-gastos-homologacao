# Paridade e publicação do Raytech CG

## Encerramento Stable Edition

A V34.7.4.5 encerrou as Etapas 01 a 07 com **7/7 testes práticos aprovados pelo proprietário**, **178 testes automatizados de referência** e **329/329 arquivos oficiais verificados**. O artefato `14487086882` foi servido pelo workflow `44433045711`, com o ruleset oficial `56bab118-3b69-46b6-8b84-d04ec6be8a13`. O [documento mestre](DOCUMENTO-MESTRE.md) mantém as referências definitivas, e o [inventário de funcionalidades protegidas](INVENTARIO-FUNCIONALIDADES-PROTEGIDAS.md) reúne os controles a preservar.

A Etapa 08 Smart AI Server começa somente em planejamento. Manter a Chave API e o leitor de faturas funcional até a aprovação definitiva da IA centralizada. Manter Spark até autorização expressa em contrário. ChatGPT responde pelo planejamento, pela arquitetura e pela interface visual. Codex responde pela implementação, pelos testes e pelas publicações autorizadas.

## Diretriz permanente de paridade

A referência estável atual é **V34.7.4.5 Stable Edition**, branch `restore/v34-7-4-5-estavel`, commit de produção `121cca799aa7072094c668697249214b899e86d5`.

1. Produção e homologação devem encerrar cada ciclo na mesma base estável de código e funcionalidades. Credenciais, contas, bancos e configurações de ambiente têm isolamento próprio.
2. Toda nova implementação começa e é validada exclusivamente em homologação.
3. Preservar todas as funcionalidades, configurações e interfaces anteriormente aprovadas. Alterações visuais ou funcionais exigem autorização expressa do proprietário.
4. Executar e registrar testes de regressão antes de qualquer publicação. Corrigir falhas antes de avançar.
5. Promover a revisão validada para produção somente após aprovação prática e autorização expressa do proprietário.
6. Após cada publicação oficial, restabelecer e verificar a paridade da base estável entre os ambientes, preservando suas configurações e seus dados isolados.
7. Criar e verificar um ponto de restauração para cada versão estável aprovada. Registrar versão, commit, artefato, hashes e procedimento de rollback.

A diretriz se aplica a todos os ciclos futuros, inclusive ao **Smart AI Server**. A paridade é de código e comportamento aprovado e deve ser verificada sem compartilhar bancos, contas, credenciais ou configurações entre ambientes.

Registrar no encerramento de cada ciclo a revisão validada, o resultado da regressão, a aprovação prática, a autorização do proprietário e a evidência de paridade. O [documento mestre](DOCUMENTO-MESTRE.md) consolida a diretriz e o [plano de execução](online/PLANO-DE-ACAO.md) acompanha sua aplicação.

## Interface V34.7.4.5 congelada

O proprietário aprovou definitivamente a interface de `d276e2e02390deafaddbac182399bbae9874d8ac`, incluindo a tela original de login. A evidência imutável é o workflow `44426582854`, artefato `14484622434`, SHA-256 `955d1f808edb7aec0a7e28af3293086af7532e6ea474819f5bc619d0b367151a`, Hosting `91b1e7870cc00e40`. Usar essa revisão e seus hashes nas comparações visuais, inclusive para o Smart Admin, o modal de duas colunas e o perfil por função.

Compatibilidade técnica de produção deve preservar telas, componentes, cores, fontes, ícones, dimensões, espaçamentos e funcionalidades. Qualquer exceção exige autorização expressa antes da alteração. O leitor existente em produção, a Chave API e a identidade PWA fazem parte do inventário. IA centralizada é um ciclo posterior.

Referência de produção para a V34.7.4.4: V34.6.8, commit `b880872fc48e5832eb7f9d299d342ef5bf5c376d`. O SHA-256 do HTML servido é `19d4d8b53defc9666f48645d9b0a0f63dd4bf0cdd759cd9a3863974d10fef591`. A referência de homologação é a V34.7.4.3, commit `fe16c8427ba9640cad58b6ad011278ebda32b012`.

| Funcionalidade aprovada | Controle de regressão |
| --- | --- |
| Marca, logo, selo APP verde e versão única no cabeçalho e no instalador | `production-parity.test.mjs`, `visual-refinement.test.mjs` |
| Login Google, perfis verificados, isolamento de UID e revogação | `online/google-profile*.test.mjs`, `integration.test.mjs` |
| Smart Admin, sete colunas alinhadas, indicadores, filtros, pesquisa, proteção, auditoria e modal compacto | `smart-admin-modal.test.mjs`, `integration.test.mjs`, `online/online-rules.test.mjs` |
| Entradas do leitor e da chave de IA, restrições por plano, serviço online desativado e laboratório sintético | `production-parity.test.mjs`, `integration.test.mjs`, suítes de cotas e autorização do backend |
| Consentimento de vínculo, Free local, Premium isolado, recuperação, sincronização bidirecional e offline | `production-parity.test.mjs`, `scope.test.mjs`, `integration.test.mjs` |
| Menus, backup JSON, importação, exportação Excel, PWA, atualização e desktop/mobile | `production-parity.test.mjs`, `visual-refinement.test.mjs`, `integration.test.mjs`, `stage-hosting.mjs` |
| Perfil no cabeçalho, faixa técnica e área sem espaço residual | `production-parity.test.mjs`: somente Owner/Admin verificados. Free/Premium têm nome, foto ou iniciais, plano e logout em Opções → Sincronização na nuvem |
| Ajuda da Renda Base e Segurança & App | `production-parity.test.mjs`: interrogação alinhada e acessível e exatamente Chave API, Senha PIN, Instalar App, nessa ordem |
| Oferta Premium e leitor | `production-parity.test.mjs`: Free com cadeado dourado e modal histórico sem preços ou pagamentos. Premium com coroa dourada e leitor. Owner/Admin seguem plano e permissão. Homologação online mantém processamento desligado |

As decisões da V34.7.4.5 são protegidas. Alterações ou remoções em funcionalidades, componentes visuais, fluxos e configurações aprovados exigem autorização expressa do proprietário. Em especial, a visibilidade do perfil no cabeçalho e o logout na área de nuvem não devem ser alterados sem essa autorização.

A entrada Chave API deve permanecer até que a IA centralizada esteja implementada, funcional, segura, testada e expressamente aprovada. Spark permanece vigente. Não incluir cobrança ou serviços pagos na promoção sem autorização.

## Diferenças de ambiente

O código comum fica no dashboard `official/`. A etiqueta de homologação, a conta de teste, o adaptador Firebase, a origem permitida, o escopo de armazenamento e a disponibilidade de IA são específicos do ambiente. Chaves Gemini, envio de documentos reais, Functions em nuvem e permissões de produção ficam fora do candidato de homologação. A entrada de chave em homologação apresenta o estado indisponível, sem coletar credenciais.

## Gate de publicação

1. Trabalhar a partir da revisão homologada. Transferir correções de paridade para os componentes comuns, com o menor delta compatível.
2. Executar o workflow de homologação completo. O estágio de empacotamento só roda após as suítes passarem e valida o destino, a versão e o inventário SHA-256 do Service Worker.
3. Publicar em homologação o artefato verificado, sem reconstruí-lo. Conferir todos os hashes servidos e registrar a versão de Hosting e o commit.
4. Para produção, exigir aprovação expressa do proprietário. Preparar e testar antes da aprovação um artefato que use a mesma revisão dos componentes comuns e somente a configuração de produção. Registrar a lista de arquivos específicos do ambiente e os hashes do candidato. Promover exatamente o artefato de produção validado, com as configurações de produção e sem alterações de origem, regras ou armazenamento.

Uma funcionalidade listada que falhe na validação bloqueia o empacotamento e a publicação. O gate valida o candidato do workflow. O acesso administrativo ao Hosting continua sujeito às permissões Firebase.
