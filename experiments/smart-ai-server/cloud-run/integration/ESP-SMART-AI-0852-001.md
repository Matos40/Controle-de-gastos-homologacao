Execute efetivamente a Etapa 08.5.2 — Smart AI Native Integration da V35.0 do Raytech CG.

O Owner autorizou a correção das falhas identificadas durante os testes práticos e a integração nativa das novas funcionalidades, preservando rigorosamente a aparência e o comportamento da versão de produção V34.7.4.5.

Não solicite novamente autorização para as operações previstas nesta instrução.

## REFERÊNCIAS OPERACIONAIS

- Repositório: Matos40/Controle-de-gastos-homologacao.
- Branch: feature/smart-ai-server-v350-poc.
- Commit inicial: 2f4709885775e5f33e5312ce538d217f3dfb2529.
- GitHub Actions de referência: 44772635656.
- Baseline experimental: 114 testes aprovados.
- Ensaios anteriores com Gemini real: 6/6 aprovados.
- Referência visual obrigatória: produção V34.7.4.5.
- Repositório oficial de referência: Matos40/Controle-de-gastos-2.0.
- Especificação anterior: ESP-SMART-AI-085-001.
- Matriz anterior: RASTREABILIDADE-085.md.
- Projeto Cloud Run: raytech-3d.
- Número: 761761828111.
- Firebase experimental: gen-lang-client-0593667072.

Registre a presente especificação como ESP-SMART-AI-0852-001 e atualize a matriz de rastreabilidade.

## FASE A — DIRETRIZ FUNDAMENTAL DE INTEGRAÇÃO

A V35.0 deverá representar a evolução funcional da V34.7.4.5, e não uma reformulação visual do aplicativo.

Utilize os arquivos, componentes, estilos, fontes, ícones e estruturas existentes na versão oficial aprovada.

Identifique o commit ou artefato correspondente à versão V34.7.4.5 e utilize-o como referência verificável.

Consulte o repositório oficial exclusivamente em leitura.

Preserve as funcionalidades anteriores e incorpore as novas capacidades por meio de alterações localizadas.

Não substitua componentes existentes por versões simplificadas do laboratório.

Não utilize o layout independente do Smart AI experimental como nova identidade visual do Raytech CG.

A regra obrigatória é:

V35.0 = V34.7.4.5 + novas funcionalidades Smart AI.

## FASE B — CORREÇÃO DAS FALHAS IDENTIFICADAS

### BUG-0851-01 — Visibilidade administrativa indevida

Corrija a apresentação do botão Painel administrativo e dos respectivos controles.

Perfis Free e Premium comuns não deverão visualizar controles administrativos.

A exibição deverá depender do papel confiável do usuário:

- Usuário comum Free: sem acesso administrativo.
- Usuário comum Premium: sem acesso administrativo.
- Admin: acesso conforme permissões existentes.
- Owner: acesso conforme permissões existentes.

Plano comercial e papel administrativo são atributos independentes.

Uma conta Owner ou Admin com plano Free continuará tendo seus privilégios administrativos legítimos.

Não utilize o plano Free ou Premium como critério isolado de autorização.

Preserve a validação de autorização no servidor.

Teste tentativas de acesso direto, manipulação do DOM, alteração do armazenamento local e chamadas indevidas aos endpoints.

Ocultar botões não substitui autorização no servidor.

### BUG-0851-02 — Ausência de fechamento da janela

Restaure o mecanismo original de fechamento da janela Escanear Fatura com IA.

Preserve:

- Botão X no canto superior direito.
- Botão Cancelar.
- Fechamento pela tecla ESC, quando compatível com o comportamento aprovado.
- Retorno correto ao painel financeiro.

Evite janelas sobrepostas ou estados que impeçam a navegação.

Se houver uma revisão não confirmada, utilize confirmação de descarte quando necessário.

### BUG-0851-03 — Ausência de retorno entre modalidades

Permita retornar da modalidade Smart AI para a seleção das modalidades ou alternar diretamente para Chave API.

O usuário não deverá precisar atualizar toda a página, encerrar a sessão ou fechar o navegador.

