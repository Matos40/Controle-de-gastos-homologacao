# RAYTECH CG V35.0
## Etapa 08.5.3 — Visual Fidelity, Smart AI Native Integration & Legacy API Retirement

Execute efetivamente as correções e integrações experimentais previstas nesta especificação.

Esta instrução atualiza e complementa a autorização anterior da Etapa 08.5.3.

Caso a execução dessa etapa já tenha sido iniciada, identifique o estado atual, preserve as alterações válidas já realizadas e implemente somente as correções e requisitos complementares pendentes.

Não reinicie desnecessariamente o desenvolvimento.

## 1. REFERÊNCIAS OPERACIONAIS

- Aplicativo: Raytech CG.
- Versão candidata: V35.0.
- Repositório experimental: Matos40/Controle-de-gastos-homologacao.
- Branch: feature/smart-ai-server-v350-poc.
- Commit de referência: d94c6499a258dd4f83fccc898b9b4c503df76ef5.
- GitHub Actions de referência: 44777763668.
- Baseline mínima: 117 testes experimentais aprovados.
- Repositório oficial: Matos40/Controle-de-gastos-2.0.
- Versão oficial protegida: V34.7.4.5.
- Commit oficial de referência visual: 121cca799aa7072094c668697249214b899e86d5.
- Projeto Cloud Run: raytech-3d.
- Número do projeto: 761761828111.
- Nome: Raytech Smart AI Cloud Run.
- Firebase experimental: gen-lang-client-0593667072.
- Orçamento mensal: R$ 10,00.
- Suspensão financeira preventiva: 75%.
- Especificações anteriores: ESP-SMART-AI-085-001 e ESP-SMART-AI-0852-001.

Registre a especificação atualizada como ESP-SMART-AI-0853-001 v2.0.

Consolide os requisitos UX01 a UX65, SEC-01 a SEC-10 e BUG-0851-01 a BUG-0851-03.

Em caso de divergência entre a especificação anterior e esta atualização, prevalece a nova diretriz, respeitando as restrições de preservação dos ambientes oficiais.

## 2. OBJETIVO ESTRATÉGICO

A versão definitiva do Raytech CG V35.0 deverá utilizar exclusivamente o Smart AI Server para a extração integrada de faturas por inteligência artificial.

O usuário não deverá precisar:

- Criar uma conta de desenvolvedor Gemini.
- Gerar uma chave API pessoal.
- Configurar uma chave API.
- Conhecer detalhes da infraestrutura de inteligência artificial.
- Selecionar entre diferentes provedores de extração.

A experiência final deverá ser:

1. Abrir Escanear Fatura com IA.
2. Consultar créditos e disponibilidade.
3. Selecionar, arrastar ou colar uma fatura.
4. Solicitar a extração.
5. Revisar os lançamentos identificados.
6. Confirmar manualmente os lançamentos.

O Smart AI deverá funcionar como serviço integrado ao aplicativo, e não como aplicativo paralelo.

Nesta etapa, implemente e valide esse comportamento exclusivamente na cópia experimental isolada, utilizando provedor simulado.

A retirada definitiva da modalidade legada na produção somente poderá ocorrer após a aprovação da comunicação remota, da integração financeira, dos testes em homologação e da autorização expressa de publicação.

## 3. DESIGN LOCK — PRESERVAÇÃO DA IDENTIDADE VISUAL

A V34.7.4.5 é a referência visual obrigatória.

A V35.0 deverá acrescentar funcionalidades sem reformular o aplicativo.

Preserve rigorosamente:

- Tela de login.
- Logo.
- Cabeçalho.
- Nome e foto do usuário.
- Identificação do plano.
- Identificação da função administrativa.
- Seletor de meses.
- Botões de navegação entre meses.
- Controle de visualização dos valores.
- Ícone de sincronização.
- Menu Opções.
- Painel financeiro.
- Formulários.
- Cards existentes.
- Fontes.
- Ícones.
- Cores.
- Bordas.
- Espaçamentos.
- Responsividade.
- Smart Admin.
- Janela de detalhes dos usuários.
- Sincronização na nuvem.
- Seção Ajuda.
- PWA.

Reutilize HTML, CSS, renderizadores, classes, fontes e componentes originais.

Não crie novos cabeçalhos, barras administrativas ou janelas paralelas.

Não aplique estilos globais do laboratório sobre os componentes oficiais.

As alterações de aparência deverão ficar restritas aos novos elementos Smart AI ou às correções expressamente autorizadas.

