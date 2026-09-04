# I16 — Compor adapters na borda desktop

**Status:** in progress
**Dependências:** I14, I15

## Objetivo

Montar adapters nativos exclusivamente no backend Tauri e proteger a fronteira por CI.

## Escopo

- [ ] Fazer `DesktopState` depender de `NativeTerminalBackend` e `SystemVault`.
- [ ] Preservar comandos/eventos de sessão e DTOs existentes.
- [ ] Remover o adapter de cofre duplicado do app.
- [ ] Validar workspace no Linux, smoke ConPTY e build NSIS no Windows.

## Fora do escopo

Novos comandos públicos, mudança de payload, migração SQLite ou UI multiplataforma.

## Critérios de aceite

- [ ] Commands Tauri não instanciam PTY, keyring ou paths nativos diretamente.
- [ ] A interface não observa alteração de contrato.
- [ ] CI Linux e Windows continua verde.

## Testes

- [ ] Testes Rust, testes frontend e checks de build passam.
