# Controle de Gastos — versão modular

## Estrutura

- `index.html`: interface e modais.
- `manifest.json` e `sw.js`: instalação PWA e cache offline.
- `css/styles.css`: estilos personalizados.
- `js/state.js`: estado compartilhado, categorias, elementos DOM e utilitários.
- `js/app.js`: inicialização, navegação, formulários, segurança e interações globais.
- `js/services/`: armazenamento, Gemini Vision e Excel/backup.
- `js/ui/`: renderização de resumo, despesas, cartão, analytics e histórico.

## Como executar

Sirva a pasta por HTTP/HTTPS (por exemplo, extensão Live Server do VS Code). O Service Worker não funciona abrindo `index.html` diretamente via `file://`.

## Observação sobre a chave Gemini

A versão original continha uma chave de API embutida no JavaScript. Nesta versão modular, o valor padrão foi removido por segurança; configure sua própria chave em **Opções → Chave API**. Se a chave original era real, revogue-a no Google AI Studio e gere outra.

## Compatibilidade

Os arquivos JavaScript são carregados como scripts clássicos em ordem, preservando as funções globais usadas pelos atributos `onclick` e `onsubmit` do HTML original.
