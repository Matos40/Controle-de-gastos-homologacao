# Raytech CG | Fase 1 | I05 persistencia localStorage simulada

Escopo: exclusivamente branch develop, Node CommonJS, Map em memoria.
Nenhum acesso a localStorage real, navegador, disco, Firebase ou producao.

## Protocolo
- simulatedLocalStorage: getItem/setItem/removeItem e injecao de falhas.
- boot: reabre registro persistido em memoria, com revisao.
- commit: valida contrato V3, compara revisao, protege marcadores de exclusao,
  prepara staging e troca a chave ativa. Staging nao e fonte de verdade.
- backup: V3 autenticado via HMAC-SHA256 I03, sem guardar a chave.
- restore: autentica backup V3, valida e aplica as mesmas regras de commit.
- Chaves de armazenamento com prefixo de laboratorio.

## Limitacoes importantes
- Nao representa garantias reais de atomicidade entre duas chamadas
  setItem; uma falha apos gravacao ativa mas antes da confirmacao
  pode gerar conflito na proxima inicializacao. Exige protocolo duravel.
- Nao simula concorrencia real de abas, quotas de browser, privacidade,
  indisponibilidade do dispositivo ou armazenamento remoto.
- Nao integra o armazenamento verdadeiro do app nem executa migracoes.
- Restauracao que apaga tombstones e bloqueada; mecanismo formal de
  rollback aprovado e pendente.
- O contrato V3 exige equivalencia entre marcadores internos e externos.
- I05 nao pode ser considerado resolvido em producao por este prototipo.

## Teste
```bat
cd /d C:\Users\dasle\raytech-cg-desenvolvimento
git pull origin develop
node tests\production-phase1-simulated-localstorage\localstorage.test.cjs
```
Meta 40/40 pendentes de execucao local. Historico anterior: 1076.
Gate NOT_READY_FOR_INTEGRATION e NOT_READY_FOR_PRODUCTION.
