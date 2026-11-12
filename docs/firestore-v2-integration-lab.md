# Firestore V2 - integracao isolada em emulador

Somente branch develop, dados ficticios, Firestore emulador porta 8086.
Nenhuma alteracao na producao. Colecoes separadas:
`users/{uid}/financeV2Plans/{checksum}/documents/{manifest|m_YYYY-MM}`
e `completion/audited`.

O formato v2 nao transporta `selectedMonth`, chave Gemini, PIN nem
preferencias de visualizacao. A conversao v1 e feita em memoria pela ponte
versionada, sem regravar manifestos antigos. Lotes podem ser retomados,
documentos sao imutaveis e a finalizacao rele dados em transacao.

**Limitacoes importantes**:
- O marcador final e criado pelo cliente; regras Firestore nao comprovam
  auditoria nem verificam checksum. Necessario backend confiavel antes de producao.
- Planos de checksum diferente sao armazenados lado a lado: isto **nao**
  resolve conflitos semanticos entre versoes financeiras. Nao ativar
  sincronizacao bidirecional ate implementar escolha de revisao autoritativa,
  deteccao de divergencias e reconciliacao segura.
- Regras bloqueiam campos sensiveis conhecidos no topo do documento mensal;
  o bloqueio recursivo ocorre no adaptador Node, nao nas regras. Revisar
  validacao de schema em backend confiavel.
- Cada mes e gravado como documento integral. Antes de producao, lidar com
  limite de tamanho de documento, concorrencia e paginacao.
- Checksum SHA-256 nao autentica emissor.
