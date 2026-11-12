# Raytech CG — adaptador financeiro v2 (laboratório)

Somente `develop`, Node.js, sem acesso a dados reais.

## Evidências do código do aplicativo
- `storageService.js`: despesas fixas e únicas usam `amount`; cartões parcelados usam
  `installmentValue`, `totalAmount`, `installments`, `currentInstallment`,
  `installmentOriginId` e `deletedInstallmentOrigins` nos metadados do mês.
- `excelService.js`: exportação usa `expenses`, `cardExpenses`, `extraIncomes`,
  `category`, `paid`, `date`, `type`, `amount`, `installmentValue`.
- O adaptador v2 mantém integralmente o objeto do lançamento em `financeRecord`.
  O identificador de fila é SHA-256 da tupla `[mes,colecao,idOriginal]`.
  Isso permite IDs legados com pontuação/espaços sem alterar o ID financeiro.
- Valores negativos e valores acima do teto da fila são transportados com
  `amountCents: 0` e `financeSignedCents` no envelope. **Nunca usar
  `amountCents` como valor contábil** para esses registros.

## Restrições
- O SHA-256 do envelope é detector de alterações acidentais, **não autenticação**
  criptográfica de remetente.
- `financeSignedCents` depende de inteiro seguro e duas casas decimais.
  Valores não finitos ou com precisão maior são rejeitados, não arredondados.
- Ausência de valor monetário não significa valor zero contabilmente.
- O formato v2 é compatível com o contrato da fila v1, mas **não está integrado
  ao transporte Firestore nem à interface**.
- O adaptador anterior `financeQueueAdapterLab.js` permanece intacto.
- A auditoria de formatos usa fixtures fundamentadas nos campos do código;
  **não leu nem testou o banco financeiro real**.
- Antes de ativar sync: avaliar limites de tamanho dos documentos,
  identidade de dispositivo, validação de schemas remotos, assinaturas de dados,
  tombstones, conflitos e protocolo de conclusão de migração.
