# RAYTECH CG V35.0 SERVER-ONLY
## Etapa 08.5.4 — Smart AI UX Refinement

Execute efetivamente as correções identificadas pelo Owner durante os testes práticos da Etapa 08.5.3.

### 1. Referências

- Repositório: Matos40/Controle-de-gastos-homologacao.
- Branch: feature/smart-ai-server-v350-poc.
- Commit inicial: c699c62b189baee415ae7bfb19ded65213b29dcb.
- GitHub Actions anterior: 44798003610.
- Baseline: 120 testes aprovados.
- Referência visual oficial: V34.7.4.5.
- Commit oficial protegido: 121cca799aa7072094c668697249214b899e86d5.
- Preservar UX01 a UX65 e SEC-01 a SEC-10.
- Implementar UX66 a UX80.
- Corrigir BUG-0853-01.

Não repita auditorias concluídas nem reinicie o desenvolvimento.

### 2. BUG-0853-01 — Inconsistência de plano e créditos

Durante a avaliação prática, o Owner selecionou o cenário Premium sem créditos, mas o aplicativo apresentou 2 de 2 créditos, correspondente ao plano Free.

Investigue a causa efetiva.

Verifique:

- Associação entre perfil e cenário.
- Inicialização das fixtures.
- Plano comercial retornado pelo servidor experimental.
- Saldo de créditos.
- Capacidade máxima.
- Renovação mensal.
- Estado da sessão.
- Atualização do componente Smart AI.
- Possível reutilização de estado de sessões anteriores.

O seletor de cenários deverá impedir combinações incompatíveis ou associar automaticamente o plano correto, deixando essa associação explícita.

Nunca utilize o saldo Free como fallback silencioso para um cenário Premium.

Garanta os seguintes resultados:

| Cenário | Saldo esperado | Extração |
|---|---|---|
| Free completo | 2 de 2 | Disponível |
| Free parcialmente utilizado | 1 de 2 | Disponível |
| Free esgotado | 0 de 2 | Bloqueada |
| Premium completo | 15 de 15 | Disponível |
| Premium parcialmente utilizado | 2 de 15 | Disponível |
| Premium esgotado | 0 de 15 | Bloqueada |

O cenário Premium parcialmente utilizado deverá representar 13 créditos consumidos e 2 restantes.

O cenário Premium esgotado deverá representar 15 créditos consumidos e nenhum restante.

Não corrija apenas a apresentação visual. Garanta coerência entre o servidor simulado, plano comercial, saldo, autorização e interface.

Preserve a autoridade do servidor sobre admissão de extrações.

### 3. UX66 a UX71 — Componente informativo Smart AI

Reorganize o componente dentro da janela original Escanear Fatura com IA.

UX66 — Exibir saldo e capacidade com destaque visual.

Exemplos:

- 2 de 2.
- 1 de 2.
- 0 de 2.
- 15 de 15.
- 2 de 15.
- 0 de 15.

UX67 — Substituir a barra verde retangular atual por uma barra de créditos:

- Roxa.
- Fina, aproximadamente 5 ou 6 pixels.
- Bordas arredondadas.
- Fundo neutro escuro.
- Preenchimento proporcional aos créditos restantes.
- Largura responsiva.
- Sem aparência de elemento HTML nativo não estilizado.

UX68 — Exibir a quantidade de créditos utilizados de forma discreta.

UX69 — Integrar o status operacional dentro do mesmo componente.

Utilize:

- Verde: disponível.
- Amarelo: créditos esgotados.
- Vermelho: suspensão ou bloqueio operacional.
- Cinza: verificando disponibilidade ou sem informação válida.

O status não deverá depender exclusivamente da quantidade de créditos.

UX70 — Exibir a próxima renovação exclusivamente para usuários Premium, calculada dinamicamente conforme America/Bahia.

Para Free, informar discretamente que os créditos são vitalícios e não possuem renovação automática.

UX71 — Configurar o cenário Premium parcialmente utilizado com exatamente 2 de 15 créditos restantes.

### 4. Layout definitivo da janela Smart AI

Preserve a janela original da V34.7.4.5.

Dentro dela, apresente um card compacto contendo:

- Ícone Smart AI.
- Título Smart AI.
- Plano Free ou Premium.
- Créditos disponíveis em destaque.
- Barra roxa de créditos restantes.
- Quantidade de créditos utilizados.
- Estado operacional.
- Informação de renovação quando aplicável.

Substitua a apresentação textual aglutinada atualmente existente, como Créditos Free 2 de 2.

Reduza a descrição do serviço para uma informação secundária e discreta.

Preserve:

- Botão X.
- Área original de upload.
- Seleção de PDF e imagens.
- Arrastar e soltar.
- Colagem de imagens.
- Cancelar.
- Extrair Gastos com IA.

