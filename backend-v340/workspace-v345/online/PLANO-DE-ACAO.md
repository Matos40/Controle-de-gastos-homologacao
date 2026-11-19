# Raytech CG — Plano de ação consolidado

## Estado atual · V34.7.4.5 Stable Edition

**Ciclo encerrado.** O proprietário aprovou os sete testes práticos da Etapa 07. A referência oficial é o commit `121cca799aa7072094c668697249214b899e86d5`, preservado na branch `restore/v34-7-4-5-estavel`. O [documento mestre](../DOCUMENTO-MESTRE.md) reúne os identificadores e as evidências definitivas.

| Etapa | Estado no encerramento |
| --- | --- |
| 01 · Consolidar a versão de homologação | Concluída |
| 02 · Ativar a homologação online | Concluída |
| 03 · Concluir Smart Admin | Concluída |
| 04 · Validar o núcleo financeiro | Concluída |
| 05 · Finalizar o escopo de Smart AI do ciclo | Concluída, preservando a Chave API e o leitor existente |
| 06 · Atualização oficial | Concluída, workflow `44433045711` |
| 07 · Stable Validation | Concluída, 7/7 testes práticos aprovados pelo proprietário |
| 08 · Smart AI Server | Aberta, somente em planejamento |

O fechamento registra 178 testes automatizados de referência e 329/329 arquivos oficiais verificados. Na Etapa 08, preservar o plano Spark, a Chave API e o leitor de faturas funcional até a aprovação definitiva da IA centralizada. Qualquer mudança de plano exige autorização expressa.

ChatGPT é responsável pelo planejamento, pela arquitetura e pela interface visual. Codex é responsável pela implementação, pelos testes e pelas publicações autorizadas. A implementação de ciclos futuros começa exclusivamente em homologação.

## Diretriz permanente de execução

A referência estável atual é **V34.7.4.5 Stable Edition**, branch `restore/v34-7-4-5-estavel`, commit de produção `121cca799aa7072094c668697249214b899e86d5`.

1. Produção e homologação devem encerrar cada ciclo na mesma base estável de código e funcionalidades. Credenciais, contas, bancos e configurações de ambiente têm isolamento próprio.
2. Toda nova implementação começa e é validada exclusivamente em homologação.
3. Preservar todas as funcionalidades, configurações e interfaces anteriormente aprovadas. Alterações visuais ou funcionais exigem autorização expressa do proprietário.
4. Executar e registrar testes de regressão antes de qualquer publicação. Corrigir falhas antes de avançar.
5. Promover a revisão validada para produção somente após aprovação prática e autorização expressa do proprietário.
6. Após cada publicação oficial, restabelecer e verificar a paridade da base estável entre os ambientes, preservando suas configurações e seus dados isolados.
7. Criar e verificar um ponto de restauração para cada versão estável aprovada. Registrar versão, commit, artefato, hashes e procedimento de rollback.

A diretriz se aplica a todos os ciclos futuros, inclusive ao **Smart AI Server**. A paridade é de código e comportamento aprovado e deve ser verificada sem compartilhar bancos, contas, credenciais ou configurações entre ambientes.

Consultar também o [documento mestre](../DOCUMENTO-MESTRE.md) e o [inventário de paridade](../PARIDADE-E-PUBLICACAO.md).

## Preparação oficial V34.7.4.5

- Aprovação prática do proprietário registrada para a interface definitiva de `d276e2e02390deafaddbac182399bbae9874d8ac`, inclusive o login original. Essa revisão é a referência visual congelada para produção.
- Evidência automatizada anterior: 178/178 no workflow `44426582854`, artefato `14484622434`. A aprovação visual não equivale à aprovação dos fluxos em um candidato oficial, que requerem registro próprio de testes sintéticos.
- A autorização atual permite preparar e testar a compatibilidade. Publicação, merge na main oficial e alterações nas regras remotas permanecem sujeitos a autorização específica. Cotas e auditoria precisam funcionar pelo contrato de produção, sem usar coleções de homologação.
- Testes automatizados de preparação: fluxo financeiro e administrativo em emuladores, T08 de bloqueio/desbloqueio, restauração JSON e Excel, regras atuais e proposta de cotas com auditoria atômica. Esses resultados usam dados sintéticos e são distintos da aprovação prática da interface em homologação.
- Exceção de produção autorizada: preservar a captura, a prévia, a configuração de chave e o leitor Gemini existentes na V34.6.8. A preparação oficial mantém os componentes comuns congelados e exercita a integração do leitor com respostas simuladas. A autorização cobre preparação, não publicação.
- O candidato oficial fica no repositório de produção em `release-candidate/v34.7.4.5-production`. A regra validada em emulador para persistir cotas e sua auditoria continua pendente de autorização remota. Preparação e validação do candidato não autorizam gravações ou migração de dados reais.

