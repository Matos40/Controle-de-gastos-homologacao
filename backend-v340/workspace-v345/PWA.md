# V34.6 Smart PWA Experience

Candidato de engenharia da branch `feature/v34-6-smart-pwa-experience`, com base na V34.5.1. Os fluxos e estilos visuais dessa versão foram mantidos.

## Preparação e acesso offline

Abra a PWA online e entre no Firebase Authentication. Aguarde a fase `ready` do Service Worker antes de depender da abertura offline. O navegador armazena apenas o shell público validado pelo inventário do build. Os dados financeiros continuam no armazenamento isolado do aplicativo e as credenciais continuam no SDK do Authentication.

A abertura offline exige o mesmo UID autenticado e uma autorização local emitida após verificação no servidor nas últimas 24 horas. A autorização legada exige uma nova verificação online. A revalidação após reconexão verifica bloqueio, plano e função antes de liberar a nuvem ou o Smart Admin. O logout remove a autorização local. Bloqueios feitos durante a interrupção tornam-se conhecidos quando o servidor pode ser consultado novamente. A validação offline depende do armazenamento e relógio do navegador.

## Contrato para a integração visual

- `window.raytechPwa.state()` informa fase, disponibilidade do prompt e modo instalado.
- `raytech-pwa-state` em `window` comunica alterações para Smart Install, splash e Smart Update. As fases incluem `preparing`, `ready`, `update-waiting`, `update-failed` e `unavailable`.
- `window.raytechPwa.install()` usa o prompt nativo quando disponível e deve ser chamado sob gesto do usuário. No Safari do iOS, use a ação nativa de adicionar à tela inicial.
- `window.raytechPwa.checkUpdate()` verifica o manifesto de cache por meio da atualização do worker. `update-waiting` indica que é possível concluir a sessão normalmente e fechar todas as janelas da PWA para receber a atualização na próxima abertura.
- `raytech-account-start` sinaliza a inicialização do dashboard autenticado. A inclusão de controles e telas pertence à integração visual.

Cada build contém hashes dos arquivos servidos. Um worker incompleto descarta apenas seu cache candidato. A ativação segue o ciclo do navegador após o fechamento de todas as janelas controladas. O worker nunca chama `skipWaiting` nem força recarregamento. A limpeza na ativação fica restrita aos caches versionados da própria PWA.

O workflow gera um candidato estático e executa a suíte de regressão e os cenários em Chromium e emuladores. A validação nativa do prompt e do ícone instalado em Windows, Android e iOS faz parte da homologação prática da integração visual.