## 4. REQUISITOS UX01 A UX18 — LEITURA E REVISÃO FINANCEIRA

Preserve e valide individualmente:

UX01 — Exibir valores monetários em reais, utilizando o padrão brasileiro. Manter centavos inteiros no processamento interno.

UX02 — Exibir estornos e créditos negativos em verde, preservando o sinal e sua natureza financeira.

UX03 — Exibir corretamente o estado de créditos esgotados.

UX04 — Exibir corretamente suspensão administrativa, financeira, indisponibilidade e ausência de conexão.

UX05 — Bloquear antecipadamente os controles de extração quando o serviço não puder admitir novas leituras.

UX06 — Reutilizar a área original de seleção, arraste e colagem de arquivos.

UX07 — Requisito atualizado: preservar o mecanismo legado exclusivamente no ponto de restauração e em uma variante de recuperação isolada. Não oferecer Chave API pessoal na variante server-only candidata à distribuição.

UX08 — Limpar mensagens, resultados e estados obsoletos após cancelamento, confirmação, fechamento, logout ou mudança de sessão.

UX09 — Reutilizar o catálogo de categorias existente do cartão, incluindo categorias personalizadas.

UX10 — Permitir edição de valores em reais, com conversão exata para centavos inteiros.

UX11 — Exibir o total dos lançamentos selecionados em tempo real.

UX12 — Preservar separadamente o total original, o total calculado e o total revisado.

UX13 — Utilizar caixas de seleção compactas e coerentes com o aplicativo.

UX14 — Diferenciar visualmente Cancelar e Confirmar.

UX15 — Apresentar claramente a reconciliação, divergências e informações insuficientes.

UX16 — Utilizar cartões de revisão compactos e legíveis.

UX17 — Preservar as informações das compras parceladas e seus valores individuais.

UX18 — Exigir revisão manual antes de qualquer lançamento.

### Gabarito obrigatório

- Compra à vista: R$ 18,90.
- Compra parcelada 2/3: R$ 25,90.
- Estorno: −R$ 6,25.
- Total original: R$ 38,55.
- Total calculado: R$ 38,55.
- Divergência: R$ 0,00.

Ao desmarcar a compra parcelada, o total selecionado deverá passar para R$ 12,65.

Não altere o total original ao selecionar ou desmarcar lançamentos.

Não invente lançamentos compensatórios.

Não transforme estornos em despesas positivas.

Preserve a extração original separadamente das alterações realizadas durante a revisão.

Mantenha a confirmação financeira simulada nesta etapa.

## 5. REQUISITOS UX19 A UX28 — SMART ADMIN AI

UX19 — Pesquisa administrativa autorizada por nome, e-mail e UID.

UX20 — Indicadores administrativos compactos, utilizando os componentes existentes.

UX21 — Gráficos discretos de consumo Free e Premium.

UX22 — Indicador visual de utilização do orçamento.

UX23 — Exibição dos limiares financeiros de 25%, 50%, 75% e 100%.

UX24 — Controle de suspensão emergencial protegido por autorização, reautenticação e auditoria.

UX25 — Diferenciar suspensão manual e financeira.

UX26 — Utilizar linguagem clara em português.

UX27 — Apresentar auditoria detalhada, incluindo responsável, papel, horário, operação, estado anterior, estado posterior e resultado.

UX28 — Diferenciar estimativas de custos, faturamento observado, faturamento simulado e ausência de informações financeiras.

Preserve o Smart Admin existente.

Integre todas as novas funcionalidades ao Smart AI Monitor já existente.

Não crie um segundo painel administrativo.

Preserve a pesquisa autorizada, paginação, minimização de dados e proteção contra enumeração de usuários.

Utilize exclusivamente perfis fictícios nesta etapa.

## 6. REQUISITOS UX29 A UX45 — FIDELIDADE VISUAL

UX29 — Harmonizar o Smart AI com a identidade visual oficial.

UX30 — Manter uma única coluna de lançamentos no mobile.

UX31 — Preservar espaçamento adequado entre elementos.

UX32 — Compactar os cartões sem comprometer a legibilidade.

UX33 — Reutilizar fontes, ícones, cores e bordas oficiais.

UX34 — Eliminar cortes e rolagem horizontal indevida.

UX35 — Preservar responsividade desktop, Android e iOS.

UX36 — Exibir barra financeira discreta, fina, arredondada e proporcional, com cores dinâmicas.

UX37 — Preservar a janela original Escanear Fatura com IA.

UX38 — Preservar os ícones originais do aplicativo.

UX39 — Preservar rigorosamente o cabeçalho oficial.

