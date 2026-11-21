# 08.6.4.3 — Montagem local candidata do canal privado de controle

Base: `77134b7b1908c04be12f5002d28f6d8895d8cab0`. Somente código local experimental na branch `feature/smart-ai-server-v350-poc`.

## Artefatos implementados

- `trial-control-runtime.mjs`: entrada HTTP **separada** dos serviços comerciais, sem roteamento de faturas, créditos, Gemini, admin ou Pub/Sub. A flag `SMART_AI_TRIAL_CONTROL_ENABLED` inicia desabilitada. Quando habilitada, exige configuração íntegra e rejeita emuladores, arquivos de credenciais e projetos diferentes dos experimentais aprovados. Aceita somente `POST /internal/smart-ai/trial-control`. O Cloud Run deve impor IAM e ingresso privado em eventual ensaio autorizado.
- `trial-control-channel.mjs` e `trial-readiness.mjs`: mantêm a leitura/CAS transacional, fases estritas, autorização única, bloqueio persistente, reconciliação pelo UUID original e restauração após prazo absoluto. O serviço de controle é o único componente com acesso à coleção separada `raytechLabTrialControlV350`. Não há nova rota nos serviços publicados.
- `trial-job-binding.mjs`: somente constrói um cliente job após corresponder `CLOUD_RUN_EXECUTION` e `CLOUD_RUN_JOB` a um registro previamente aprovado pelo controlador, exigir verificação independente desse registro e verificar identidade efetiva pela API de metadados da conta dedicada. O token de identidade com audiência correta é gerado pelo metadata service. **Variáveis de ambiente enviadas pelo próprio job não provam a execução**: o ensaio remoto deverá demonstrar aprovação independente com a descrição da execução consultada pelo controlador no Cloud Run.
- `trial-control-runtime.test.mjs`: valida desligamento padrão, isolamento das rotas, recusa de configuração inconsistente e associação local entre manifesto autorizado, execução e principal. Todos os resultados são sintéticos.

## Identidades e rede para eventual ensaio remoto

O controlador deve obter `executionId`, job, identidade dedicada e o `subject` imutável de fontes administrativas confiáveis, verificar que o principal do job **não é compartilhado** com outras execuções e fixar o registro de autorização. O canal valida a assinatura Google (RS256), emissor, audiência, expiração, email verificado e subject e confia na autorização IAM do Cloud Run como uma barreira adicional.

Em execução remota futura: prover identidade exclusiva para o serviço de controle, controlador e **uma identidade de job usada só naquela execução**; `roles/run.invoker` exclusivamente no serviço de controle; acesso Firestore apenas ao serviço de controle; nenhum Firestore para o job. O Firestore IAM para processos de servidor geralmente não impõe acesso por coleção: validar o alcance efetivo antes de conceder o papel e isolar permissões usando um ambiente experimental separado, se o menor privilégio não for demonstrável. Não ampliar IAM automaticamente.

O serviço somente pode ser ativado numa janela privada, com explicitamente configurados:
`SMART_AI_TRIAL_CONTROL_ENABLED`, `FIREBASE_PROJECT_ID`, `GOOGLE_CLOUD_PROJECT`,
`SMART_AI_TRIAL_CONTROL_AUDIENCE`, `SMART_AI_TRIAL_CONTROL_IDENTITY`,
`SMART_AI_TRIAL_CONTROLLER_EMAIL`, `SMART_AI_TRIAL_CONTROLLER_SUB`,
`SMART_AI_TRIAL_JOB_EMAIL`, `SMART_AI_TRIAL_JOB_SUB`,
`SMART_AI_TRIAL_EXECUTION_ID`, `SMART_AI_TRIAL_ABSOLUTE_DEADLINE`,
`SMART_AI_TRIAL_FIRESTORE_PROJECT`, `SMART_AI_TRIAL_RUN_ID`, `SMART_AI_TRIAL_REQUEST_ID`.
Não definir essa flag em nenhuma revisão atual.

## Menor ensaio remoto posterior (não autorizado nesta etapa)

1. Confirmar CI local e estado anterior de tráfego, ingresso, IAM, Firestore, Finance Guard e Pub/Sub. Não modificar serviços comerciais.
2. Provisionar uma única instância privada **experimental** do controle e identidades estritamente limitadas; não expor o endpoint publicamente. Confirmar principal e execução usando consulta independente ao Cloud Run. Se não for possível comprovar o vínculo exclusivo, abortar.
3. Com documentos fictícios e **sem Gemini**, permitir somente uma operação de despacho simulado; testar dois claims simultâneos e comprovar que exatamente um vence, sem criar reserva comercial ou alterar crédito.
4. Cancelar, tentar reuso tardio, reiniciar o controlador e confirmar bloqueio durável. Testar a reversão após o prazo, verificando ausência/terminalidade da tentativa original; HTTP 503 não autoriza presumir falha.
5. Desabilitar o canal, remover cliente/identidades e vínculos temporários, restaurar tráfego e confirmar receptores e reservas. Registrar timestamps, estado e custo, sem tokens nem dados pessoais.

**Bloqueios expressos**: não executar nem preparar envio de arquivo a Gemini real, não publicar frontend, não abrir acesso público, não acessar produção, não migrar bancos, não modificar IAM remoto, faturamento ou regras Firebase nesta preparação local.

## Evidência e limite

A suíte CI inclui testes dirigidos de runtime e vínculo de job; o ensaio Firestore Emulator da etapa anterior continua ativo. Esta entrega demonstra a montagem **local candidata**. Não prova que `CLOUD_RUN_EXECUTION` seja autenticado por si só, que uma SA exclusiva tenha sido criada, ou que IAM/remessa privada funcione no Cloud Run real. Essas comprovações exigem autorização separada.
