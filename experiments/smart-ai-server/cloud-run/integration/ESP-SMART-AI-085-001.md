Execute efetivamente a Etapa 08.5 — Smart AI Final Integration da V35.0 do Raytech CG.

O Owner aprovou os testes práticos do laboratório experimental e autorizou o prosseguimento com as melhorias consolidadas.

Não repita o planejamento nem as auditorias anteriormente concluídas.

## Referências operacionais

- Repositório: Matos40/Controle-de-gastos-homologacao.
- Branch: feature/smart-ai-server-v350-poc.
- Commit inicial: 0e317dafd19c8fbe4c3896457d33507bc905aeb2.
- GitHub Actions de referência: 44756360980.
- Baseline: 103 testes aprovados.
- Ensaios anteriores com Gemini real: 6/6 aprovados.
- Projeto Cloud Run: raytech-3d.
- Número: 761761828111.
- Firebase experimental: gen-lang-client-0593667072.
- Orçamento mensal: R$ 10,00.
- Suspensão financeira preventiva: 75%.
- Ponto de restauração: V34.7.4.5.

Registre esta especificação no GitHub como ESP-SMART-AI-085-001, mantendo a rastreabilidade individual dos requisitos UX01 a UX36.

## Fase A — Smart AI: funcionamento e apresentação

Implemente obrigatoriamente:

**UX01:** Exibir todos os valores monetários em reais, com formatação brasileira. Exemplo: 1890 centavos devem ser apresentados como R$ 18,90. Manter centavos inteiros exclusivamente no processamento interno.

**UX02:** Destacar estornos e créditos negativos em verde, preservando o sinal negativo e sua natureza financeira.

**UX03:** Remover o status contraditório "Disponível" quando os créditos estiverem esgotados. Apresentar "Créditos esgotados".

**UX04:** Corrigir a disponibilidade quando o serviço estiver suspenso ou indisponível. Diferenciar saldo comercial da disponibilidade operacional.

**UX05:** Desabilitar o seletor de arquivos e o botão Ler fatura durante suspensões administrativas, financeiras ou indisponibilidade conhecida.

**UX06:** Modernizar o seletor de arquivos, harmonizando-o com o design existente do Raytech CG.

**UX07:** Manter a modalidade Chave API acessível independentemente da suspensão ou esgotamento de créditos do Smart AI.

**UX08:** Limpar mensagens antigas de leitura concluída e estados obsoletos após confirmação, cancelamento, logout ou troca de modalidade.

A interface deverá apresentar estados coerentes:

- Disponível.
- Créditos esgotados.
- Processando.
- Temporariamente suspenso.
- Serviço indisponível.
- Sem conexão.

Nunca apresente disponibilidade quando a operação não puder ser realizada.

Preserve os créditos durante suspensões e mantenha acessíveis os resultados anteriores que ainda estejam legitimamente em revisão.

## Fase B — Revisão financeira

Implemente:

**UX09:** Utilizar as categorias existentes do aplicativo mediante adaptador somente de leitura nesta etapa.

**UX10:** Formatar automaticamente os campos monetários em reais, incluindo edição de valores positivos e negativos, sem erros de arredondamento.

**UX11:** Exibir em tempo real o total dos lançamentos selecionados.

**UX12:** Preservar separadamente o total original informado na fatura e o total calculado.

**UX13:** Modernizar e reduzir as dimensões das caixas de seleção.

**UX14:** Diferenciar visualmente os botões Cancelar e Confirmar.

**UX15:** Destacar visualmente os estados de reconciliação e eventuais divergências.

**UX16:** Compactar os cartões de lançamentos para melhorar o aproveitamento da tela.

**UX17:** Preservar a identificação correta de parcelas, valor individual, parcela atual e quantidade total.

**UX18:** Manter a revisão manual obrigatória antes de qualquer confirmação financeira.

O usuário nunca deverá precisar converter centavos mentalmente.

Exemplo obrigatório:

- Compra à vista: R$ 18,90.
- Compra parcelada 2/3: R$ 25,90.
- Estorno: −R$ 6,25.
- Total original: R$ 38,55.
- Total calculado: R$ 38,55.
- Divergência: R$ 0,00.

Ao desmarcar a compra parcelada, o total selecionado deverá mudar para R$ 12,65, sem modificar o total original da fatura.

Caso algum lançamento seja editado, preserve o resultado original da extração e recalcule os totais da revisão separadamente.

Não invente lançamentos para ajustar divergências.

Não converta estornos em despesas positivas.

Não grave informações nos bancos oficiais.

## Fase C — Smart Admin AI

Implemente:

**UX19:** Permitir pesquisa por nome, e-mail e UID, exclusivamente para perfis administrativos autorizados.

**UX20:** Modernizar os indicadores administrativos em cartões compactos e organizados.

**UX21:** Exibir gráficos discretos de consumo Free e Premium.

**UX22:** Exibir indicador visual da utilização do orçamento mensal.

**UX23:** Apresentar os níveis de alerta financeiro de 25%, 50%, 75% e 100%.

