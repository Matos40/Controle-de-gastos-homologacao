# ESP-SMART-AI-0864-001 — Extração privada e reconciliação

Base aprovada `fa2cd7fd6bc940da7271dd6f028be6d31439b30c`. Escopo local e branch experimental. O ensaio remoto anterior validou exclusivamente o diagnóstico privado.

- A ponte e o gateway autenticam e encaminham aos destinos fixos existentes. O backend verifica a identidade Firebase, limita o corpo, valida MIME, assinatura e tamanho e somente então admite a tentativa comercial. O provedor real exige também `SMART_AI_REAL_GEMINI_ENABLED=true` exclusivamente no backend. A chave permanece fora dos outros serviços e do navegador.
- PDF, PNG, JPEG e WebP até 10 MiB continuam no transporte JSON já aprovado. Usar Gemini 3.1 Flash-Lite e o contrato de reconciliação existente, até 100 itens estruturados. Devolver resultado sanitizado para revisão explícita. Nenhuma linha da fatura ou lançamento é persistido pelo servidor de extração.
- Free conserva dois créditos vitalícios. Premium conserva 15 mensais, com renovação à meia-noite do primeiro dia em America/Bahia e sem acumulação. Duas tentativas por 60 s por UID, um trabalho simultâneo por UID e limites operacionais de 30 tentativas por dia e 60 por mês. Seleção ou prévia do arquivo não reserva crédito.
- A admissão transacional exige observação válida do período, Finance Guard sem suspensão e limites comerciais disponíveis. Preservar orçamento de R$ 10,00 e alertas de 25%, 50%, 75% e 100%, suspensão persistente aos 75%, reativação pelo Owner e Pub/Sub independente. Reservas admitidas podem ser liquidadas durante suspensão. Fixtures não emitem observações para desbloquear solicitações.

## Prazos e estado

Ponte de 30 s, gateway de 35 s, orçamento de aplicação de 30 s e provedor de até 27 s dentro desse orçamento. Os contêineres de gateway e backend conservam 45 s. Interromper leitura de upload em desconexão, mas não vincular a liquidação de operação já admitida à conexão do cliente. A revalidação da conta e o commit devem operar dentro do prazo da aplicação.

Um timeout local ou falha de transporte sem confirmação preserva o documento de tentativa pendente. Usar o UUID original para reconciliação, sem reenviar a fatura para descobrir o estado. Após 120 s, a recuperação transacional existente pode encerrar a reserva não liquidada. O provedor pode terminar externamente após a desistência, mas a resposta tardia não pode prosseguir à liquidação local. Se um commit e a recuperação disputarem o mesmo estado, a transação vencedora determina o resultado e a outra não altera o crédito. Um reinício mantém o estado durável. Falha confirmada ou resultado contratualmente inválido permite restituição após confirmação do commit, sem estornar o contador de tentativas.

## Evidências

T01–T04, T06 e T08 cobrem a entrada HTTP do handler, Free e Premium, formatos inválidos, limite, uma cobrança, restituição confirmada, resultado inválido e revisão obrigatória. T05 cobre desconexão, prazo, falha de transporte, resultado tardio e recuperação única após reinício. T07 cobre observação ausente, suspensão e teto global sem invocar o adaptador. Os testes usam dados fictícios e transportes isolados. O ensaio remoto real está descrito em [ENSAIO-0864.md](ENSAIO-0864.md).