Preserve o estado legítimo dos créditos e das operações admitidas pelo servidor.

Fechar a interface não poderá restituir ou consumir créditos indevidamente.

## FASE C — REQUISITOS UX01 A UX08

Preserve e valide individualmente:

**UX01:** Exibir valores monetários em reais, no padrão brasileiro, mantendo centavos inteiros no processamento interno.

**UX02:** Exibir estornos e créditos negativos em verde, preservando o sinal negativo.

**UX03:** Remover o status Disponível quando os créditos estiverem esgotados.

**UX04:** Corrigir estados de disponibilidade durante suspensão administrativa, financeira, falhas de comunicação e indisponibilidade.

**UX05:** Desabilitar antecipadamente o seletor de arquivos e o botão de extração quando o serviço não puder admitir novas operações.

**UX06:** Preservar e reaproveitar o seletor de arquivos original da produção, sem substituição por um controle HTML visualmente inferior.

**UX07:** Manter Chave API independente da disponibilidade e dos créditos do Smart AI.

**UX08:** Limpar mensagens antigas, resultados obsoletos e estados inconsistentes após confirmação, cancelamento, logout ou troca de modalidade.

Diferencie saldo de créditos, disponibilidade operacional e estado da conexão.

Em nenhuma circunstância apresente informações contraditórias como Disponível e Créditos esgotados simultaneamente.

## FASE D — REQUISITOS UX09 A UX18

Preserve e valide:

**UX09:** Utilizar o catálogo de categorias existente do cartão de crédito, incluindo suporte às categorias personalizadas.

**UX10:** Formatar os campos monetários editáveis em reais, com conversão exata para centavos inteiros.

**UX11:** Exibir em tempo real o total dos lançamentos selecionados.

**UX12:** Preservar separadamente o total original da fatura, o total extraído e os valores da revisão.

**UX13:** Utilizar seletores e caixas de seleção compactos, coerentes com os componentes oficiais.

**UX14:** Diferenciar visualmente as ações de cancelar e confirmar.

**UX15:** Apresentar reconciliação, divergências e informações insuficientes com indicadores claros.

**UX16:** Utilizar cartões compactos sem comprometer a legibilidade.

**UX17:** Preservar valores individuais e informações das compras parceladas.

**UX18:** Exigir revisão manual antes de qualquer confirmação financeira.

Valide o gabarito aprovado:

- Compra à vista: R$ 18,90.
- Compra parcelada 2/3: R$ 25,90.
- Estorno: −R$ 6,25.
- Total original: R$ 38,55.
- Total calculado: R$ 38,55.
- Divergência: R$ 0,00.

Ao desmarcar a compra parcelada, o total selecionado deverá passar para R$ 12,65.

O usuário não deverá visualizar 1890, 2590 ou -625 como valores monetários editáveis.

Não invente lançamentos compensatórios.

Não converta estornos em despesas positivas.

Nesta etapa, mantenha a confirmação financeira exclusivamente simulada.

## FASE E — REQUISITOS UX19 A UX28

Preserve e valide:

**UX19:** Pesquisa administrativa autorizada por nome, e-mail e UID.

**UX20:** Indicadores administrativos compactos, respeitando o design existente.

**UX21:** Gráficos discretos de consumo Free e Premium.

**UX22:** Indicador visual da utilização do orçamento mensal.

**UX23:** Exibição dos níveis financeiros de 25%, 50%, 75% e 100%.

**UX24:** Controle de suspensão emergencial com autorização e auditoria.

**UX25:** Diferenciação entre suspensão administrativa e financeira.

**UX26:** Linguagem clara em português.

**UX27:** Auditoria administrativa detalhada, com identificação do responsável, data, horário, operação, estados anterior e posterior e resultado.

**UX28:** Estimativas financeiras em reais, diferenciadas do faturamento observado, simulado ou indisponível.

Reaproveite o Smart Admin existente.

Não desenvolva um segundo painel administrativo independente.

A pesquisa deverá preservar autorização, paginação, minimização de dados e proteção contra enumeração.

Nesta etapa, utilize somente perfis sintéticos e servidor isolado.