**UX24:** Adicionar botão de suspensão emergencial de novas leituras, protegido por autorização e auditoria.

**UX25:** Diferenciar suspensão administrativa manual de suspensão financeira automática.

**UX26:** Simplificar a linguagem dos indicadores técnicos.

**UX27:** Melhorar a apresentação da auditoria administrativa e do histórico de alertas financeiros.

**UX28:** Apresentar estimativas financeiras em reais, distinguindo claramente estimativa, faturamento observado, faturamento simulado e dados ainda indisponíveis.

Não exiba informações administrativas para usuários comuns.

Não transforme a pesquisa de usuários em mecanismo de exposição de dados pessoais.

Preserve a autoridade do servidor sobre créditos, papéis, permissões e configurações.

## Fase D — Identidade visual e responsividade

Implemente:

**UX29:** Harmonizar a interface Smart AI com a identidade visual existente do Raytech CG oficial.

**UX30:** Manter os lançamentos organizados em uma única coluna no mobile.

**UX31:** Adicionar espaçamento adequado entre botões e elementos interativos.

**UX32:** Reduzir alturas excessivas dos cartões.

**UX33:** Padronizar fontes, ícones, cores, bordas e espaçamentos conforme o aplicativo existente.

**UX34:** Eliminar cortes de conteúdo e rolagem horizontal indevida.

**UX35:** Preservar responsividade no computador, Android e iOS.

Reaproveite as referências visuais existentes do Raytech CG.

Não redesenhe desnecessariamente o painel financeiro principal.

O laboratório deverá deixar de apresentar aparência excessivamente técnica ou de formulário HTML básico.

## Fase E — UX36: barra inteligente de consumo do orçamento

Implemente uma barra horizontal discreta, elegante e responsiva para apresentar a utilização financeira mensal do Smart AI.

Exiba:

- Orçamento mensal.
- Faturamento observado.
- Percentual utilizado.
- Estado financeiro.
- Data e horário da última atualização válida.

A barra deverá ser fina, com bordas arredondadas, fundo neutro e preenchimento proporcional ao consumo.

Todo o preenchimento deverá assumir a cor correspondente ao nível de atenção atual:

- Abaixo de 25%: verde — Normal.
- De 25% até abaixo de 50%: amarelo — Atenção.
- De 50% até abaixo de 75%: laranja — Alerta.
- De 75% até abaixo de 100%: vermelho — Limite preventivo atingido.
- A partir de 100%: vermelho intenso — Crítico.

Utilize os limites aprovados:

- R$ 2,50: 25%.
- R$ 5,00: 50%.
- R$ 7,50: 75%.
- R$ 10,00: 100%.

A barra deverá permanecer visualmente limitada a 100% de largura, mas o percentual textual deverá representar o consumo real, inclusive acima de 100%.

Não utilize cores como único indicador. Apresente também o estado textual.

Não confunda a cor de utilização do orçamento com o estado operacional da suspensão.

Caso o Owner reative o serviço mediante autorização legítima, preserve o nível de atenção correspondente ao faturamento observado e informe separadamente que o serviço foi reativado.

Não zere o consumo após reativação.

Se não houver observação financeira válida, apresente "Aguardando atualização do faturamento", sem inventar consumo zero.

Diferencie simulação de faturamento real.

Não apresente o orçamento como teto garantido de cobrança.

## Fase F — Verificações complementares de segurança

Execute as sete verificações consolidadas:

1. Rejeição de alterações críticas após expiração da janela de autenticação de cinco minutos.
2. Nova suspensão após evento financeiro autêntico válido que atinja ou ultrapasse o limiar, conforme a política aprovada.
3. Impossibilidade de contornar o Finance Guard mediante manipulação do navegador.
4. Preservação dos créditos durante suspensões.
5. Comunicação autenticada segura entre navegador e infraestrutura privada, dentro do ambiente isolado.
6. Proteção contra abuso de requisições.
7. Compatibilidade segura com os contratos do núcleo financeiro existente, sem gravações reais.

Utilize relógio controlável e eventos sintéticos isolados para os testes.

Não gere despesas artificiais.

Não envie eventos sintéticos ao ledger financeiro operacional.

Não utilize faturas ou informações pessoais reais.

## Fase G — Intermediário autenticado

Evolua o candidato cloud-bridge.mjs para uma solução experimental tecnicamente verificável.

Arquitetura pretendida:

Navegador Raytech CG → Intermediário autenticado → Gateway privado → Backend interno → Gemini.

O intermediário deverá:

- Validar tokens Firebase.
- Validar assinatura, emissor, audiência, UID, validade e revogação.
- Separar a identidade do usuário da identidade IAM do serviço.
- Utilizar identidade dedicada com permissão restrita de invocação do gateway.
- Aplicar limites de tamanho, frequência e tempo de requisição.
- Restringir rotas e métodos HTTP.
- Validar origens autorizadas, sem tratar CORS como mecanismo de autenticação.
- Proteger contra requisições anônimas, inválidas e abusivas.
- Evitar armazenamento persistente de faturas.
- Desabilitar cache de respostas sensíveis.
- Impedir exposição de tokens, documentos e segredos nos logs.
- Preservar o Security Guard e o Finance Guard.
- Manter credenciais privilegiadas exclusivamente no servidor.