UX40 — Preservar a estrutura visual original do Smart Admin.

UX41 — Integrar os indicadores ao Smart AI Monitor expansível existente.

UX42 — Preservar a janela original de detalhes dos usuários e integrar os créditos ao Smart AI Usage.

UX43 — Requisito atualizado: preservar o botão, código e configuração da Chave API somente no mecanismo de restauração e na versão oficial atualmente publicada. Na variante server-only candidata, remover integralmente a configuração e a funcionalidade de extração direta pelo navegador.

UX44 — Remover barras e botões extras exclusivos do laboratório da interface candidata.

UX45 — Comprovar equivalência visual com a V34.7.4.5, ressalvadas as novas funcionalidades autorizadas.

A mudança estratégica referente a UX07 e UX43 não autoriza nenhuma alteração na produção atual.

Não remova ou enfraqueça os testes anteriores do mecanismo legado. Execute-os contra a implementação de recuperação preservada, separadamente dos testes da variante server-only.

Acrescente testes específicos que comprovem a ausência do mecanismo legado na distribuição candidata.

## 7. REQUISITOS UX46 A UX48 — SINCRONIZAÇÃO NA NUVEM

UX46 — Reutilizar integralmente a estrutura visual da sincronização na nuvem da produção.

UX47 — Preservar a disposição horizontal aprovada:

- Avatar à esquerda.
- Nome do usuário.
- Conta Google e plano.
- Logout à direita.

UX48 — Preservar os componentes oficiais:

- Status de sincronização.
- Última sincronização.
- Informação Nuvem V2.
- Número da revisão, quando disponível.
- Botão Sincronizar agora.
- Seção Ajuda.
- Tutorial.
- Primeiros passos.

Não apresente avatar, nome e logout verticalmente quando a versão oficial utiliza disposição horizontal.

Não apresente campos de identificação do plano vazios.

Valide os estados:

- Sincronizado.
- Sincronizando.
- Offline.
- Desconectado.
- Atenção.

Utilize os renderizadores oficiais alimentados por dados experimentais.

Não conecte o laboratório ao Firebase oficial.

Quando utilizar o estado sincronizado em cenários fictícios, identifique claramente a simulação em ambiente experimental.

Não apresente sincronização real bem-sucedida quando somente uma simulação tiver sido executada.

## 8. REQUISITOS UX49 E UX50 — CRÉDITOS E BLOQUEIOS

UX49 — Organizar a apresentação dos créditos de maneira compacta, clara e visualmente integrada ao Smart AI.

UX50 — Bloquear novas extrações após o esgotamento dos créditos, tanto na interface quanto no servidor.

Preserve a política comercial aprovada:

### FREE

- Dois créditos vitalícios.
- Sem renovação mensal.
- Sem acumulação.
- Bloqueio após dois processamentos bem-sucedidos.
- Oferta de conhecimento do Premium quando aplicável.

### PREMIUM

- Quinze créditos mensais.
- Renovação no primeiro dia do mês.
- Fuso America/Bahia.
- Sem acumulação.
- Bloqueio após esgotamento.

### Regras obrigatórias

O Smart AI permanece disponível para usuários Free que possuam créditos legítimos.

Não bloqueie indiscriminadamente todos os usuários Free.

O estado de disponibilidade dependerá do saldo, da autenticação, da conexão, das condições operacionais e das proteções do servidor.

Com zero créditos, bloqueie:

- Seleção de arquivos.
- Arrastar e soltar.
- Colagem de imagens.
- Botão de extração.
- Chamadas diretas não autorizadas ao endpoint.

O servidor deverá ser a autoridade final sobre créditos e admissão.

Preserve a possibilidade de revisar uma extração já concluída.

Não restitua créditos apenas porque o usuário fechou a janela após uma extração bem-sucedida.

## 9. REQUISITOS UX51 A UX60 — SMART AI MONITOR E PROTEÇÃO FINANCEIRA

UX51 — Preservar a barra financeira dentro do Smart AI Monitor.

UX52 — Garantir coerência entre indicadores, cores, utilização financeira e disponibilidade.

UX53 — Preservar integralmente os componentes oficiais, evitando substituições simplificadas.

UX54 — Padronizar os botões administrativos conforme as cores e classes da produção.

UX55 — Padronizar os campos de pesquisa e configuração conforme o Smart Admin oficial.

UX56 — Exibir a estrutura neutra da barra financeira quando o faturamento estiver indisponível.

UX57 — Posicionar a barra financeira imediatamente próxima aos valores do orçamento e do consumo.

