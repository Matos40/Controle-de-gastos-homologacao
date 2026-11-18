# ESP-PWA-001 v1.0 — Smart PWA Experience

Base V34.5.1: 54de742a8443851451423e7664c80aab0a1e156d. Engenharia V34.6: 285b7f37a7c19d0ae81cc3e104fe7c01c3d6ebed. Escopo exclusivo de homologação, plano Spark.

## Requisitos
PWA-01 manifest próprio; PWA-02 service worker homologação; PWA-03 cache versionado com SHA-256; PWA-04 abertura offline após preparação; PWA-05 autorização mesmo UID; PWA-06 três bancos preservados; PWA-07 atualização segura; PWA-08 reconexão automática; PWA-09 Windows/Android/iOS; PWA-10 rejeição de build incompleto; PWA-11 regressões V34.5.1; PWA-12 Spark.

## Decisões de engenharia
Autorização offline de 24 horas após verificação online; logout revoga; revogação remota conhecida na reconexão; sem Smart Admin ou leitor offline. Cache somente shell público, não dados financeiros nem tokens. Configuração Firebase pública validada. Ativação natural após fechamento de todas as janelas, sem skipWaiting ou reload forçado. Consulte PWA.md para o contrato de integração.

## Visual
Smart Splash usa logo e tipografia existentes e status real de inicialização, sem atraso artificial. Smart Install em Segurança & App, prompt nativo quando disponível e instruções Windows/Android/iOS. Smart Update reflete fases reais, sem inventar progresso. Paleta #020617 #031126 #08182B #58DCFF #16CCE8 #0083CE, Orbitron e Plus Jakarta Sans. Ícones oficiais 192/512 e Apple touch existentes preservados; maskable dedicado depende de validação geométrica futura. Identidade do manifest preservada para evitar instalação duplicada.

## Aceitação
T01 Windows; T02 Android; T03 iOS; T04 identidade; T05 online; T06 cold start offline; T07 criação offline; T08 edição/exclusão; T09 reconexão; T10 sem duplicidade; T11 logout; T12 UID; T13 atualização; T14 build incompleto; T15 operações pendentes; T16 Admin offline; T17 regressões; T18 produção isolada; T19 Spark; T20 backup/restauração. Testes físicos pendentes até publicação autorizada.

## Responsabilidades
Codex: engenharia e publicação autorizada. ChatGPT: integração visual, documentação e testes de interface. Sem alteração de produção, bancos originais, regras remotas, Gemini real ou pagamentos.
