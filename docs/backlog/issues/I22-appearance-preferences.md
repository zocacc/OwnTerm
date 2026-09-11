# I22 — Persistir e aplicar Appearance Preferences

**Status:** planned
**GitHub:** [#50](https://github.com/zocacc/OwnTerm/issues/50)
**Dependências:** I21

## Objetivo

Criar o contrato local e tipado para carregar, validar, persistir e aplicar as duas Appearance Preferences.

## Escopo

- [ ] Implementar `AppearanceSettings` com percentuais inteiros, padrões e faixas definidas na spec.
- [ ] Persistir as chaves locais `appearance.windowOpacity` e `appearance.terminalBackgroundOpacity`.
- [ ] Expor IPC de leitura/gravação e capacidade nativa de Window Opacity.
- [ ] Aplicar Window Opacity ao vivo e retornar fallback sólido com aviso não bloqueante.
- [ ] Garantir que export/import continue excluindo essas chaves.

## Fora do escopo

Layout do diálogo, controles React e alteração do fundo xterm.

## Critérios de aceite

- [ ] Ausência, valor inválido ou fora da faixa produz os padrões sem erro silencioso.
- [ ] Preferências válidas sobrevivem ao reinício e não alteram Workspace Export/Import.
- [ ] O contrato permanece independente de React e de APIs nativas fora do adapter.

## Testes

- [ ] Unitários de validação e storage.
- [ ] Testes de contrato IPC e fallback.
- [ ] Regressão de portabilidade.
