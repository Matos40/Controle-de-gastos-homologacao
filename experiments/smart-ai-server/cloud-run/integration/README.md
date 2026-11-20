# Raytech CG V35.0 · Smart AI Integration 08.4

## Avaliação prática isolada

Requer Node.js 22. A partir da raiz da árvore extraída, execute:

```sh
node experiments/smart-ai-server/cloud-run/integration/server.mjs
```

Abra http://127.0.0.1:8784/. Use os perfis fictícios Free, Premium, Admin ou Owner. As contas, os créditos, as operações e a auditoria se limitam à memória do processo. Reiniciar o laboratório restaura os dados. A leitura aceita PDF, PNG, JPEG e WebP de até 10 MiB. Use apenas os arquivos sintéticos. O provedor local devolve um gabarito fixo e não interpreta a imagem.

1. Em Free, abra Chave API, feche a janela e selecione Smart AI explicitamente. Confira os dois créditos e processe o PDF fictício.
2. Abra Revisar lançamentos. Confira os três valores, a parcela 2/3, o estorno e os totais de R$ 38,55. Edite, desmarque, cancele ou confirme a simulação.
3. Saia e entre como Premium. Confira quinze créditos e a data da próxima renovação. Use a emulação de dispositivo do navegador para Android e iOS. O laboratório se limita ao loopback e não abre uma porta para a rede local.
4. Perfis Admin e Owner têm acesso ao Smart Admin AI. Só o Owner fictício pode confirmar uma nova autenticação no laboratório e alterar as configurações sensíveis simuladas. Reinicie com o argumento `suspended` para testar a suspensão aos 75%. Outros cenários disponíveis são `divergent`, `incomplete`, `duplicates`, `failed` e `unavailable`.

## Integração candidata

`workspace.mjs` é o adaptador opt-in para o host experimental. O host fornece a sessão Firebase, o callback da modalidade Chave API e um adaptador de confirmação simulada. A versão publicada e os pontos de entrada oficiais ficam fora desta árvore. Na prévia o botão Chave API abre somente uma configuração simulada. A modalidade oficial permanece no código existente e suas credenciais nunca são encaminhadas ao Smart AI.

O laboratório exercita os módulos reais de contrato financeiro, créditos, administração e regras de suspensão, com sessões e persistência simuladas. A ponte permite somente os três endpoints previstos e encaminha a credencial de aplicação separadamente da credencial IAM. Nenhum token, arquivo, rascunho ou segredo fica no armazenamento persistente do navegador. A troca de usuário cancela os pedidos da interface e elimina a revisão local. O servidor continua responsável pela liquidação de qualquer reserva admitida.

## Comunicação após autorização futura

O navegador envia o token Firebase experimental por HTTPS a um serviço intermediário acessível pela internet e protegido no nível da aplicação. O intermediário valida assinatura, emissor, audiência, UID, validade e revogação. Uma identidade dedicada, com permissão de invocação somente no gateway, obtém o token IAM para a audiência do gateway. O gateway permanece protegido por IAM e chama o backend interno com sua própria identidade. O intermediário deve aplicar limites de tamanho, tempo e frequência, cache HTTP desativado e logs sem faturas, tokens ou cabeçalhos de autorização.

O candidato `cloud-bridge.mjs` existe apenas em código. O laboratório usa transporte local substituível e não invoca um serviço Cloud Run. A rota de internet, suas políticas e a autorização da identidade do intermediário ainda dependem de aprovação e validação remota. Limitação de solicitações de origens inválidas, volume de tráfego e custo por tentativas rejeitadas precisam de controle no intermediário, antes de encaminhar ao gateway.

Como ordem de grandeza, a US$ 0,000024 por vCPU-s, US$ 0,0000025 por GiB-s e US$ 0,40 por milhão de chamadas, 60 requisições de 10 segundos em um intermediário com 1 vCPU e 512 MiB custariam cerca de US$ 0,0152 brutos antes da franquia. Isso exclui partidas a frio, verificações de sessão, consultas de saldo, observabilidade, rede e tráfego indevido. Um balanceador ou Cloud Armor acrescentaria cobranças próprias. A franquia é compartilhada na conta e o orçamento operacional não constitui teto de cobrança. [Cloud Run](https://cloud.google.com/run/pricing) · [Identidade entre serviços](https://docs.cloud.google.com/run/docs/authenticating/service-to-service).
