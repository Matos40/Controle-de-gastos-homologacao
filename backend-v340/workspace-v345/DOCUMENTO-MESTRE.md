# Raytech CG · Documento mestre

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

## Registros do projeto

- [Plano de execução](online/PLANO-DE-ACAO.md)
- [Inventário de funcionalidades, paridade e publicação](PARIDADE-E-PUBLICACAO.md)
