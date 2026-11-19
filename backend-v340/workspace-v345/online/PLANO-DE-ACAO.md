# Raytech CG — Plano de ação consolidado

## Preparação oficial V34.7.4.5

- Aprovação prática do proprietário registrada para a interface definitiva de `d276e2e02390deafaddbac182399bbae9874d8ac`, inclusive o login original. Essa revisão é a referência visual congelada para produção.
- Evidência automatizada anterior: 178/178 no workflow `44426582854`, artefato `14484622434`. A aprovação visual não equivale à aprovação dos fluxos em um candidato oficial, que requerem registro próprio de testes sintéticos.
- A autorização atual permite preparar e testar a compatibilidade. Publicação, merge na main oficial e alterações nas regras remotas permanecem sujeitos a autorização específica. Cotas e auditoria precisam funcionar pelo contrato de produção, sem usar coleções de homologação.

## Decisões aprovadas da V34.7.4.5

- Cabeçalho com marca, logo, selo APP e versão. Perfil, menu suspenso e faixa técnica exclusivamente para Owner/Admin verificados. Free/Premium sem lacuna no cabeçalho e com identidade, plano e logout em Opções → Sincronização na nuvem. O login de teste mantém a identificação da homologação.
- Ajuda da Renda Base por botão de interrogação alinhado, com espaçamento e expansão acessível em desktop e mobile.
- Free vê cadeado dourado e o modal Premium do histórico. Premium vê coroa dourada e leitor. Owner/Admin seguem o plano e as permissões atribuídas. Sem preços ou links de pagamento. Processamento online de homologação permanece desativado.
- Segurança & App contém Chave API, Senha PIN e Instalar App, nessa ordem. Remover Chave API somente após a IA centralizada estar operacional, segura, validada e expressamente aprovada. Preservar Spark.
- Proteger os sete campos por linha e o modal compacto do Smart Admin, perfis Google, indicadores, filtros, auditoria, regras de plano, sincronização, PWA, backups, importação, exportação e isolamento dos bancos. Alterações ou remoções de itens aprovados exigem autorização expressa do proprietário, inclusive a separação do perfil por função.
- Publicar o candidato verificado somente no Hosting de homologação. Para a atualização oficial, preparar a mesma revisão comum com os adaptadores de produção, backup, rollback e testes de autenticação, bancos, sincronização, Smart Admin e IA. Solicitar uma única autorização final depois da aprovação prática da homologação, antes da publicação oficial.

Versão de trabalho: V34.7.4.1 Online Spark. Branch exclusiva: feature/v34-7-4-1-online-spark.
Referência visual oficial, somente leitura: Matos40/Controle-de-gastos-2.0@b880872fc48e5832eb7f9d299d342ef5bf5c376d. Preservar componentes e funcionalidades aprovados; novas funcionalidades não justificam regressão visual.

## 01 — Consolidar a versão de homologação (em execução)
Corrigir a falha de estilos no workflow 44391590168 (seletor .v345-usage progress ausente após restauração do CSS oficial). Preservar layout compacto, filtros, proteção de administradores, monitor e cotas no modal, tratamento BUG-V3474-001. Executar regressões essenciais e preparar artefato estático Hosting. Conclusão exige workflow completo bem-sucedido e artefato correspondente ao HEAD. Não publicar nesta etapa.

## 02 — Ativar homologação online (aguarda autorização)
Comparar regras remotas completas e inserir bloco exclusivo de homologação sem sobrescrever regras válidas; validar regras combinadas. Provisionar somente contas fictícias Owner, Admin, Premium e Free. Publicar exclusivamente Hosting no projeto raytech-cg-homologacao com Spark; conferir atualização PWA e isolamento. Nenhuma intervenção na produção.

## 03 — Concluir Smart Admin
Retomar T08 (bloqueio e desbloqueio) online. T01–T07 tiveram aprovação prática local, alguns apenas de interface; T08-A evidência de tela bloqueada, T08-B interrompido pelo erro. Não repetir desnecessariamente testes anteriores; confirmar os fluxos afetados pela integração, proteção Owner/Admin, auditoria e ausência da regressão. Usar dados sintéticos.

## 04 — Validar núcleo financeiro
Sincronização PC/celular, offline/reconexão, isolamento de usuários e três bancos, preservação de lançamentos, JSON/Excel. Validar fluxos afetados, sem migrar bancos reais.

## 05 — Finalizar Smart AI
Definir infraestrutura segura, leitor de faturas, autorização, cotas, monitor e controle de custos. IA online fica desativada enquanto backend seguro não estiver disponível no Spark. Não contratar serviços pagos nem relaxar regras. Recursos de IA simulados nos emuladores não equivalem a backend publicado.

## 06 — Atualização oficial (autorização específica posterior)
Backup, versão homologada, publicação e reversão, validação prática. Produção permanece intocada até aprovação explícita.

## Regras permanentes
Manter Spark, dados reais e produção preservados. Testes práticos somente na homologação online; emuladores do CI apenas para testes automáticos. Não gerar pacotes Windows. Registrar resultados verificáveis por commit/workflow. Encerrar cada etapa com evidências e solicitação de autorização antes da próxima. Não considerar regras remotas publicadas ou testes práticos concluídos sem evidência.