Mantenha Atualizar saldo como ação secundária compacta.

Exiba Conhecer o Premium somente quando comercialmente pertinente.

Não transforme Smart AI em botão de navegação.

Não reintroduza:

- Chave API pessoal.
- Configuração de chave Gemini.
- Seletor de modalidades.
- Leitor legado no frontend.
- Fallback automático.

### 5. UX72 a UX80 — Smart AI Monitor compacto

Reorganize a seção administrativa de proteção financeira e configuração operacional em quatro cards.

Utilize duas colunas no desktop e uma coluna no mobile.

Não modifique o painel Smart Admin original fora das áreas autorizadas.

#### Card 1 — Proteção financeira

Apresente:

- Orçamento mensal de R$ 10,00.
- Faturamento observado ou simulado.
- Percentual utilizado.
- Barra financeira.
- Nível de atenção.
- Última atualização.
- Estado operacional.

Preserve a barra fina e arredondada.

Cores obrigatórias:

- Abaixo de 25%: verde.
- De 25% até abaixo de 50%: amarelo.
- De 50% até abaixo de 75%: laranja.
- De 75% até abaixo de 100%: vermelho.
- A partir de 100%: vermelho intenso.

Quando não houver informação financeira válida, apresente barra neutra e valores indisponíveis.

Quando o consumo confirmado for zero, apresente R$ 0,00 e 0%.

O percentual textual deverá representar o valor efetivo, inclusive acima de 100%.

A largura visual deverá ser limitada a 100%.

#### Card 2 — Limites operacionais

Apresente de maneira compacta:

- Limite diário: 30.
- Limite mensal: 60.
- Identificação UTC.
- Botão Salvar configuração.

Quando houver espaço suficiente, organize os dois campos lado a lado.

Utilize campos escuros com bordas, cantos arredondados e estilos oficiais.

Não utilize os atuais campos cinza retangulares.

O botão Salvar configuração deverá ter largura proporcional ao conteúdo no desktop.

Preserve autorização, validação e auditoria das alterações.

Não aumente os limites aprovados.

#### Card 3 — Estimativa de custos

Apresente:

- Campo de valor estimado por tentativa.
- Estimativa diária.
- Estimativa mensal.
- Informação de que os valores não representam faturamento real.

Calcule as estimativas conforme os limites configurados.

Utilize formatação monetária brasileira.

Quando não houver valor informado, apresente traço ou orientação adequada, sem inventar estimativas.

Não misture estimativas com faturamento observado.

#### Card 4 — Controle do serviço

Apresente:

- Estado operacional atual.
- Aceitar novas leituras de IA.
- Suspender novas leituras.
- Reativar serviço, quando autorizado e aplicável.
- Informação discreta sobre reautenticação.

Utilize vermelho para ações críticas.

Mantenha os botões compactos.

Preserve a distinção entre solicitação administrativa de funcionamento e disponibilidade efetiva.

Uma caixa marcada não poderá indicar disponibilidade quando existir suspensão financeira ou outro bloqueio válido.

Não permita contornar o Finance Guard.

#### Histórico e auditoria

Organize o histórico de alertas e a auditoria em seções expansíveis abaixo dos quatro cards.

Mantenha recolhidos por padrão quando apropriado.

Preserve todos os registros, controles de acesso e informações anteriores.

Não exclua dados de auditoria para reduzir espaço visual.

### 6. Requisitos consolidados de layout

UX72 — Organizar os controles em quatro cards funcionais.

UX73 — Utilizar duas colunas no desktop.

UX74 — Utilizar uma coluna no mobile.

UX75 — Reduzir o tamanho e a largura excessiva dos botões.

UX76 — Padronizar os campos conforme o estilo escuro oficial.

UX77 — Manter histórico e auditoria expansíveis.

UX78 — Padronizar títulos, ícones, bordas, tipografia e espaçamentos.

UX79 — Eliminar informações redundantes ou contraditórias.

UX80 — Preservar todos os mecanismos de autorização e proteção financeira.

Utilize preferencialmente CSS Grid responsivo e as classes oficiais existentes.

Evite alterações CSS globais.

Garanta ausência de cortes e rolagem horizontal indevida.

### 7. Coerência das informações financeiras

Durante o teste prático, foi observada simultaneamente a informação:

Faturamento simulado: R$ 0,00 — 0%.

E no rodapé:

Consumo e orçamento indisponíveis.

Investigue a origem de ambas as mensagens.

Caso representem a mesma informação, elimine a contradição.

Caso representem fontes ou métricas diferentes, identifique-as explicitamente, evitando interpretação incorreta.

Diferencie:

- Faturamento observado.
- Faturamento simulado.
- Estimativas.
- Consumo de créditos.
- Limites operacionais.
- Ausência de observação financeira.

