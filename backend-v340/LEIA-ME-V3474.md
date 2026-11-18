# Raytech CG V34.7.4 - Candidata local Windows
Somente dados fictícios. Não utilize dados, senhas, faturas ou backups reais. Não é a versão oficial.
## Preparação
Instale Node.js 22 LTS (com npm) e Java JDK 21. Internet necessária para dependências npm e downloads iniciais dos emuladores. Não exige login Firebase, chave Gemini, projeto pago, nem configuração de credenciais. O ZIP contém o frontend compilado, backend e lockfile; não contém node_modules nem executáveis dos emuladores.
Verifique o SHA-256 do ZIP usando PowerShell: Get-FileHash .\raytech-v3474-windows.zip -Algorithm SHA256. Compare com o arquivo .sha256 distribuído no mesmo artefato. Extraia tudo em pasta nova. Se Windows marcar os scripts como baixados, confirme a procedência e use Unblock-File apenas nos scripts verificados antes de abrir.
## Iniciar
Abra INICIAR-RAYTECH-V3474.cmd. Mantenha a janela aberta. Acesse http://127.0.0.1:15003. Não use localhost, IP de rede ou URL oficial. Se uma porta estiver ocupada, encerre você mesmo o aplicativo que a ocupa; o launcher não mata processos externos.
Contas fictícias: free@example.invalid, premium@example.invalid, admin@example.invalid, owner@example.invalid. Senha de todas: Raytech-Lab-3474! (apenas emulador).
## Testes práticos
1. Free: leitor de IA indisponível e painel administrativo oculto.
2. Premium: gerar amostra, revisar, selecionar e confirmar. Repetir amostra e conferir deduplicação. Após três reservas no mesmo minuto, verificar cota (UTC).
3. Owner/Admin: abrir Smart Admin e verificar reservas, conclusões, falhas e pendências, limite global simulado e cotas. Não use as contas oficiais.
4. Verificar os três bancos sintéticos, exportações JSON/Excel, sincronização entre duas janelas, modo offline do navegador e reconexão. IA exige conexão com o backend. Testar layout mobile via modo responsivo, não exponha a rede.
5. Encerrar: pressionar ENTER na janela do laboratório. O emulators:exec encerra os emuladores. Não há import/export de dados do emulador; contas e dados remotos são recriados a cada sessão. Dados locais do navegador podem persistir; usar perfil separado e apagar apenas os dados do endereço local se desejar reiniciar, nunca a origem oficial.
## Limitações
Provedor e documentos fixos simulados, orçamento não faturado, sem upload real, sem instalação de serviço, sem publicação. Pacote exige instalação de dependências na primeira execução. Teste Windows automatizado valida inicialização do backend, contas e resposta HTTP, não substitui teste manual do PWA em Windows.
