# I22 — Persistir e aplicar Appearance Preferences

**Status:** in progress
**GitHub:** [#50](https://github.com/zocacc/OwnTerm/issues/50)
**Dependências:** I21

## Objetivo

Criar o contrato local e tipado para carregar, validar, persistir e aplicar as duas Appearance Preferences.

## Escopo

- [x] Implementar `AppearanceSettings` com percentuais inteiros, padrões e faixas definidas na spec.
- [x] Persistir as chaves locais `appearance.windowOpacity` e `appearance.terminalBackgroundOpacity`.
- [x] Expor IPC de leitura/gravação e capacidade nativa de Window Opacity.
- [x] Aplicar Window Opacity ao vivo e retornar fallback sólido com aviso não bloqueante.
- [x] Garantir que export/import continue excluindo essas chaves.

## Fora do escopo

Layout do diálogo, controles React e alteração do fundo xterm.

## Critérios de aceite

- [x] Ausência, valor inválido ou fora da faixa produz os padrões sem erro silencioso.
- [x] Preferências válidas sobrevivem ao reinício e não alteram Workspace Export/Import.
- [x] O contrato permanece independente de React e de APIs nativas fora do adapter.

## Testes

- [x] Unitários de validação e storage.
- [x] Testes de contrato IPC e fallback (contrato de resposta; validação manual Windows segue dependente do I21).
- [x] Regressão de portabilidade.


> A implementação está pronta para revisão, mas permanece `in progress` até a evidência Windows 10/11 do I21 ser registrada.
