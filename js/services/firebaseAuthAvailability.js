/* Aviso isolado: falha de carregamento do login Google não afeta as finanças. */
(() => {
  const moduleScript = document.querySelector('script[type="module"][src="./js/services/firebaseAuthLite.js"]');
  const status = document.getElementById('firebaseAuthStatus');
  const login = document.getElementById('firebaseLoginButton');
  const logout = document.getElementById('firebaseLogoutButton');
  if (!moduleScript || !status) return;

  moduleScript.addEventListener('error', () => {
    status.textContent = navigator.onLine === false
      ? 'Conta Google indisponível sem internet. Suas finanças locais continuam acessíveis.'
      : 'Não foi possível carregar o login Google. Suas finanças locais continuam acessíveis. Recarregue quando a conexão estiver estável.';
    if (login) login.disabled = true;
    if (logout) logout.disabled = true;
  });
})();
