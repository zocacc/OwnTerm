# I14 — Adaptar terminal nativo ao port

**Status:** in progress
**Dependências:** I13

## Objetivo

Fazer o adapter PTY existente implementar o port de terminal sem perder comportamento Windows e Linux.

## Escopo

- [ ] Expor `NativeTerminalBackend` e internalizar catálogo/gerenciador de sessões.
- [ ] Separar descoberta Windows/WSL, Unix e particularidade ConPTY em módulos internos.
- [ ] Preservar batching, backpressure, output antes de exit e close idempotente.

## Fora do escopo

SSH, split panes, persistência de saída e registry dinâmico de backends.

## Critérios de aceite

- [ ] O adapter implementa descoberta, start, write, resize e close pelo port.
- [ ] Windows preserva PowerShell/CMD/WSL e o workaround ConPTY.
- [ ] Linux executa shell Unix em PTY real.

## Testes

- [ ] Integração PTY real cobre I/O, resize, exit code e close.
- [ ] Smoke Windows cobre PowerShell, CMD e manager de produção.
