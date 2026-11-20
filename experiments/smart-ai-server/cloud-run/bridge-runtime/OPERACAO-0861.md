# ESP-SMART-AI-0861-001 · Preparação operacional

## Rastreabilidade

| ID | Candidato e validação |
|---|---|
| REM-01 | Servidor HTTP dedicado, três rotas e métodos fixos, limites e resposta filtrada. Sem proxy genérico. |
| REM-02 | Firebase Admin SDK 14.5.1 com ADC e verificação de revogação. Projeto, UID, emissor e tempos conferidos. Owner e operações críticas passam por auth_time de cinco minutos e revalidação no backend. |
| REM-03 | Identidade dedicada proposta no manifesto. O runtime verifica o e-mail da identidade gerenciada e a audiência do token de gateway. A disponibilidade do ID e as concessões permanecem pendentes de autorização remota. |
| REM-04 | Token Firebase em Authorization e identidade Google em X-Serverless-Authorization. O ingresso IAM do Cloud Run é a fronteira de assinatura do token Google. Testes locais cobrem audiência, identidade, cabeçalhos e recusa simulada do gateway. |
| REM-05 | Dois perfis de exposição futura avaliados abaixo. Candidato interno, IAM obrigatório e flag desabilitada. |
| REM-06 | Proteção local na borda e transações comerciais distribuídas no backend. A autenticação rejeitada não gera gravação Firestore. Controle de tráfego distribuído anterior à autenticação permanece pendente. |
| REM-07 | Reserva, saldo, liquidação, restituição, repetição e concorrência reaproveitam a transação comercial. |
| REM-08 | O backend permanece responsável pelo Finance Guard. O saldo informa estado operacional e não anuncia disponibilidade na ausência de observação vigente. Receptor Pub/Sub independente. |
| REM-09 | Adaptador com origem HTTPS fixada pela configuração confiável, sem flags no navegador. A aplicação experimental continua no transporte local. Nenhuma alteração visual aprovada foi introduzida. |
| REM-10 | MIME, assinatura, tamanho, UUID, estrutura JSON, revisão obrigatória e respostas sem cache. Faturas processadas em memória. |
| REM-11 | Diretório experimental projetado por prefixo de nome, e-mail exato e prefixo de UID. Página de dez, cursor composto, quatro campos da projeção, limite transacional de seis consultas/minuto por operador. |
| REM-12 | CSP proposta abaixo. A CSP local permanece restrita à origem. O inventário PWA só inclui estáticos e o pacote exclui a recuperação legada. |
| REM-13 | Manifesto candidato conservador e estimativas abaixo. Gateway e backend existentes fora do escopo de alterações remotas. |
| REM-14 | Regressões e Firestore Emulator com gateway e Gemini simulados. O browser conserva o percurso com créditos, fatura, revisão e confirmação simulada. |
| REM-15 | Imagens e pacote isolados produzidos pelo CI. Passos de autorização e reversão abaixo. |

As matrizes UX01–UX80 e SEC-01–SEC-10 das etapas 08.5.x continuam como referência da distribuição. Nenhum resultado de IAM ou tráfego remoto é inferido dos mocks.

## Autorização e identidade futuras

| Identidade | Escopo | Permissão candidata |
|---|---|---|
| raytech-smart-ai-bridge | Serviço Cloud Run gateway específico | roles/run.invoker somente no gateway |
| raytech-smart-ai-bridge | Projeto Firebase gen-lang-client-0593667072 | Papel personalizado com firebaseauth.users.get para checagem de usuário desativado/revogado pelo SDK |
| Gateway existente | Serviço backend interno específico | Preservar binding existente. Sem nova concessão neste candidato |
| Backend existente | Firebase experimental | Preservar autorização e identidade da etapa anterior. Revisar uso de datastore.entities.list para a consulta de diretório |
| Operador de implantação | Administrativamente autorizado | Permissões de implantação e actAs restritas, separadas das identidades do aplicativo |

Nenhuma chave JSON de conta de serviço, Secret Manager, papel genérico ou acesso Firestore para a ponte. O e-mail do principal é validado pelo metadata server. A identidade da conta, existência do ID sugerido e permissão mínima real precisam de verificação remota autorizada.

## Entrada HTTPS e CSP