Não apresente informação financeira fictícia como real.

### 8. Cenários experimentais

Preserve o seletor de cenários existente na entrada isolada do aplicativo.

Corrija a associação entre cenários e perfis.

Disponibilize:

- Free 2 de 2.
- Free 1 de 2.
- Free 0 de 2.
- Premium 15 de 15.
- Premium 2 de 15.
- Premium 0 de 15.
- Serviço indisponível.
- Suspensão administrativa.
- Suspensão financeira.
- Reativação protegida.
- Faturamento indisponível.
- Faturamento observado igual a zero.
- Consumo de 15%.
- Consumo de 25%.
- Consumo de 50%.
- Consumo de 75%.
- Consumo de 100%.
- Consumo de 125%.
- Sincronização no estado Atenção.

Não exponha os seletores experimentais na futura distribuição pública.

Utilize apenas perfis e dados fictícios.

### 9. Segurança e distribuição server-only

Preserve SEC-01 a SEC-10.

Confirme que as alterações não reintroduzem:

- Leitor Gemini direto no navegador.
- Botão Chave API.
- Modal de configuração pessoal.
- Módulos legados no pacote público.
- Credenciais no frontend.
- Fallback automático.
- Recursos legados no precache.
- Possibilidade de obter créditos mediante manipulação local.

Preserve o mecanismo de recuperação exclusivamente fora da distribuição server-only.

Não modifique o ponto de restauração V34.7.4.5.

### 10. Validação automatizada

Preserve os 120 testes anteriores e sua finalidade.

Acrescente regressões específicas para:

- BUG-0853-01.
- Associação correta entre cenário e plano.
- Premium parcialmente utilizado com 2 de 15.
- Premium esgotado com 0 de 15.
- Bloqueio efetivo de extração.
- Atualização dos créditos ao trocar de sessão.
- Cálculo e apresentação da renovação.
- Proporção da barra de créditos.
- Layout dos quatro cards.
- Responsividade.
- Estilos dos campos administrativos.
- Coerência do faturamento.
- Estados financeiros de zero e indisponibilidade.
- Preservação das proteções existentes.
- Ausência do leitor legado na distribuição.

Execute as suítes necessárias e o GitHub Actions.

Não enfraqueça testes anteriores.

Não repita chamadas reais ao Gemini.

Não reabra a investigação das quatro falhas legadas de cache sem uma nova evidência de regressão.

### 11. Entrega

Realize commit exclusivamente na branch experimental autorizada.

Registre:

- ESP-SMART-AI-0854-001.
- Matriz UX01 a UX80.
- Preservação SEC-01 a SEC-10.
- Correção BUG-0853-01.
- Commit inicial e final.
- Resultado dos testes.
- GitHub Actions.
- Artefato experimental.

Apresente capturas de:

1. Free 2 de 2.
2. Free 1 de 2.
3. Free 0 de 2.
4. Premium 15 de 15.
5. Premium 2 de 15.
6. Premium 0 de 15.
7. Smart AI Monitor em duas colunas.
8. Smart AI Monitor em uma coluna mobile.
9. Proteção financeira sem observação.
10. Proteção financeira com consumo de 75%.
11. Proteção financeira com consumo de 125%.
12. Sincronização na nuvem no estado Atenção.

Disponibilize a interface completa atualizada em:

http://127.0.0.1:8784/app/

Valide que a rota responde HTTP 200.

Evite recorrência do erro NOT_FOUND, inclusive com parâmetros de rastreamento legítimos no endereço da interface, sem flexibilizar o roteamento ou a autorização dos endpoints de API.

Abra diretamente o aplicativo atualizado no navegador do Owner.

Não exija comandos PowerShell ou procedimentos manuais desnecessários.

### 12. Restrições absolutas

Preserve:

- Produção V34.7.4.5.
- Homologação publicada.
- Três bancos existentes.
- Núcleo financeiro.
- Backup criptografado.
- Domínios e DNS.
- Firebase Spark.
- Security Guard.
- Finance Guard.
- Orçamento mensal de R$ 10,00.
- Suspensão preventiva aos 75%.
- Limites comerciais.
- Identidade visual oficial.
- PWA.
- Funcionamento offline.
- 120 testes anteriores.
- Mecanismo legado de recuperação.

Não realize:

- Chamadas reais ao Gemini.
- Alterações remotas de IAM.
- Exposição pública de serviços.
- Alterações de faturamento.
- Ativação da integração remota.
- Lançamentos financeiros reais.
- Migrações.
- Merge.
- Publicação em homologação.
- Publicação em produção.

Mantenha a extração e a confirmação simuladas.

Execute efetivamente as correções autorizadas e disponibilize imediatamente o novo candidato local para avaliação prática, sem repetir planejamentos ou auditorias desnecessárias.