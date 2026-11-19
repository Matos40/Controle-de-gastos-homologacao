# Raytech CG · Documento mestre

## Encerramento oficial da V34.7.4.5 Stable Edition

O proprietário aprovou **7 de 7 testes práticos da Etapa 07 Stable Validation**. O ciclo V34.7.4.5 está formalmente encerrado, com as **Etapas 01 a 07 concluídas**. Os 178 testes automatizados de referência e os 329 arquivos verificados são evidências distintas da aprovação prática.

| Referência | Registro |
| --- | --- |
| Repositório oficial | Matos40/Controle-de-gastos-2.0 |
| Repositório de homologação | Matos40/Controle-de-gastos-homologacao |
| Commit oficial | `121cca799aa7072094c668697249214b899e86d5` |
| Branch de restauração | `restore/v34-7-4-5-estavel` |
| Artefato oficial | `14487086882` |
| Workflow de publicação | `44433045711` |
| SHA-256 do artefato | `e0b05acd8e0a2b66520bce8c4a6dc03d8b77e3609d3fb9728e336d9a738d34e3` |
| Ruleset oficial | `56bab118-3b69-46b6-8b84-d04ec6be8a13` |

A **Etapa 08 Smart AI Server** está aberta **somente em planejamento**. A Chave API e o leitor de faturas funcional permanecem protegidos até a aprovação definitiva da IA centralizada.

## Base estável e diretriz permanente

A referência estável atual é **V34.7.4.5 Stable Edition**, branch `restore/v34-7-4-5-estavel`, commit de produção `121cca799aa7072094c668697249214b899e86d5`.

1. Produção e homologação devem encerrar cada ciclo na mesma base estável de código e funcionalidades. Credenciais, contas, bancos e configurações de ambiente têm isolamento próprio.
2. Toda nova implementação começa e é validada exclusivamente em homologação.
3. Preservar todas as funcionalidades, configurações e interfaces anteriormente aprovadas. Alterações visuais ou funcionais exigem autorização expressa do proprietário.
4. Executar e registrar testes de regressão antes de qualquer publicação. Corrigir falhas antes de avançar.
5. Promover a revisão validada para produção somente após aprovação prática e autorização expressa do proprietário.
6. Após cada publicação oficial, restabelecer e verificar a paridade da base estável entre os ambientes, preservando suas configurações e seus dados isolados.
7. Criar e verificar um ponto de restauração para cada versão estável aprovada. Registrar versão, commit, artefato, hashes e procedimento de rollback.

A diretriz se aplica a todos os ciclos futuros, inclusive ao **Smart AI Server**. A paridade é de código e comportamento aprovado e deve ser verificada sem compartilhar bancos, contas, credenciais ou configurações entre ambientes.

Manter o plano **Spark** até autorização expressa do proprietário em contrário. **ChatGPT** responde pelo planejamento, pela arquitetura e pela interface visual. **Codex** responde pela implementação, pelos testes e pelas publicações autorizadas.

## Registros do projeto

- [Plano de execução](online/PLANO-DE-ACAO.md)
- [Inventário de funcionalidades, paridade e publicação](PARIDADE-E-PUBLICACAO.md)
- [Inventário de funcionalidades protegidas](INVENTARIO-FUNCIONALIDADES-PROTEGIDAS.md)
