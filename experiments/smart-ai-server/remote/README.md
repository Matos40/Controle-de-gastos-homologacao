# Validação remota — Etapa 08.3.1

O ponto de partida é o commit `606d1ff49e3aa49d15f32563f135124d21246251`. O arquivo `wrangler.remote.toml` define um Worker distinto, inicialmente sem rota pública e sem URLs de prévia. O protótipo local mantém sua configuração própria.

O Worker exige HTTPS, usa somente o projeto experimental fixado no código e rejeita configurações de emulador. A autenticação verifica assinatura RS256, emissor, destinatário e validade do token do Firebase. A consulta administrativa de conta checa revogação e bloqueio. O acesso ao Firestore usa OAuth de uma conta de serviço exclusiva do projeto experimental. A reserva de cota e o registro de desfecho reaproveitam as transações do protótipo.

As duas credenciais esperadas são bindings secretos `FIREBASE_WORKER_CREDENTIAL` e `RAYTECH_GEMINI_API_KEY`. Mantenha a conta de serviço restrita à consulta de usuários experimentais e às operações de dados exigidas no Firestore experimental. Não reutilize identidades de projetos existentes.

O teto em código é de 10 MiB de documento, com margem para o envelope JSON em base64. O tamanho aceito pelo runtime e pelo provedor precisa ser medido com imagens e PDFs sintéticos, em chamadas frias e aquecidas. Compare CPU com 10 ms e subrequisições com 50 por chamada. Registre memória apenas se estiver disponível por chamada. O tempo de relógio inclui espera de rede e não substitui a medição de CPU.

## Evidência da preparação

- Quatro testes locais de isolamento passaram em `node --test remote/worker.test.mjs`.
- O Wrangler gerou o pacote de implantação em modo `--dry-run`, sem publicar.
- A criação de um novo projeto atingiu a cota da conta. Com autorização, o Firebase Spark foi adicionado ao projeto experimental `gen-lang-client-0593667072`. O Firestore Standard `(default)` foi provisionado em `southamerica-east1`, com as regras iniciais que negam acesso direto de clientes. O método e-mail/senha foi configurado para contas sintéticas.
- O painel Cloudflare aprovou o OAuth do Wrangler. O acesso ao cofre do Windows falhou com erro 5 e a sessão da CLI permanece pendente.
- Testes remotos, latência, CPU, memória, subrequisições reais e conclusão sobre 10 MiB permanecem pendentes.