UX58 — Eliminar a duplicação do campo de pesquisa de usuários.

UX59 — Diferenciar visualmente o botão de suspensão emergencial.

UX60 — Compactar e organizar os indicadores dentro do Smart AI Monitor.

### Organização financeira obrigatória

Exiba:

- Orçamento mensal.
- Faturamento observado.
- Percentual utilizado.
- Barra de progresso.
- Nível de atenção.
- Estado operacional.
- Data e horário da última observação válida.

Utilize as seguintes faixas:

- Abaixo de 25%: verde.
- A partir de 25% e abaixo de 50%: amarelo.
- A partir de 50% e abaixo de 75%: laranja.
- A partir de 75% e abaixo de 100%: vermelho.
- A partir de 100%: vermelho intenso.

O orçamento aprovado permanece em R$ 10,00.

Limiares:

- R$ 2,50 — 25%.
- R$ 5,00 — 50%.
- R$ 7,50 — 75%, suspensão preventiva.
- R$ 10,00 — 100%, nível crítico.

A barra deverá ser fina, discreta, horizontal, arredondada e responsiva.

O preenchimento deverá assumir a cor correspondente ao nível de atenção atual.

Consumos superiores a 100% deverão manter a largura visual limitada a 100%, apresentando o percentual textual efetivamente observado.

### Faturamento indisponível

Quando não houver observação válida:

- Exiba a barra em cinza neutro, sem preenchimento representativo de consumo.
- Exiba faturamento e percentual como indisponíveis.
- Apresente Aguardando atualização do faturamento.
- Não invente R$ 0,00 ou 0%.
- Preserve a proteção preventiva estabelecida.

Diferencie observação autêntica igual a zero de ausência de observação.

### Reativação

A reativação autorizada não poderá:

- Zerar o faturamento observado.
- Apagar o histórico de alertas.
- Alterar artificialmente a cor correspondente ao consumo.
- Contornar o Finance Guard.
- Revogar permanentemente a suspensão preventiva futura.

Preserve a nova suspensão diante de eventos financeiros válidos, conforme a política aprovada.

Informe separadamente o estado operacional e o nível de utilização financeira.

O orçamento não deverá ser apresentado como teto garantido de cobrança.

## 10. REQUISITOS UX61 A UX65 — NOVA INTERFACE SERVER-ONLY

Os requisitos UX61 a UX65 foram atualizados em razão da decisão de eliminar a Chave API pessoal da experiência pública definitiva.

Não implemente duas modalidades permanentes de leitura na variante server-only.

UX61 — Exibir o Smart AI como um componente informativo único dentro da janela original Escanear Fatura com IA, e não como um botão de navegação.

UX62 — Agrupar plano, saldo de créditos, limite, disponibilidade e informação de renovação no mesmo componente visual.

UX63 — Eliminar seletores redundantes entre Smart AI e Chave API na variante server-only.

UX64 — Informar sucintamente que a leitura é fornecida pela inteligência artificial integrada ao Raytech CG. O usuário não precisa configurar chaves pessoais.

UX65 — Preservar organização compacta, responsividade e identidade visual roxa da janela original.

### Estrutura visual pretendida

Cabeçalho original:

Escanear Fatura com IA.

Ícone original de inteligência artificial.

Botão X no canto superior direito.

Subtítulo original.

Componente informativo Smart AI:

- Plano Free ou Premium.
- Créditos disponíveis: 2 de 2 ou 15 de 15.
- Barra discreta de créditos restantes.
- Estado operacional.
- Data de renovação, quando aplicável.

Área original de upload:

- Selecionar arquivo.
- Arrastar e soltar.
- Colar imagem.
- PDF e imagens compatíveis.
- Limite de 10 MiB.

Rodapé original:

- Cancelar.
- Extrair Gastos com IA.

Quando o usuário Free esgotar os créditos, bloqueie a área de upload e apresente Conhecer o Premium, sem substituir ou descaracterizar desnecessariamente o layout original.

Quando o Premium esgotar os créditos, apresente a data da próxima renovação.

Não apresente uma opção inexistente de leitura alternativa.

Não utilize o rótulo Disponível se a extração estiver bloqueada.

Não crie uma janela independente de configuração de IA para o usuário comum.

A configuração do serviço Gemini é responsabilidade exclusiva da infraestrutura administrativa.

## 11. SECURITY HARDENING — SEC-01 A SEC-10

Simplesmente ocultar o botão Chave API com CSS ou JavaScript não será considerado uma solução aceitável.

