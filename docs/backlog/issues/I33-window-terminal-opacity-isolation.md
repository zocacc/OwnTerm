# I33 — Isolar chromeOpacity de terminalBackgroundOpacity

- Estado: `in progress`
- Épico: E13
- Dependências: I28, I29, I30

## Escopo

Auditar persistência, CSS variables e `Terminal.options.theme`. Aplicar `chromeOpacity` somente a materiais CSS do chrome e `terminalBackgroundOpacity` somente ao RGBA de fundo xterm. Remover uso de alpha native/layered que compõe toda a WebView. Cobrir serialização, migração e atualização independente com testes.

## Aceite

- 100% de janela + 55% de terminal produz terminal visivelmente translúcido.
- 55% de janela + 100% de terminal produz terminal sólido.
- A atualização não reinicia sessão, não perde scrollback e não torna texto/cursor transparentes.