Não altere índices, permissões ou dados dos ambientes remotos.

## FASE F — REQUISITOS UX29 A UX36

Preserve:

**UX29:** Integração harmonizada com a identidade visual oficial.

**UX30:** Uma única coluna de lançamentos no mobile.

**UX31:** Espaçamento adequado entre botões e controles.

**UX32:** Cartões compactos e proporcionais.

**UX33:** Fontes, ícones, cores e bordas coerentes com a produção.

**UX34:** Ausência de cortes e rolagem horizontal indevida.

**UX35:** Responsividade desktop, Android e iOS.

**UX36:** Barra de consumo financeiro fina, discreta, proporcional, arredondada e com cores dinâmicas.

Preserve o comportamento aprovado da barra financeira:

- Abaixo de 25%: verde.
- De 25% até abaixo de 50%: amarelo.
- De 50% até abaixo de 75%: laranja.
- De 75% até abaixo de 100%: vermelho.
- A partir de 100%: vermelho intenso.

A largura visual deverá ser limitada a 100%, mas o percentual textual deverá apresentar o valor observado real, inclusive acima de 100%.

Exiba separadamente:

- Orçamento mensal.
- Faturamento observado.
- Percentual utilizado.
- Nível de atenção.
- Estado operacional.
- Última atualização financeira válida.

Não zere o consumo após reativação.

Não invente faturamento zero quando os dados estiverem indisponíveis.

Não apresente a cor da barra como único indicador de estado.

## FASE G — NOVOS REQUISITOS UX37 A UX45

### UX37 — Janela original de leitura de faturas

Reutilize a janela original Escanear Fatura com IA da V34.7.4.5.

Preserve:

- Título.
- Ícone de inteligência artificial.
- Cores originais.
- Bordas arredondadas.
- Área de upload.
- Botão X.
- Botão Cancelar.
- Botão Extrair Gastos com IA.
- Seleção por toque ou clique.
- Arrastar e soltar arquivos.
- Colagem de imagens por Ctrl + V.

Integre a escolha Smart AI e Chave API de maneira discreta, sem substituir a estrutura aprovada.

### UX38 — Identidade gráfica

Preserve os ícones oficiais e seus respectivos estilos.

Corrija o ícone vazio identificado ao lado do título Escanear Fatura com IA.

Não substitua a iconografia existente por símbolos inconsistentes.

### UX39 — Cabeçalho original

Preserve rigorosamente:

- Logo Raytech CG.
- Tipografia.
- Identificação da versão.
- Nome e foto do usuário.
- Identificação da função administrativa, quando aplicável.
- Seletor de mês.
- Controles de navegação entre meses.
- Ícone de visualização de valores.
- Ícone de sincronização.
- Menu Opções.
- Dimensões, alinhamentos e espaçamentos.

A atualização da identificação para V35.0 deverá ser a única mudança de versão necessária na apresentação.

Não introduza barras externas ou cabeçalhos paralelos.

### UX40 — Smart Admin original

Reutilize integralmente a estrutura visual do Smart Admin aprovado na V34.7.4.5.

Preserve:

- Cabeçalho Smart Admin.
- Identificação Owner ou Admin.
- Indicadores de usuários.
- Contas ativas e bloqueadas.
- Administradores.
- Planos Free e Premium.
- Pesquisa por nome e e-mail.
- Filtros existentes.
- Lista de usuários.
- Identificação visual dos perfis.
- Botão Exibir detalhes.
- Auditoria existente.
- Botão de fechamento.

Não reorganize desnecessariamente esses elementos.

### UX41 — Smart AI Monitor

Incorpore os novos indicadores e controles exclusivamente à seção Smart AI Monitor existente.

Reaproveite seu comportamento expansível.

Integre:

- Extrações Free e Premium.
- Leitura diária e mensal.
- Falhas.
- Reservas pendentes.
- Créditos restituídos.
- Indicadores de consumo.
- Estimativa de custos.
- Barra de proteção financeira.
- Histórico de alertas.
- Suspensão e reativação autorizadas.

Não crie um painel Smart Admin AI concorrente ao Smart Admin existente.

### UX42 — Detalhes dos usuários