Prepare uma distribuição experimental server-only, na qual o leitor direto legado esteja efetivamente ausente dos recursos entregues ao navegador.

### SEC-01 — Remoção do leitor legado da distribuição

Exclua do pacote candidato server-only:

- Funções de extração direta pelo Gemini.
- Adaptadores de provedor pessoal.
- Rotas e módulos legados de extração direta.
- Imports exclusivos do mecanismo legado.
- Dependências desnecessárias associadas à configuração de chaves pessoais.

Identifique dependências compartilhadas antes de remover arquivos.

Não remova nenhuma dependência utilizada por outras funcionalidades do aplicativo.

### SEC-02 — Remoção da configuração pessoal de Chave API

Remova da variante server-only:

- Botão Chave API.
- Modal de configuração pessoal.
- Campos de entrada da chave.
- Rotas de configuração.
- Eventos de ativação da modalidade antiga.
- Rotinas específicas de leitura e armazenamento de chaves pessoais.

Não modifique ou exclua credenciais existentes do usuário nos ambientes oficiais nesta etapa.

Prepare, para a futura atualização oficial, um procedimento localizado e autorizado de retirada dos registros legados, sem limpar indiscriminadamente localStorage, IndexedDB ou outros mecanismos de armazenamento.

Não envie chaves pessoais para o servidor.

Não registre nem divulgue valores de credenciais.

### SEC-03 — Bloqueio de chamadas diretas

A variante server-only não deverá possuir fluxo de extração direta navegador–Gemini.

A arquitetura pretendida será:

Navegador → Intermediário autenticado → Gateway protegido por IAM → Backend interno → Gemini.

Todas as extrações integradas deverão ser admitidas pelo servidor.

Não permita que flags locais ativem a implementação legada.

Não utilize a chave pessoal como fallback automático.

Caso o Smart AI esteja indisponível, informe a indisponibilidade e preserve os créditos.

### SEC-04 — Política CSP

Revise a Content Security Policy da variante candidata.

Remova permissões de conexão direta ao Gemini que sejam exclusivas da implementação legada.

Preserve as origens necessárias às funcionalidades oficiais:

- Autenticação Firebase.
- Sincronização.
- Serviços autorizados.
- Recursos necessários ao PWA.

Não torne a CSP permissiva para resolver falhas de integração.

Não introduza curingas desnecessários.

Não trate CSP como substituição da autorização no servidor.

Não altere a política publicada em produção nesta etapa.

### SEC-05 — Cache e Service Worker

Garanta que a distribuição server-only não faça precache de arquivos legados de extração.

Prepare uma atualização segura do Service Worker que:

- Invalide somente caches pertencentes ao aplicativo e comprovadamente obsoletos.
- Remova recursos legados dos caches afetados.
- Preserve o funcionamento offline.
- Preserve a reconstrução segura da interface.
- Não armazene faturas, sessões, segredos ou respostas sensíveis.
- Não limpe os bancos financeiros.
- Não altere dados financeiros persistentes.
- Não limpe indiscriminadamente caches pertencentes a outros sistemas.

Valide a atualização de uma instalação legada para a variante server-only utilizando perfis e dados sintéticos.

Não modifique os caches oficiais atualmente utilizados pelo Owner.

### SEC-06 — Resistência à manipulação do navegador

Acrescente testes de segurança para verificar:

- Alteração do HTML pelo navegador.
- Alteração de estilos.
- Criação manual de botões.
- Tentativa de reativação por flags.
- Manipulação de localStorage.
- Manipulação de plano e créditos.
- Chamadas diretas aos endpoints.
- Reutilização de eventos legados.
- Tentativa de acesso a arquivos excluídos da distribuição.

O resultado esperado é que nenhuma dessas manipulações permita utilizar o Smart AI Server sem autorização ou reativar um leitor legado ausente do pacote entregue.

Não afirme que é possível impedir usuários de desenvolver ferramentas próprias, utilizar APIs externas ou executar cópias antigas do aplicativo.

O objetivo é proteger a distribuição atual e seus serviços, e não controlar integralmente o navegador do usuário.

### SEC-07 — Autoridade do servidor

Preserve a validação de:

- Token Firebase.
- Assinatura.
- Emissor.
- Audiência.
- UID.
- Validade.
- Revogação, conforme a política.
- Plano comercial.
- Papel administrativo.
- Créditos.
- Reservas.
- Concorrência.
- Limites por usuário.
- Limites globais.
- Suspensão administrativa.
- Suspensão financeira.

