# I31 — TerminalWorkspace 100% sem chrome residual

- Estado: `in progress`
- Épico: E13
- Dependências: I24

## Escopo

Mapear wrappers entre `AppShell`, `TerminalWorkspace`, `TerminalSurface` e `.xterm`; remover padding, margem, borda, raio, sombra e superfícies de painel estruturais. Garantir a cadeia flex/altura e `FitAddon.fit()` após montagem, aba e resize.

## Aceite

- Abaixo da titlebar, o terminal ocupa toda a área útil sem moldura.
- Resize, abas e sessões locais/SSH não sofrem regressão.