Preserve a janela original de detalhes do usuário.

Mantenha a organização de:

- Nome e foto.
- E-mail.
- UID.
- Data de cadastro.
- Último acesso.
- Plano.
- Situação.
- Função.
- Limites de IA.
- Ações administrativas.

Integre as informações de créditos e utilização ao componente Smart AI Usage existente.

Não sobrescreva silenciosamente os limites legados da modalidade Chave API com os limites comerciais do Smart AI.

Diferencie claramente essas políticas.

Preserve a autoridade do servidor sobre créditos, planos e papéis.

### UX43 — Preservação integral da Chave API

O botão Chave API continuará sendo exibido.

Preserve sua localização aprovada, sua configuração e o fluxo existente.

A nova seleção de modalidade na leitura de faturas poderá encaminhar para os componentes existentes, sem criar uma configuração paralela.

Não obrigue o usuário a utilizar o Smart AI.

Não utilize a chave pessoal como fallback automático.

Não remova, substitua ou exponha credenciais pessoais.

A configuração permanecerá simulada nesta avaliação isolada, sem chamadas reais ao Gemini.

### UX44 — Remoção de elementos exclusivos do laboratório

Não apresente na interface candidata à homologação:

- Barra externa Sair do laboratório.
- Botão administrativo externo adicional.
- Controles técnicos exclusivos do laboratório.
- Seletores fictícios de perfis no cabeçalho oficial.
- Identificações ou janelas paralelas desnecessárias.

Os mecanismos necessários à seleção de perfis sintéticos poderão permanecer em uma página de entrada experimental separada.

A interface isolada deverá conservar uma identificação discreta de ambiente experimental, suficiente para evitar confusão com a produção.

Essa identificação não deverá alterar a estrutura visual oficial.

### UX45 — Equivalência visual obrigatória

Garanta equivalência visual entre a produção V34.7.4.5 e a futura versão de homologação V35.0, exceto pelas novas funcionalidades expressamente autorizadas.

Execute comparações visuais utilizando:

- Mesmas dimensões de viewport.
- Mesmas configurações de tema.
- Dados sintéticos equivalentes.
- Mesmos estados da interface.
- Capturas desktop e mobile.

Não utilize dados pessoais ou financeiros reais nas evidências.

Documente as diferenças intencionais.

Corrija diferenças visuais não autorizadas.

Não declare equivalência visual apenas porque os arquivos possuem nomes semelhantes.

## FASE H — SEGURANÇA E POLÍTICA COMERCIAL

Preserve integralmente:

- Security Guard.
- Finance Guard.
- Dois créditos Free vitalícios.
- Quinze créditos Premium mensais.
- Renovação Premium no primeiro dia do mês em America/Bahia.
- Ausência de acumulação.
- Duas tentativas por janela móvel de 60 segundos por UID.
- Uma operação simultânea por UID.
- Limite global de 30 tentativas diárias.
- Limite global de 60 tentativas mensais.
- Arquivos de até 10 MiB.
- Orçamento mensal de R$ 10,00.
- Suspensão financeira preventiva aos 75%.
- Restituição em falhas confirmadas.
- Contabilização das tentativas malsucedidas nos limites globais.
- Reautenticação recente para operações administrativas críticas.
- Auditoria administrativa.
- Isolamento por UID.
- Ausência de lançamento financeiro automático.

Preserve as sete verificações técnicas complementares da Etapa 08.5.

Não enfraqueça controles de segurança para obter fidelidade visual.

Não confunda elementos ocultos na interface com mecanismos efetivos de autorização.

## FASE I — INTEGRAÇÃO REMOTA

Preserve o intermediário autenticado candidato anteriormente desenvolvido.

Mantenha documentadas as pendências:

- Proteção distribuída contra abuso.
- Identidade dedicada de invocação.
- Pesquisa administrativa remota por nome e e-mail.
- Índices e permissões necessários.
- Validação efetiva do caminho navegador–intermediário–gateway–backend.
- Estimativa financeira e controle operacional.

Não provisione recursos adicionais nesta etapa.

Não altere IAM.

Não exponha serviços à internet.