Não confie em valores fornecidos pelo frontend para conceder privilégios ou autorizar extrações.

Não implemente credenciais IAM no navegador.

### SEC-08 — Preservação do mecanismo de restauração

Mantenha o leitor legado e a modalidade Chave API preservados no ponto de restauração V34.7.4.5 e no histórico versionado.

Prepare uma variante de recuperação isolada, se necessária aos testes anteriores.

A variante de recuperação não poderá integrar os arquivos servidos pela distribuição server-only.

Não disponibilize o código legado mediante uma simples flag ativável no navegador.

Não destrua a implementação anterior.

Não faça alterações no repositório oficial.

A restauração deverá depender de um procedimento administrativo deliberado, mediante versão ou artefato confiável.

### SEC-09 — Auditoria da distribuição

Inspecione os arquivos finais efetivamente entregues ao navegador, incluindo:

- HTML.
- JavaScript.
- CSS.
- Módulos.
- Chunks.
- Manifestos.
- Service Worker.
- Recursos de precache.
- Source maps, quando existentes.
- Arquivos estáticos.
- Rotas acessíveis.

Comprove que a variante server-only não distribui o leitor antigo, seus módulos executáveis ou mecanismos de configuração pessoal.

Não considere suficiente a ausência visual dos botões.

Não publique arquivos de recuperação como recursos acessíveis da distribuição candidata.

### SEC-10 — Proteção das credenciais do servidor

Preserve a chave Gemini exclusivamente na infraestrutura autorizada.

Utilize o Secret Manager conforme a configuração experimental existente.

Nunca envie ao navegador:

- Chave Gemini do servidor.
- Credenciais de contas de serviço.
- Tokens IAM privilegiados.
- Segredos do backend.
- Credenciais administrativas.

Não revele segredos em logs, relatórios, capturas ou GitHub.

Não rotacione novamente a chave anteriormente corrigida sem necessidade efetivamente demonstrada e autorização correspondente.

## 12. PRESERVAÇÃO DOS BUGS ANTERIORMENTE CORRIGIDOS

BUG-0851-01:

Usuários comuns Free e Premium não deverão visualizar ou acessar controles administrativos.

Admin e Owner com plano Free deverão preservar seus privilégios legítimos.

Plano comercial e papel administrativo são atributos independentes.

BUG-0851-02:

A janela Escanear Fatura com IA deverá fechar corretamente por X, Cancelar e ESC.

Uma revisão pendente deverá receber tratamento de descarte apropriado.

BUG-0851-03:

Na variante server-only, elimine a necessidade de navegação entre modalidades.

Preserve o retorno ao painel, o fechamento da janela e o fluxo completo de extração.

Mantenha os testes anteriores de navegação entre modalidades no mecanismo legado de recuperação, sem distribuí-lo no candidato server-only.

Não reintroduza bloqueios de navegação.

## 13. POLÍTICA COMERCIAL E PROTEÇÕES OPERACIONAIS

Preserve integralmente:

- Dois créditos Free vitalícios.
- Quinze créditos Premium mensais.
- Renovação em America/Bahia.
- Duas tentativas por janela móvel de 60 segundos por UID.
- Uma operação simultânea por UID.
- Limite global de 30 tentativas diárias.
- Limite global de 60 tentativas mensais.
- Limite de arquivo de 10 MiB.
- Reservas transacionais.
- Liquidação após extração válida.
- Restituição em falhas confirmadas.
- Contabilização de tentativas malsucedidas nos limites globais.
- Security Guard.
- Finance Guard.
- Orçamento mensal de R$ 10,00.
- Suspensão financeira aos 75%.
- Auditoria administrativa.
- Reautenticação recente para operações críticas.
- Isolamento por UID.

Não aumente limites sem autorização.

Não conceda eventuais privilégios especiais ao Owner que permitam ignorar os mecanismos financeiros.

## 14. ANÁLISE DAS QUATRO FALHAS LEGADAS DE CACHE

Recupere o relatório raytech-0852-regressao-oficial.txt.

Analise individualmente as quatro falhas anteriormente informadas.

Resultado de referência:

- 47 testes aprovados.
- 4 testes de cache reprovados.

Classifique cada falha como:

A — Expectativa obsoleta.

B — Defeito preexistente.

C — Regressão introduzida pelo candidato.

D — Evidência insuficiente.

Não presuma que todas as falhas são obsoletas apenas porque uma delas referencia a V34.6.3.

Para cada falha, apresente:

