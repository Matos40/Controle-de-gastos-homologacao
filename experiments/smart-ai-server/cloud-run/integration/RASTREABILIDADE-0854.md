# ESP-SMART-AI-0854-001 · Rastreabilidade da Etapa 08.5.4

Base c699c62b189baee415ae7bfb19ded65213b29dcb. Referência oficial V34.7.4.5 em 121cca799aa7072094c668697249214b899e86d5.

UX01–UX45, UX46–UX65, SEC-01–SEC-10 e BUG-0851-01 a 03 mantêm o histórico e os limites registrados nas matrizes [08.5.2](RASTREABILIDADE-0852.md) e [08.5.3](RASTREABILIDADE-0853.md). Esta etapa modifica somente os pontos abaixo e mantém a recuperação fora do pacote server-only.

| ID | Implementação e evidência |
|---|---|
| BUG-0853-01 | Cenário de saldo antes inicializava somente o uso, enquanto o perfil escolhido separadamente emitia a sessão. A tabela compartilhada agora vincula o cenário ao plano na entrada e no servidor. O teste envia o perfil incompatível de propósito, verifica a sessão e o saldo efetivo e alterna sessões no navegador. |
| UX66 | Saldo e capacidade em tipografia de destaque no card nativo. |
| UX67 | Barra roxa com 6 px, fundo escuro e largura proporcional. Teste confere valor, máximo e altura. |
| UX68 | Consumo exibido como capacidade menos saldo informado pelo servidor. |
| UX69 | Estado operacional no próprio card, separado do saldo. Cores para disponibilidade, esgotamento, bloqueio e verificação. |
| UX70 | Renovação Premium no primeiro dia, derivada do mês comercial America/Bahia no servidor. Free informa validade vitalícia sem renovação automática. |
| UX71 | Fixture Premium parcial usa 13 de 15 créditos e preserva dois disponíveis. |
| UX72 | Quatro cards dentro do Smart AI Monitor existente. |
| UX73 | Grid de duas colunas no desktop. |
| UX74 | Uma coluna no mobile, com verificação de largura. |
| UX75 | Ações com largura proporcional e espaçamento localizado. |
| UX76 | Campos escuros com borda e raio, restritos aos cards. |
| UX77 | Histórico de alertas e auditoria em detalhes expansíveis abaixo do grid. |
| UX78 | Títulos, ícone original de IA, bordas e tipografia reaproveitados. |
| UX79 | Fonte antiga emite indisponibilidade de métricas do monitor legado. No candidato, o monitor integrado já apresenta consumo, proteção e estimativas separadamente, por isso removemos a mensagem genérica duplicada. Testes distinguem zero, indisponível, 75% e 125%. |
| UX80 | Reautenticação, auditoria, limites operacionais e Finance Guard continuam sob decisão do servidor. |

O cenário Nuvem Atenção usa a estrutura oficial do painel e explicita a simulação. Rotas da interface aceitam query strings de navegação, e as rotas de API continuam sem parâmetros de rastreamento. A regressão de PWA passa a usar o inventário 08.5.4 e não remove caches oficiais. As quatro falhas legadas do snapshot oficial não foram reabertas.
