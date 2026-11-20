# Etapa 08.5.3 · Rastreabilidade do candidato

UX01–UX45 e BUG-0851-01 a 03 têm a matriz 08.5.2 como referência. As alterações abaixo prevalecem no candidato server-only. A auditoria visual completa de todos os estados permanece pendente.

| Requisitos | Implementação e evidência |
|---|---|
| UX07, UX43, UX61–UX65 | HTML e rotas sem modal, seletor de modalidade ou configuração pessoal. Painel informativo no modal original. Créditos restantes e capacidade com barra, disponibilidade e renovação. Teste de ausência no navegador. |
| UX46–UX48 | Cartão original de nuvem com alinhamento horizontal, plano preenchido e sincronização em memória identificada como simulação. Usa a estrutura e os glifos oficiais. O renderizador de integração Firebase original fica isolado do ensaio e o estado Atenção não tem cenário próprio. |
| UX49–UX50 | Componente compacto. Saldo é avaliado pelo servidor. O ensaio de Free esgotado verifica rejeição direta, bloqueio do seletor e ausência de disponibilidade contraditória. Perfis Premium são configuráveis na entrada isolada. |
| UX51–UX57 | Monitor mantém limiares, distinção financeira e indicador neutro quando falta observação. O cinza neutro não representa consumo 0%. |
| UX58–UX60 | Campo existente inicia a pesquisa paginada por Enter no candidato. Indicadores e controle de suspensão permanecem no Monitor. |
| BUG-0851-03 | Candidato abre o fluxo único. O teste anterior de modalidades continua no processo de recuperação. |
| SEC-01, SEC-02, SEC-03, SEC-06, SEC-08, SEC-09 | Lista explícita de arquivos e rotas. O artefato remove o modal da cópia HTML e exclui os módulos de recuperação. Rotas legadas devolvem 404. O processo de recuperação só pode ser selecionado na inicialização do servidor de testes a partir do repositório. A restauração oficial continua no commit 121cca799aa7072094c668697249214b899e86d5. |
| SEC-04 | CSP experimental com conexões somente à origem local. Uma futura CSP de homologação deverá reconciliar as origens Firebase autorizadas com o projeto operacional, sem permitir conexões diretas ao Gemini. |
| SEC-05 | Escopo /app/. Cache exclusivo desta variante. Limpeza limitada aos dois nomes experimentais conhecidos. API, sessão, fatura e recuperação ficam fora do inventário. |
| SEC-07, SEC-10 | Guards e contrato comercial reaproveitados. O intermediário é simulado. As credenciais reais do backend permanecem fora da distribuição e dos testes. |

## Quatro falhas legadas da referência intacta

| Teste e linha de tests/offline-shell-production.test.cjs | Esperado e observado | Classe, evidência e impacto |
|---|---|---|
| offline navigation uses current cache exclusively, 16 | Espera literalmente a chave V34.6.3. O SW fixado abre uma chave V34.7.4.5 com digest. | A. O log confirma a divergência de chave. O cache corrente segue sendo a única fonte da navegação nessa suíte. O teste original foi preservado. |
| asset cache clone is made before body consumption, 23 | Ensaia clonagem de resposta de CDN e gravação em cache. A requisição externa não é interceptada. | A. O SW fixado limita o escopo a inventário local e mesma origem. Esperar clonagem incentivaria reintroduzir cache de CDN. O candidato testa a exclusão de recursos estranhos. |
| cache errors preserve network response and offline hit, 29 | Em falha ou ausência de cache, espera resposta nova da rede. O SW fixado devolve indisponibilidade 503. | A. O SW de referência opera com inventário fixado e sem atualização da casca pela rede durante uma falha. O usuário pode precisar reconectar para preparar a versão. A regressão candidata exige isolamento de versão. |
| failed network does not mix old HTML versions, 36 | Espera Response.error. O SW fixado devolve uma resposta local 503. | A. A resposta explícita é produzida pelo handler local. Nenhum HTML antigo é consultado. O teste experimental preserva a finalidade de isolamento e o teste de referência fica intacto. |

Arquivos a consultar. Log raytech-0852-regressao-oficial.txt e sw.js do snapshot oficial. Nenhuma edição no repositório oficial.

## Retirada futura localizada

Após autorização de publicação, avaliar exclusivamente a chave histórica de armazenamento pessoal por perfil, confirmar sua identificação no snapshot e remover somente esse registro no contexto de cada usuário. Não enviar ou registrar seu valor. Preservar bancos, PIN, arquivos, outros registros do navegador e caches fora do inventário aprovado. A atualização de cache candidata usa nomes sintéticos e não executa essa limpeza em produção.

## Infraestrutura pendente

Identidade dedicada, IAM mínimo, controles distribuídos contra abuso e tráfego, validação remota de revogação, pesquisa administrativa e índices, trajeto privado de ponta a ponta, custos operacionais e procedimento emergencial dependem do ensaio autorizado posterior.