- Nome do teste.
- Arquivo e linha.
- Comportamento esperado.
- Comportamento observado.
- Evidência disponível.
- Impacto.
- Classificação.
- Correção aplicada, quando pertinente.

Não enfraqueça os testes para obter aprovação.

Corrija expectativas comprovadamente desatualizadas somente na branch experimental.

Corrija defeitos reais mediante alterações localizadas.

Aproveite essa análise para validar a futura retirada dos recursos de Chave API do cache do PWA.

Não altere a produção e não limpe os caches oficiais do usuário.

## 15. INTERMEDIÁRIO AUTENTICADO E INTEGRAÇÃO REMOTA

Preserve o intermediário autenticado experimental anteriormente desenvolvido.

Mantenha documentadas as pendências de:

- Identidade dedicada de serviço.
- Permissão IAM restrita de invocação.
- Proteção distribuída contra abuso.
- Controle de tráfego.
- Pesquisa administrativa remota.
- Índices e permissões.
- Validação da revogação de tokens.
- Comunicação privada de ponta a ponta.
- Custos incrementais.
- Procedimento emergencial.

Não implante o intermediário remoto nesta etapa.

Não abra acesso público.

Não altere remotamente IAM.

Não faça chamadas reais ao Gemini.

Utilize transportes simulados.

Mantenha o backend e o gateway privados, com extração real desabilitada.

A variante server-only deverá apresentar indisponibilidade segura quando não houver serviço autorizado, sem recorrer automaticamente à Chave API legado.

## 16. INTEGRAÇÃO FINANCEIRA

Prepare o fluxo de revisão utilizando os contratos financeiros existentes.

Valide:

- Compras à vista.
- Compras parceladas.
- Estornos.
- Descontos.
- Créditos.
- Encargos.
- Saldo anterior.
- Pagamentos anteriores.
- Total explícito.
- Reconciliação.

Preserve valores em centavos inteiros.

Não invente lançamentos.

Não altere automaticamente categorias, parcelas ou valores.

Não grave resultados nos três bancos existentes.

Utilize confirmação simulada em ambiente independente.

A futura integração com a persistência financeira definitiva dependerá de autorização específica.

## 17. CENÁRIOS EXPERIMENTAIS DE ACEITAÇÃO

Disponibilize uma entrada experimental separada para permitir a seleção de perfis e cenários, sem modificar a aparência do painel principal.

Prepare:

- Free com dois créditos.
- Free com um crédito.
- Free sem créditos.
- Premium com quinze créditos.
- Premium parcialmente utilizado.
- Premium sem créditos.
- Admin com plano Free.
- Owner com plano Free.
- Smart AI indisponível.
- Suspensão administrativa.
- Suspensão financeira.
- Faturamento indisponível.
- Faturamento observado igual a zero.
- Consumo financeiro de 15%.
- Consumo financeiro de 25%.
- Consumo financeiro de 50%.
- Consumo financeiro de 75%.
- Consumo financeiro de 100%.
- Consumo financeiro de 125%.
- Reativação financeira protegida.

Permita alternar os cenários sem exigir reinicializações manuais desnecessárias.

Não exponha controles fictícios na interface pública futura.

Não utilize perfis ou documentos reais.

## 18. TESTES E REGRESSÕES

Preserve os 117 testes experimentais anteriormente aprovados.

Preserve também a finalidade das suítes oficiais aplicáveis.

Não exclua testes do mecanismo legado apenas porque a nova arquitetura não deverá distribuí-lo.

Separe claramente:

A — Testes do mecanismo de recuperação legado.

B — Testes do candidato server-only.

C — Testes de isolamento e segurança da distribuição.

Acrescente os testes necessários para validar os requisitos UX01 a UX65 e SEC-01 a SEC-10.

Valide especialmente:

- Ausência do botão Chave API na variante server-only.
- Ausência do modal de configuração pessoal.
- Ausência do leitor direto nos arquivos distribuídos.
- Ausência de fallback automático.
- Impossibilidade de reativação mediante flags locais.
- Impossibilidade de contornar créditos pelo navegador.
- Bloqueio de Free e Premium com saldo zero.
- Coerência de disponibilidade.
- Ausência de segredos no frontend.
- CSP restritiva e compatível.
- Atualização segura do PWA.
- Ausência de recursos legados no novo cache.
- Preservação dos bancos existentes.
- Revisão financeira em reais.
- Estornos negativos.
- Total selecionado.
- Reconciliação.
- Identidade visual.
- Sincronização na nuvem.
- Smart Admin.
- Barra financeira.
- Pesquisa administrativa unificada.
- Responsividade desktop e mobile.
- Ausência de chamadas reais ao Gemini.