## Decisões aprovadas da V34.7.4.5

- Cabeçalho com marca, logo, selo APP e versão. Perfil, menu suspenso e faixa técnica exclusivamente para Owner/Admin verificados. Free/Premium sem lacuna no cabeçalho e com identidade, plano e logout em Opções → Sincronização na nuvem. O login de teste mantém a identificação da homologação.
- Ajuda da Renda Base por botão de interrogação alinhado, com espaçamento e expansão acessível em desktop e mobile.
- Free vê cadeado dourado e o modal Premium do histórico. Premium vê coroa dourada e leitor. Owner/Admin seguem o plano e as permissões atribuídas. Sem preços ou links de pagamento. Processamento online de homologação permanece desativado.
- Segurança & App contém Chave API, Senha PIN e Instalar App, nessa ordem. Remover Chave API somente após a IA centralizada estar operacional, segura, validada e expressamente aprovada. Preservar Spark.
- Proteger os sete campos por linha e o modal compacto do Smart Admin, perfis Google, indicadores, filtros, auditoria, regras de plano, sincronização, PWA, backups, importação, exportação e isolamento dos bancos. Alterações ou remoções de itens aprovados exigem autorização expressa do proprietário, inclusive a separação do perfil por função.
- Publicar o candidato verificado somente no Hosting de homologação. Para a atualização oficial, preparar a mesma revisão comum com os adaptadores de produção, backup, rollback e testes de autenticação, bancos, sincronização, Smart Admin e IA. Solicitar uma única autorização final depois da aprovação prática da homologação, antes da publicação oficial.

## Histórico de execução das etapas 01 a 06

Registros preservados da abertura do ciclo. Seus estados atuais constam na tabela de encerramento acima.

Versão inicial de trabalho: V34.7.4.1 Online Spark. Branch exclusiva à época: feature/v34-7-4-1-online-spark.
Referência visual oficial, somente leitura: Matos40/Controle-de-gastos-2.0@b880872fc48e5832eb7f9d299d342ef5bf5c376d. Preservar componentes e funcionalidades aprovados; novas funcionalidades não justificam regressão visual.

### 01 — Consolidar a versão de homologação
Corrigir a falha de estilos no workflow 44391590168 (seletor .v345-usage progress ausente após restauração do CSS oficial). Preservar layout compacto, filtros, proteção de administradores, monitor e cotas no modal, tratamento BUG-V3474-001. Executar regressões essenciais e preparar artefato estático Hosting. Conclusão exige workflow completo bem-sucedido e artefato correspondente ao HEAD. Não publicar nesta etapa.

### 02 — Ativar homologação online
Comparar regras remotas completas e inserir bloco exclusivo de homologação sem sobrescrever regras válidas; validar regras combinadas. Provisionar somente contas fictícias Owner, Admin, Premium e Free. Publicar exclusivamente Hosting no projeto raytech-cg-homologacao com Spark; conferir atualização PWA e isolamento. Nenhuma intervenção na produção.

### 03 — Concluir Smart Admin
Retomar T08 (bloqueio e desbloqueio) online. T01–T07 tiveram aprovação prática local, alguns apenas de interface; T08-A evidência de tela bloqueada, T08-B interrompido pelo erro. Não repetir desnecessariamente testes anteriores; confirmar os fluxos afetados pela integração, proteção Owner/Admin, auditoria e ausência da regressão. Usar dados sintéticos.

### 04 — Validar núcleo financeiro
Sincronização PC/celular, offline/reconexão, isolamento de usuários e três bancos, preservação de lançamentos, JSON/Excel. Validar fluxos afetados, sem migrar bancos reais.

### 05 — Finalizar o escopo de Smart AI do ciclo
Definir infraestrutura segura, leitor de faturas, autorização, cotas, monitor e controle de custos. IA online fica desativada enquanto backend seguro não estiver disponível no Spark. Não contratar serviços pagos nem relaxar regras. Recursos de IA simulados nos emuladores não equivalem a backend publicado.

### 06 — Atualização oficial
Backup, versão homologada, publicação e reversão, validação prática. Produção permanece intocada até aprovação explícita.

## Regras permanentes
Manter Spark, dados reais e produção preservados. Testes práticos somente na homologação online; emuladores do CI apenas para testes automáticos. Não gerar pacotes Windows. Registrar resultados verificáveis por commit/workflow. Encerrar cada etapa com evidências e solicitação de autorização antes da próxima. Não considerar regras remotas publicadas ou testes práticos concluídos sem evidência.
