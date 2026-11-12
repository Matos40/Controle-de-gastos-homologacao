# Etapa 21 - auditoria isolada de seguranca

Laboratorio develop, Firestore 8093, Auth 9099, projeto demo. Testa
autorizacao via Auth Emulator, negacao de acesso direto, auditoria
independente de hashes e recibos, adulteracoes, isolamento e reenvio
apos perda de confirmacao simulada.

## MetadataLookupWarning

O aviso 'MetadataLookupWarning ... ETIMEDOUT' nao demonstra falha na
verificacao do ID token. O Admin SDK pode consultar metadados de
credenciais do Google para descoberta de projeto/credenciais. Este
laboratorio usa projectId explicito e emuladores. Nao foi reproduzido
nem comprovada a causa exata do aviso. Para investigar, executar com
'node --trace-warnings' e registrar a stack, sem publicar segredos.
Se persistir, examinar ADC, GOOGLE_APPLICATION_CREDENTIALS e
GOOGLE_CLOUD_PROJECT/GCLOUD_PROJECT. Nao configurar credenciais de
producao no laboratorio. Nao silenciar globalmente os avisos.

## Vulnerabilidades npm

O relato '5 high severity vulnerabilities' e um resultado local
anterior; este laboratorio nao pode afirmar quais pacotes/CVEs
estao afetados sem o relatorio npm audit. Na pasta de dependencias
separada: npm audit --json > audit-stage21.json
e npm ls firebase-admin firebase @firebase/rules-unit-testing
Analisar advisories, caminho de dependencias, versoes corrigidas e
alcance em producao; nao rodar npm audit fix --force. O JSON pode
conter caminhos internos; revisar antes de compartilhar.

## Limites e bloqueios de producao

A perda de resposta e simulada pelo reenvio; nao ha injecao de falha
de rede no transporte. O teste nao cobre disponibilidade sob falha
real de emulador, revogacao, MFA, endpoint HTTP, quotas, limites de
payload, ataques de negacao de servico, logs externos ou expiracao
de token. A auditoria le Firestore via Admin SDK e nao valida
autoria criptografica; administradores comprometidos podem adulterar
o banco e recalcular hashes. Regras negam acesso a clientes, mas o
Admin SDK ignora regras e deve ser protegido por autorizacao real.
Nenhuma mudanca na producao ou ativacao de sincronizacao.
