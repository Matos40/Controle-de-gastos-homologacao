# Raytech CG — piloto funcional de sincronização

Somente homologação. Login Google existente, aberto em Opções > Conta Google > Abrir finanças na nuvem (teste). Não lê appDb nem envia lançamentos locais. Valores predefinidos, um mês fictício, saldo, salário, duas despesas, cartão, extra, pagamento, exclusão lógica por valor zero. Não contempla parcelas futuras, sincronização do banco completo ou importação. Limite de 100 operações por conta sem apagar recibos. Escritas online por transação e revisão; operação incerta preservada localmente por UID; sem fila de novas operações offline.

## Ativação
1. Confira que está no projeto raytech-cg-homologacao, plano Spark.
2. Inspecione as regras vigentes, em especial os matches recursivos. Incorpore o trecho isolado de docs/firestore-sync-pilot.rules.txt sem remover regras existentes. Regras sobrepostas são OR; uma regra permissiva invalida o isolamento. Não habilite se houver autorização ampla.
3. Depois de validar regras (conta A vs B, sessão ausente, revisão inválida e exclusão), crie manualmente no Console o documento raytechSyncPilotAccessV1/{UID} com o único campo enabled (boolean true). O UID é mostrado no painel após login. Não habilitar contas desconhecidas. Não inserir dados reais.
4. Abra o painel com mesma conta em Windows, Android e iOS; alterar salário e energia; verificar saldo, revisar edição simultânea, remover energia, testar conta B e logout; desligar conexão e verificar bloqueio. O piloto não é backend financeiro confiável para dados reais.
5. Desativar: definir enabled=false na autorização. Não apagar recibos. O workflow de espelhamento develop está pausado intencionalmente para não sobrescrever as mudanças.
