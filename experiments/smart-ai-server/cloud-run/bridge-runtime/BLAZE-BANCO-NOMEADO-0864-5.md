# Raytech CG V35.0 — Etapa 08.6.4.5 — Banco nomeado no Blaze (preparação local)

Base autorizada: `acf0a10d62fcd5c8d52c5c428c88e7d5f4a33e2e`, branch `feature/smart-ai-server-v350-poc`.

## Escolha técnica

- Projeto experimental existente **raytech-3d** (Blaze já habilitado segundo a sondagem do Codex).
- **Único banco candidato** ao canal de controle: `projects/raytech-3d/databases/ai-control-v350`, região proposta `us-central1`, pendente de criação e confirmação operacional.
- `projects/raytech-3d/databases/(default)` é proibido. O ledger experimental em `gen-lang-client-0593667072` e os bancos oficiais em `raytech-cg-producao` e `raytech-cg-homologacao` permanecem intocados.
- A lista `APPROVED_REMOTE_CONTROL_DATABASES=[]` continua **vazia no runtime de verdade**. A configuração recusa ativação mesmo se alguém definir `SMART_AI_TRIAL_CONTROL_ENABLED=true`. Apenas testes isolados fornecem o candidato via injeção explícita.
- O adaptador é fixado ao recurso nomeado e valida cada referência de leitura/escrita dentro da transação, além da coleção `raytechLabTrialControlV350`. Permanece uma barreira de aplicação, não substitui IAM.
- Variáveis futuras: `SMART_AI_TRIAL_CONTROL_FIRESTORE_PROJECT_ID=raytech-3d` e `SMART_AI_TRIAL_CONTROL_FIRESTORE_DATABASE_ID=ai-control-v350`. Não configurar flag de ativação remota agora.

## Evidências locais

- Rejeição em testes sintéticos de `(default)`, dos projetos financeiros, de banco não aprovado, de referência falsificada dentro de transação e de endpoints do emulador diferentes do banco candidato.
- Firestore Emulator valida CAS único sob concorrência, persistência entre instâncias, cancelamento, recusa tardia e recuperação idempotente no banco **nomeado**.
- Conferência de ausência do documento de controle nos bancos `(default)` fictícios do emulador.
- **Emulador não comprova IAM remoto**. Todos os resultados se referem apenas a dados sintéticos e runtime local.

## Trabalho do Codex após autorização específica (NÃO EXECUTAR AGORA)

1. Confirmar configuração de faturamento do `raytech-3d`, região, eventual custo, e registrar o estado anterior dos recursos.
2. Criar **somente** o banco nomeado `ai-control-v350` em `us-central1`, se ausente. Não alterar `(default)`, projetos financeiros, índices/rules oficiais, faturamento ou quotas. A criação e a localização do banco exigem aprovação específica do Owner.
3. Provisionar identidade **própria** do serviço de controle, sem papéis herdados em `raytech-3d` que permitam escrita em `(default)` nem qualquer acesso em `gen-lang-client-0593667072`. Conceder operações transacionais somente ao banco nomeado, por binding efetivamente **escopado por banco**. Se o escopo por banco não puder ser aplicado, **abortar**; a separação física, sozinha, é insuficiente. Considerar que APIs de transaction begin/commit exigem permissões próprias. Verificar todos os bindings e papéis herdados em leitura.
4. Provar **negação efetiva** de leitura ao `(default)` e aos projetos financeiros, preferindo análise IAM/Troubleshooter e `testIamPermissions`, sem escrever nem enumerar dados reais. Se a negação não estiver comprovada, **abortar**.
5. Criar identidades separadas para controlador e **job exclusivo por execução**. Job sem Firestore e somente `roles/run.invoker` no serviço de controle privado; controlador com `run.executions.get` estritamente necessário. Obter nome da execução, job e service account efetiva pela **API administrativa** do Cloud Run. Nunca tratar variáveis fornecidas pelo job como prova independente.
6. Não implantar nem ativar `trial-control-runtime.mjs` antes da revisão IAM e autorização do Owner. A imagem principal atual inicia `server.mjs`; qualquer implantação do controle exige um serviço **separado**, ingress interno e autenticação obrigatória, sem alterar o tráfego comercial.
7. Após eventual autorização, Íris fixa o recurso real validado na allowlist de código, realiza commit e CI. O Codex pode então executar **um despacho inteiramente simulado sem Gemini**, retornar tudo a DISABLED e registrar a reversão.

## Riscos e orçamento

O banco nomeado no Blaze pode ser faturado independentemente da franquia gratuita do `(default)`. Orçamento de referência R$ 30/mês, com alertas de 25%, 50%, 75% e 100%; alertas **não são teto rígido**. Não ativar Gemini, não importar faturas reais, nem admitir créditos/reservas comerciais nesta etapa.

**Apenas alterações no GitHub experimental**. Zero operações remotas Google Cloud/Firebase/IAM, zero Gemini, nenhuma publicação ou merge.