Execute GitHub Actions, Firestore Emulator, testes de navegador e build Docker quando aplicável.

Não estabeleça quantidade artificial de novos testes como substituição da cobertura.

Não enfraqueça as verificações anteriores.

## 19. VALIDAÇÃO VISUAL OBRIGATÓRIA

Compare o candidato com a V34.7.4.5, utilizando o commit oficial 121cca799aa7072094c668697249214b899e86d5.

Use dimensões equivalentes, perfis fictícios equivalentes e os mesmos estados da interface.

Apresente evidências comparativas de:

1. Login.
2. Cabeçalho.
3. Painel financeiro.
4. Menu Opções.
5. Sincronização na nuvem.
6. Seção Ajuda.
7. Janela original Escanear Fatura com IA.
8. Novo componente informativo Smart AI.
9. Free com créditos.
10. Free sem créditos.
11. Premium.
12. Revisão financeira.
13. Smart Admin.
14. Smart AI Monitor.
15. Detalhes dos usuários.
16. Barra financeira neutra.
17. Barra verde.
18. Barra amarela.
19. Barra laranja.
20. Barra vermelha.
21. Barra crítica acima de 100%.
22. Interface mobile.

As diferenças visuais deverão decorrer exclusivamente das funcionalidades autorizadas.

Não declare equivalência integral sem evidências.

## 20. ENTREGA E RASTREABILIDADE

Realize commits exclusivamente na branch experimental autorizada.

Apresente:

- Commit inicial.
- Commit final.
- Especificação ESP-SMART-AI-0853-001 v2.0.
- Matriz dos requisitos UX01 a UX65.
- Matriz SEC-01 a SEC-10.
- Preservação dos três bugs corrigidos.
- Resultado das quatro falhas legadas de cache.
- Total de testes aprovados.
- GitHub Actions.
- Artefato experimental server-only.
- Evidência de ausência do leitor legado na distribuição.
- Evidências da preservação do mecanismo de recuperação.
- Resultado da inspeção de CSP e Service Worker.
- Evidência da ausência de credenciais no navegador.
- Diferenças visuais autorizadas.
- Pendências remotas efetivamente existentes.

Disponibilize a interface completa isolada para avaliação prática.

Abra diretamente a interface no navegador do Owner, quando possível.

Forneça o endereço local exato, sem exigir PowerShell ou outros comandos manuais desnecessários.

A avaliação deverá ocorrer no aplicativo completo, e não em uma interface independente de laboratório.

## 21. RESTRIÇÕES ABSOLUTAS

Preserve:

- Produção V34.7.4.5.
- Homologação publicada.
- Ponto de restauração V34.7.4.5.
- Três bancos existentes.
- Núcleo financeiro.
- Backup criptografado da Calculadora 3D.
- Domínios próprios e DNS.
- Firebase experimental Spark.
- Security Guard.
- Finance Guard.
- Orçamento mensal de R$ 10,00.
- Suspensão financeira aos 75%.
- Limites comerciais e globais.
- Sincronização oficial.
- Parcelas.
- Despesas fixas.
- Categorias.
- Importação e exportação Excel.
- Backups JSON.
- PWA.
- Funcionamento offline.
- Os 117 testes anteriores.
- Mecanismo legado de Chave API exclusivamente como referência de recuperação, sem alteração da produção atual.

Não realize:

- Chamadas reais ao Gemini.
- Alterações remotas de IAM.
- Exposição pública de serviços.
- Alterações de faturamento.
- Ativação do intermediário remoto.
- Gravações financeiras reais.
- Migrações.
- Exclusão de dados financeiros.
- Alteração das credenciais pessoais existentes nos ambientes oficiais.
- Merge.
- Publicação em homologação.
- Publicação em produção.

Não avance para outra etapa sem autorização específica.

## RESULTADO ESPERADO

Entregar o Raytech CG V35.0 experimental com fidelidade visual à produção V34.7.4.5, Smart AI apresentado como serviço integrado, créditos claramente organizados, proteções comerciais e financeiras preservadas e distribuição candidata server-only sem o mecanismo de leitura direta por Chave API pessoal.

A implementação legada deverá permanecer recuperável exclusivamente por procedimento administrativo deliberado, sem integrar os recursos disponibilizados pelo candidato server-only.

Execute efetivamente as operações autorizadas, sem repetir auditorias ou planejamentos desnecessários.

Priorize a conclusão funcional e visual desta etapa para avançarmos posteriormente à integração remota segura.