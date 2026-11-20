# Contrato experimental de faturas v2

O Gemini retorna um objeto com lançamentos tipados, total explícito da fatura, base de cálculo, saldo anterior e pagamentos anteriores. Os valores usam centavos inteiros entre −1.000.000.000 e 1.000.000.000 por campo, com até 100 lançamentos. Valores desconhecidos são `null`. O servidor calcula somas e diferenças com inteiros seguros. A diferença é o total explícito menos o total calculado.

Compras e encargos são positivos. Estornos, descontos e créditos são negativos. O valor de uma parcela é o valor cobrado no período. Saldo anterior e pagamentos anteriores são componentes separados. `ACTIVITY_ONLY` representa total restrito aos lançamentos do período, `WITH_PRIOR` exige ambos os componentes anteriores para computar o total e `UNKNOWN` preserva a incerteza.

O resultado fornece `entries`, `reconciliation` e uma projeção `items` para os consumidores experimentais existentes. A projeção não calcula o valor total da compra parcelada. Ela preserva sinais, nulos e parcelas. `requiresReview` permanece verdadeiro em toda extração bem-sucedida. O backend não grava lançamentos no núcleo financeiro.

`RECONCILED` indica diferença zero. `DIVERGENT` e `INCOMPLETE` são resultados para revisão e liquidam a reserva. `INVALID` acompanha falha estrutural do provedor e restituição quando confirmada. Possíveis duplicidades são índices de revisão, sem remoção de linhas.