A primeira opção é ensaio interno/IAM com clientes controlados. Preserva ingresso privado e limita a validação a operadores autorizados. Um navegador comum precisará de uma entrada HTTPS alcançável pela internet. A segunda opção, sujeita a autorização, é uma única entrada autenticada na aplicação, mantendo o gateway com IAM e o backend interno. Autorizações Cloud Run e da aplicação são controles distintos. Uma opção com balanceador externo e Cloud Armor pode fornecer controles distribuídos antes de autenticação, mas introduz custos fixos e por tráfego. Precificar e aprovar separadamente a região, política, volume e orçamento. CORS e App Check são controles auxiliares.

CSP candidata para connect-src. Usar self, o endereço HTTPS exato do intermediário aprovado e apenas as origens Firebase observadas no ensaio autorizado, inicialmente identitytoolkit.googleapis.com, securetoken.googleapis.com e firestore.googleapis.com. Autorizar o domínio firebaseapp.com do projeto experimental em frame-src somente se o fluxo de login selecionado o exigir. Preservar worker-src self, políticas de script e demais diretivas oficiais. Não acrescentar origem Gemini. O candidato local continua connect-src self e sem Firebase real.

## Tráfego, diretório e custos

O processo limita operações em 60/minuto e 20/minuto por UID autenticado. Esses limites reiniciam com a instância e são suplementares. Tentativas comerciais mantêm janela móvel de dois/minuto, uma operação simultânea, reservas e tetos de 30/dia e 60/mês em Firestore. O diretório faz até 11 leituras de resultados, mais autorização e contador, e uma gravação por página admitida. A consulta recusada por frequência não percorre o diretório. A projeção candidata tem uid, label, nameKey e emailKey. Índices ascendentes de campo único, com desempate por __name__. Confirmar execução dos índices na fase remota. Uma carga inicial autorizada custaria uma gravação por perfil, seguida de manutenção somente após mudança de identidade. O cursor não concede autorização e a resposta não inclui o e-mail como campo de resultado. Consultas unificadas usam nome por padrão, e-mail completo e prefixo uid: para UID.

Estimativa incremental em us-central1 para o intermediário, 1 vCPU, 512 MiB, min 0, max 1 e concorrência 1. A tarifação bruta por requisição usa US$ 0,000024/vCPU-s, US$ 0,0000025/GiB-s e US$ 0,40 por milhão de requisições. Com 60 chamadas de 10 s, cerca de US$ 0,0152 antes da franquia. Com 10 mil rejeições que alcancem o container por 100 ms, cerca de US$ 0,0293. São exemplos sem conversão cambial e sem rede, partidas a frio, verificações Auth, logs, consultas Firestore, balanceador ou Cloud Armor. A franquia é compartilhada na conta. O orçamento de R$ 10,00 não é limite rígido de cobrança. CPU, memória e latência da ponte ainda exigem medição no ambiente remoto. Não há nova dependência de Secret Manager na ponte. [Cloud Run](https://cloud.google.com/run/pricing) · [Cloud Armor](https://cloud.google.com/armor/pricing) · [Firebase revogação](https://firebase.google.com/docs/auth/admin/manage-sessions)

## Autorização e sequência 08.6.2

1. Autorizar inventário de leitura e confirmar existência da identidade sugerida, políticas IAM, limites, orçamento, estado de gateway/backend e receptor financeiro.
2. Autorizar separadamente o provisionamento interno, identidade, binding específico do gateway, papel Auth mínimo, revisão dos índices, artefato por digest, teste de carga e leitura financeira. Primeiro subir desabilitado, sem acesso público.
3. Após aprovação específica, validar o tráfego privado com identidades experimentais, revogação real e provedor simulado. Medir latência, CPU, memória, rede, cálculos de custo e rejeição de abuso antes de decidir exposição a navegadores.
4. Qualquer ingresso para navegadores, balanceador, Cloud Armor, concessão adicional ou ativação do provedor depende de nova autorização. Não habilitar faturamento do Firebase experimental.

Emergência. Suspender novas admissões pelo controle transacional autorizado no backend. Preservar o receptor financeiro, a liquidação e a restituição, conferir reservas pendentes e desligar a flag da ponte quando apropriado. Reversão. Após drenar solicitações e preservar a observação financeira, retornar a revisão desabilitada da ponte e revogar somente o binding dedicado de invocação se autorizado. Não alterar o receptor Pub/Sub, projetos oficiais ou bancos.
