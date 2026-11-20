# ESP-SMART-AI-085-001 · Rastreabilidade do candidato

| ID | Implementação e evidência |
|---|---|
| UX01 | Formatação BRL em revisão e painel. Teste de centavos. |
| UX02 | Sinal negativo preservado e legenda de crédito verde. |
| UX03 | Saldo zero substitui disponibilidade por créditos esgotados. |
| UX04 | Estados administrativos, financeiros e de indisponibilidade separados do saldo. |
| UX05 | Controles bloqueados pelos estados operacionais conhecidos. |
| UX06 | Seletor nativo integrado a controle visual com foco. |
| UX07 | Modalidade Chave API independente na prévia. |
| UX08 | Limpeza de mensagens e revisão após descarte e mudança de sessão. |
| UX09 | Adaptador somente leitura. Prévia com categorias sintéticas, ligação ao catálogo real pendente. |
| UX10 | Edição monetária em BRL, conversão inteira e formatação ao sair do campo. |
| UX11 | Total da seleção atualizado imediatamente. |
| UX12 | Totais da extração preservados separadamente da seleção. |
| UX13 | Caixas de seleção compactas. |
| UX14 | Cancelar com estilo secundário, confirmação com estilo primário. |
| UX15 | Reconciliação com texto e destaque visual. |
| UX16 | Campos e cartões compactados. |
| UX17 | Número da parcela, total de parcelas e valor individual preservados. |
| UX18 | Revisão manual com confirmação simulada. |
| UX19 | Busca de perfis sintéticos por nome, e-mail e UID com autorização do servidor. O backend remoto conserva busca por prefixo de UID. |
| UX20 | Cartões de hoje e mês com números compactos. |
| UX21 | Barras de participação Free e Premium nas leituras. |
| UX22 | Barra de utilização orçamentária independente da admissão. |
| UX23 | Limiares de 25, 50, 75 e 100% visíveis. |
| UX24 | Suspensão emergencial usa configuração do Owner, reautenticação e auditoria existentes. |
| UX25 | Suspensão manual e financeira recebem descrições distintas. |
| UX26 | Indicadores em português. |
| UX27 | Contagem de auditoria e histórico de alertas disponíveis. Detalhamento adicional da auditoria pendente. |
| UX28 | Estimativa em BRL separada da observação, simulação e ausência de dados. |
| UX29 | Tema Smart AI reaproveitado. Incorporação ao app completo pendente. |
| UX30 | Lançamentos em uma coluna até 600 px. |
| UX31 | Espaçamento entre ações e controles. |
| UX32 | Menor altura dos controles da revisão. |
| UX33 | Estilo compartilhado com a interface Smart AI experimental. |
| UX34 | Regressão de largura em Chromium e WebKit. |
| UX35 | Cenários desktop, Android e iOS em navegadores de teste. |
| UX36 | Cor e texto por limiar, preenchimento limitado a 100% e valor observado preservado. |

## Verificações complementares

1. O guard rejeita autenticação antiga no servidor. Testes comerciais e de integração usam identidades sintéticas.
2. O contrato Finance Guard e o ensaio Firestore em ambiente isolado cobrem observação válida e nova suspensão. Nenhum evento sintético é enviado ao ledger remoto.
3. O endpoint administrativo verifica papel e reautenticação. O laboratório não confia no estado dos botões.
4. O teste de suspensão confirma dois créditos Free preservados.
5. A ponte testada separa token Firebase e identidade de invocação. O transporte privado é simulado.
6. A ponte restringe tamanho, prazo, rotas, rajadas por processo e solicitações por UID. A proteção distribuída ainda depende do desenho de ingresso.
7. Os testes confirmam totais em centavos, estornos, parcelas e ausência de gravação financeira oficial.

## Intermediário candidato

Mantém a arquitetura de 08.4 descrita no README. Antes de implantação, validar identidade dedicada com permissão de invocação apenas no gateway, verificação de revogação, controle distribuído no ingresso, limites de instâncias e tráfego e uma desativação que preserve o receptor financeiro. Requisições rejeitadas também consomem CPU, conexões e potencialmente logs. Usando as premissas do README, 60 chamadas aceitas de 10 s custariam cerca de US$ 0,0152 brutos para a ponte. Para 1.000 rejeições com duração de 100 ms a ordem de grandeza é US$ 0,0029 brutos, sem franquia, rede ou balanceador. Esses valores são hipóteses, sem previsão de tráfego nem garantia de teto. O limite por processo é suplementar e pode bloquear usuários válidos sob tráfego abusivo.

## Etapa 08.5.1 · aplicativo completo

O endpoint /app/ reutiliza o HTML, estilos, login, renderizadores, navegação, formulários, exportação, categorias do cartão e visualização Smart Admin da árvore oficial do repositório. O servidor disponibiliza apenas arquivos aprovados por lista explícita. Scripts de autenticação, configuração Firebase, nuvem e scripts remotos são excluídos da resposta. A sessão do laboratório e a confirmação de faturas usam memória. Há manifesto e cache PWA locais para recursos estáticos, com escopo /app/. Sessões experimentais e APIs dependem do processo local e as respostas, comprovantes e faturas ficam fora do cache.

Para iniciar o pacote extraído, execute o servidor da integração a partir da raiz. Abra http://127.0.0.1:8784/app/. Em Opções, abra Ler Fatura. O catálogo de leitura reutiliza os identificadores e a apresentação do cartão, com suporte a entradas personalizadas fornecidas pelo catálogo do host. O painel Smart Admin incorpora o Smart Admin AI para perfis administrativos. A modalidade Chave API nesta cópia demonstra o caminho sem receber credencial pessoal. A modalidade oficial permanece preservada.

UX09 reaproveita o catálogo do cartão sem gravar categorias. UX19 usa consulta autorizada no servidor do laboratório, com cursores descartáveis isolados por UID e consulta, limite de dez consultas por janela, minimização e auditoria sem termos brutos. UX27 exibe eventos administrativos observados no laboratório separadamente dos alertas financeiros. UX29 usa a estrutura oficial com as substituições de infraestrutura documentadas acima. Os demais itens UX01–UX36 permanecem sob a matriz 08.5 e as regressões. A busca remota por nome e e-mail ainda requer contrato de consulta e revisão de índices e permissões. Proteção distribuída contra abuso e ensaio remoto navegador–gateway–backend permanecem pendentes. Este candidato não concede IAM e não chama Gemini.
