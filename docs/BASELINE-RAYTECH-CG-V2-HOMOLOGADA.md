# Raytech CG V2 — baseline funcional homologada

**Identificador:** RCG-V2-HML-001  
**Status:** homologação funcional aprovada com ressalvas técnicas; não autorizada para produção.  
**Repositório:** Matos40/Controle-de-gastos-homologacao  
**Commit funcional congelado:** [4a01326a742731c3c2c86a54b5385f96041d8165](https://github.com/Matos40/Controle-de-gastos-homologacao/commit/4a01326a742731c3c2c86a54b5385f96041d8165)  
**Referência de preservação:** `baseline/raytech-cg-v2-homologada` (branch de referência, não tag nem proteção imutável).  
**Registro documental:** branch separada `docs/raytech-cg-v2-homologada`, sem alteração da main publicada.

## Evidências automatizadas

- [Execução 43660930270](https://github.com/Matos40/Controle-de-gastos-homologacao/actions/runs/43660930270) — concluída com sucesso, HEAD igual ao commit funcional. Job 132649873759: 22 testes, 22 aprovados, 0 falhas, 0 ignorados, 0 cancelados. A suíte é `node --test tests/cloud-test*.test.mjs`, não a suíte integral do PR #7.
- [Deployment 43660929935](https://github.com/Matos40/Controle-de-gastos-homologacao/actions/runs/43660929935) — build, deploy e report-build-status aprovados, mesmo HEAD.
- [Comparação RC Final → baseline](https://github.com/Matos40/Controle-de-gastos-homologacao/compare/c3e75566d98b8c0cf60995c2c9bd14f01b30606e...4a01326a742731c3c2c86a54b5385f96041d8165) — seis commits, onze arquivos alterados.
- Regras versionadas: `docs/firestore-homologacao-completo-v2.rules`, blob Git `0658d3a6e9ecf4c7218431301c1a173aac03bf3f`. Publicação manual na homologação informada pelo responsável; não consultada diretamente no Firebase por esta auditoria.

## Evidências práticas (relatos e capturas do responsável)

| Teste | Resultado |
|---|---|
| T01 | Interface RC V2, V1 revisão 23, zero pendências |
| T02 | Dados fictícios conferidos, backups JSON e Excel exportados |
| T03 | Migração V2 revisão 1, dados preservados; transição automática falhou, recuperação manual bem-sucedida |
| T04 | Reversão para V1 revisão 23, dados preservados; observado erro de clonagem do Service Worker |
| T05 | Segunda migração, V2 revisão 1, zero pendências |
| VR01 | Atualização preservou V2 e dados, zero pendências, erro de clonagem ausente |
| VR02 | Abertura offline, cache V18, dados preservados, reconexão automática |
| VR03 | Sincronização V2 PC/celular, saldos corretos, sem duplicação, zero pendências e retorno inseguro bloqueado |

A bateria reduzida reaproveita evidências RC1/RC2/RC Final e testes anteriores de backups; não implica repetição integral de todos os cenários físicos na arquitetura ativa V2.

## Ocorrências

- BUG-V2-001: confirmação automática de migração incompleta (`MIGRATION_UNCONFIRMED`). Correção em [e83e7a9](https://github.com/Matos40/Controle-de-gastos-homologacao/commit/e83e7a925f4f499f72cb0d84c15db9e3a6c58a65), testes sintéticos aprovados, sem nova migração física após correção. Ressalva aberta.
- BUG-V2-002: `Response body is already used` em Service Worker. Correção no mesmo commit, VR01 aprovado.
- BUG-V2-003: abertura offline indisponível. Fallback restrito ao cache ativo V18 e timeout de navegação de 3,5 s; regressão automatizada e VR02 aprovados.
- MEL-V2-001: Tailwind via CDN permanece; melhoria futura, fora do escopo.

## Limites e condições de uso

- Apenas homologação e dados fictícios. Não autoriza produção, migração de dados reais, merge ou integração com PR #7.
- Snapshot máximo 180.000 caracteres, até 24 meses; não é armazenamento particionado por mês. A fila tem limites de tamanho, até 64 operações e depende da capacidade local do navegador.
- Recibos independentes, imutáveis pelas regras previstas, com revisão e hash; regras não calculam SHA-256 nem validam toda a semântica financeira do JSON. Sem auditoria de regras no emulador/servidor nesta consolidação.
- Controle preventivo de 300 tentativas/dia UTC por UID/dispositivo; máximo três tentativas por transação e pausa por esgotamento de cota. Não é medição global do Spark nem garantia de custo zero.
- Reversão direta exclusivamente enquanto V2 ainda corresponde ao snapshot inicial e V1 não divergiu. Não realizar nova migração ou reversão no banco ativo avançado para obter evidência adicional.
- Conciliação conservadora: conflitos de mesma entidade, cadeias incompatíveis, falta de prova-base ou mudanças estruturais exigem revisão. Não presumir resolução automática universal.
- Offline depende de instalação do shell e dependências, autenticação persistida e checkpoint local de UID; não garante primeira abertura offline nem sincronização com app fechado.
- A validação funcional não constitui auditoria completa de segurança, escalabilidade, disponibilidade ou autorização de produção.

## Isolamento e preservação

Na verificação anterior à consolidação:
- Main oficial: `38012bc94d1946ca13f6dba576e3ef30858e97e3`.
- [PR #7](https://github.com/Matos40/Controle-de-gastos-2.0/pull/7): aberto, sem merge, HEAD `ff4b76660127358f231c5a3f9327f4070ec5a704`.
- Sincronização develop → homologação pausada no workflow existente.
- Nenhuma operação sobre Firestore, dados financeiros, backups, regras publicadas, produção ou PR #7 durante a consolidação.
- A documentação está em branch separada para não disparar publicação automática da main. Não mover ou excluir a branch de referência. O SHA completo acima é a identidade exata do código aprovado. Se for criada uma tag no futuro, apontá-la ao SHA funcional, não ao commit documental.

**Parecer:** baseline funcional homologada sob as condições acima, com a ressalva BUG-V2-001 documentada. Qualquer evolução posterior deverá ter escopo próprio, preservar a referência e passar por testes de regressão antes de nova homologação. Não promover esta baseline diretamente à produção.