Mantenha Gateway e Backend privados e a extração real desabilitada.

## FASE J — TESTES E REGRESSÕES

Preserve os 114 testes experimentais aprovados e as suítes de regressão aplicáveis do aplicativo oficial.

Acrescente os testes necessários para:

1. Corrigir BUG-0851-01.
2. Corrigir BUG-0851-02.
3. Corrigir BUG-0851-03.
4. Validar os requisitos UX01 a UX45.
5. Validar perfis Free, Premium, Admin e Owner.
6. Validar um Owner com plano Free.
7. Validar ausência de acesso administrativo por usuário comum.
8. Validar fechamento, cancelamento e retorno das modalidades.
9. Validar preservação da janela original de leitura.
10. Validar o botão Chave API existente.
11. Validar a integração ao Smart AI Monitor.
12. Validar a janela original de detalhes do usuário.
13. Validar fidelidade visual do cabeçalho.
14. Validar estados financeiros e comerciais.
15. Validar responsividade desktop, Android e iOS.
16. Validar ausência de gravações nos bancos oficiais.
17. Validar ausência de chamadas reais ao Gemini.
18. Validar o isolamento do PWA e do cache experimental.

Utilize testes visuais comparativos e regressões funcionais.

Execute GitHub Actions, Firestore Emulator, testes de navegador e build Docker quando aplicável.

Não remova nem enfraqueça testes existentes.

Não estabeleça quantidade artificial de testes como substituição da cobertura necessária.

## FASE K — ENTREGA E EVIDÊNCIAS

Realize commits exclusivamente na branch experimental autorizada.

Apresente:

- Commit inicial e final.
- Referência exata da produção V34.7.4.5 utilizada.
- Especificação ESP-SMART-AI-0852-001.
- Matriz dos 45 requisitos.
- Resultado individual dos três bugs.
- Total de testes aprovados.
- GitHub Actions.
- Arquivos criados e modificados.
- Diferenças em relação à versão oficial.
- Evidências de comparação visual.
- Pendências remotas claramente identificadas.
- Artefato experimental isolado.

Disponibilize o aplicativo completo isolado para avaliação prática.

Abra diretamente a interface no navegador do Owner, quando possível.

Forneça o endereço local exato.

Apresente capturas comparativas de:

1. Cabeçalho original e candidato.
2. Janela Escanear Fatura com IA.
3. Modalidade Smart AI.
4. Modalidade Chave API.
5. Revisão financeira.
6. Smart Admin.
7. Smart AI Monitor expandido.
8. Detalhes dos usuários.
9. Barra financeira.
10. Interface desktop e mobile.

Não entregue novamente um laboratório visualmente diferente do aplicativo oficial.

## RESTRIÇÕES ABSOLUTAS

- Preserve a produção V34.7.4.5.
- Preserve a homologação publicada.
- Preserve o ponto de restauração V34.7.4.5.
- Preserve os três bancos existentes.
- Preserve os 114 testes anteriores.
- Preserve as funcionalidades financeiras existentes.
- Preserve a modalidade Chave API.
- Preserve Security Guard e Finance Guard.
- Preserve orçamento de R$ 10,00 e suspensão aos 75%.
- Preserve Firebase experimental Spark.
- Preserve domínios próprios e DNS.
- Preserve o backup criptografado da Calculadora 3D.
- Preserve sincronização, PWA, parcelas, despesas fixas e backups.
- Não utilize dados pessoais ou financeiros reais.
- Não realize chamadas adicionais ao Gemini.
- Não habilite a extração real.
- Não altere IAM remotamente.
- Não habilite faturamento no Firebase experimental.
- Não abra acesso público.
- Não execute migrações.
- Não faça lançamentos financeiros reais.
- Não faça merge.
- Não publique na homologação existente ou produção.

Execute efetivamente as correções e a integração autorizadas.

Evite repetir planejamentos e auditorias concluídas.

O objetivo desta etapa é entregar uma versão experimental completa do Raytech CG V35.0 visualmente equivalente à produção V34.7.4.5, contendo as novas funcionalidades Smart AI integradas de maneira nativa, segura e consistente.