Implemente e valide o intermediário em ambiente isolado, utilizando transportes simulados.

Apresente a arquitetura candidata de implantação, os recursos necessários, permissões IAM, controles contra abuso, procedimento emergencial e custos incrementais.

Considere também o custo de requisições rejeitadas antes da autenticação.

Não implante ou exponha o intermediário à internet nesta etapa.

Não abra acesso público ao gateway ou backend.

Não altere remotamente IAM, faturamento ou infraestrutura sem autorização específica.

## Fase H — Integração com a interface existente

Priorize a incorporação dos componentes Smart AI à estrutura visual verdadeira do Raytech CG, utilizando pontos de integração experimentais e feature flags.

Preserve integralmente:

- Modalidade Chave API.
- Login e gerenciamento de usuários existentes.
- Smart Admin existente.
- Núcleo financeiro.
- Sincronização.
- Armazenamento local.
- Parcelas e despesas fixas.
- Importação e exportação Excel.
- Backups JSON.
- PWA.
- Três bancos existentes.

Prepare uma versão isolada da interface completa do aplicativo para avaliação prática.

Utilize exclusivamente identidades, dados e adaptadores experimentais.

Não conecte o ambiente de teste aos bancos reais.

Não faça lançamentos financeiros automáticos.

Não publique na homologação existente ou produção.

## Fase I — Testes e critérios de aceitação

Preserve os 103 testes anteriormente aprovados.

Acrescente testes necessários para cobrir os 36 requisitos UX01 a UX36 e as sete verificações técnicas complementares.

Não enfraqueça testes existentes nem estabeleça contagem artificial como substituição da cobertura funcional.

Valide especialmente:

- Formatação correta de reais e centavos.
- Edição de valores monetários negativos.
- Recalcular seleção e preservar o total original.
- Estados de disponibilidade contraditórios.
- Bloqueio antecipado durante suspensão.
- Independência da Chave API.
- Limpeza de mensagens obsoletas.
- Pesquisa administrativa autorizada.
- Gráficos e indicadores.
- Barra financeira em todos os limiares.
- Exibição de percentual superior a 100%.
- Faturamento indisponível sem valor fictício.
- Reativação sem zerar despesas observadas.
- Nova suspensão financeira.
- Expiração de autenticação administrativa.
- Responsividade desktop e mobile.
- Proteção contra acesso indevido.
- Ausência de gravação nos bancos oficiais.
- Ausência de chamadas reais ao Gemini.

Execute regressões, Firestore Emulator, testes de interface desktop e mobile, GitHub Actions e build Docker quando aplicável.

## Fase J — Entrega e evidências

Realize commits exclusivamente na branch experimental.

Registre no GitHub:

- Especificação ESP-SMART-AI-085-001.
- Matriz de rastreabilidade dos 36 requisitos.
- Resultado individual das sete verificações complementares.
- Arquivos criados e modificados.
- Total de testes aprovados.
- Commit final.
- GitHub Actions.
- Capturas da interface aprimorada desktop e mobile.
- Evidências da barra financeira nos diferentes níveis de atenção.
- Arquitetura e custos do intermediário autenticado.
- Limitações ou dependências remanescentes.

Disponibilize o ambiente experimental local e o artefato para avaliação prática do Owner.

Sempre que possível, abra diretamente a versão experimental no navegador do usuário.

Não obrigue o usuário a executar comandos manuais desnecessários.

## Restrições absolutas

- Preserve os 103 testes anteriores.
- Preserve produção e homologação publicada.
- Preserve os três bancos existentes.
- Preserve a modalidade Chave API.
- Preserve Security Guard e Finance Guard.
- Preserve dois créditos Free vitalícios.
- Preserve quinze créditos Premium mensais.
- Preserve os limites comerciais e globais aprovados.
- Preserve orçamento de R$ 10,00 e suspensão aos 75%.
- Preserve Firebase experimental Spark.
- Preserve domínios próprios e DNS.
- Preserve o backup criptografado da Calculadora 3D.
- Preserve o ponto de restauração V34.7.4.5.
- Mantenha o Gemini real desabilitado.
- Não realize chamadas adicionais ao Gemini.
- Não utilize dados financeiros reais.
- Não abra acesso público.
- Não habilite faturamento no Firebase experimental.
- Não faça lançamentos reais.
- Não faça merge.
- Não publique o aplicativo oficial.

Execute efetivamente a implementação autorizada.

Se alguma funcionalidade exigir autorização adicional para implantação remota ou acesso público, mantenha essa funcionalidade isolada e prossiga com as demais.

Não omita nenhum dos 36 requisitos de melhoria.

Ao concluir, disponibilize a interface aprimorada para avaliação prática e apresente objetivamente as condições necessárias para avançarmos à integração remota definitiva.