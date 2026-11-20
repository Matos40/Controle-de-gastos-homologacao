# 08.6.3.1 — Diagnóstico privado

`GET /internal/smart-ai/diagnostic` é montado na ponte, no gateway e no backend. A flag `SMART_AI_PRIVATE_DIAGNOSTIC_ENABLED=true` é independente das flags gerais, que devem continuar desabilitadas. O diagnóstico não chama o handler comercial. O receptor `/internal/budget-push` conserva o fluxo e a flag existentes.

## Autenticação

Cada salto usa um token Google para a audiência canônica do destino. A plataforma verifica `X-Serverless-Authorization` e aplica IAM. Como o Cloud Run pode retirar a assinatura desse cabeçalho antes da entrega ao contêiner, o emissor envia uma cópia assinada em `X-Raytech-Diagnostic-Proof`. O processo valida essa cópia com as chaves públicas do Google e verifica emissor, validade, audiência, e-mail verificado e o subject imutável da conta invocadora. Cabeçalhos declarativos de identidade são rejeitados. O token Firebase vai separado em `Authorization` e passa por verificação de assinatura, projeto, validade, bloqueio e revogação nos três processos. O diagnóstico não interpreta o plano nem concede acesso administrativo.

## Janela privada e reversão

| Revisão mínima | Flag de diagnóstico | Principal autorizado no código e no IAM |
|---|---|---|
| Ponte, imagem da ponte aprovada por digest OCI | `true` somente na janela | Cliente aprovado do mesmo projeto. Definir `SMART_AI_DIAGNOSTIC_CLIENT_EMAIL` se for reutilizado e `SMART_AI_DIAGNOSTIC_CALLER_SUB` com o uniqueId confirmado. Conceder `roles/run.invoker` somente na ponte, caso necessário. |
| Gateway, imagem compartilhada aprovada por digest OCI, comando `gateway.mjs` | `true` somente na janela | `raytech-smart-ai-bridge`. Definir `SMART_AI_DIAGNOSTIC_CALLER_SUB` com o uniqueId da ponte. Manter `roles/run.invoker` já concedido à ponte. |
| Backend, mesma imagem OCI compartilhada, comando padrão | `true` somente na janela | `raytech-ai-gateway`. Definir `SMART_AI_DIAGNOSTIC_CALLER_SUB` com o uniqueId do gateway. Preservar o binding separado e a flag ativa de Pub/Sub. |

Pré-requisito: confirmar ingresso interno durante o ensaio para os três serviços, roteamento privado via VPC e Private Google Access, e audiência canônica de cada serviço. A ponte e o backend já possuem concessões de leitura de Auth. A consulta IAM do Firebase experimental encontrou uma dependência adicional no gateway: a identidade `raytech-ai-gateway` precisa de `firebaseauth.users.get` no projeto experimental para verificar bloqueio e revogação. A autorização de introdução do cliente temporário só abrange invocação na ponte e a etapa não concede automaticamente a permissão de Auth a outra identidade. Nenhuma revisão deve receber tráfego de diagnóstico até que esse requisito esteja autorizado e validado.

Ao terminar, restaurar o tráfego às revisões anteriores com diagnóstico e extrações desabilitados, remover somente o binding temporário do cliente e confirmar Pub/Sub e ausência de reservas indevidamente pendentes. Preservar o receptor e os bindings preexistentes. A imagem compartilhada serve ao gateway e ao backend com comandos distintos.

Os testes locais iniciam os três servidores HTTP e usam assinaturas reais com chaves de teste, metadados e Firebase simulados. Eles não comprovam a aplicação da política IAM pelo Cloud Run nem a revogação remota.
