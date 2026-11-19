# Raytech CG · Inventário de funcionalidades protegidas

A base é a **V34.7.4.5 Stable Edition**, commit oficial `121cca799aa7072094c668697249214b899e86d5`, preservado em `restore/v34-7-4-5-estavel`. O proprietário aprovou 7/7 testes práticos da Etapa 07. O inventário integra a proteção contra regressões de todos os ciclos. [Documento mestre](DOCUMENTO-MESTRE.md) · [Paridade e publicação](PARIDADE-E-PUBLICACAO.md)

| Área | Funcionalidades e configurações protegidas |
| --- | --- |
| Identidade e login | Interface congelada, botão Entrar com Google com logotipo original colorido, autenticação Google e isolamento por UID. |
| Cabeçalho e conta | Marca, selo APP verde e versão. Perfil e faixa técnica somente para Owner/Admin verificados. Identificação e logout de Free/Premium em Opções → Sincronização na nuvem. |
| Smart Admin | Sete colunas alinhadas, uma linha por usuário, ação Exibir detalhes, modal compacto, perfis sincronizados, indicadores, pesquisa, filtros, proteção Owner/Admin, cotas e auditoria atômica. |
| Finanças e nuvem | Núcleo financeiro, três bancos, históricos e parcelamentos, vínculo inicial seguro, sincronização Premium, restrição Free, recibos, revisões, recuperação automática e isolamento entre usuários. |
| PWA e cópias | Identidade oficial, modo offline, atualização segura, backups JSON, restauração, importação, exportação Excel e responsividade. |
| IA existente | Fluxo Free/Premium, captura e prévia de faturas, Chave API e leitor funcional de produção. Preservar até a aprovação definitiva da IA centralizada. |
| Ambientes | Mesma base estável de código e funcionalidades ao fim de cada ciclo, com bancos, credenciais, contas e configurações isolados. Preservar Spark até autorização expressa. |

Alterações ou remoções exigem autorização expressa do proprietário. Toda implementação começa em homologação. A promoção da mesma revisão exige regressão aprovada, aprovação prática e autorização expressa, seguida da verificação de paridade e do registro do ponto de restauração.

**Etapa 08 Smart AI Server** aberta somente em planejamento. ChatGPT responde pelo planejamento, pela arquitetura e pela interface visual. Codex responde pela implementação, pelos testes e pelas publicações autorizadas.
