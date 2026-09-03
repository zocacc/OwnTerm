# I07 — Entregar sessões locais em abas

**Status:** completed
**Dependências:** I06

## Objetivo

Entregar o primeiro fluxo vertical de terminal local operável pela interface.

## Escopo

- [x] Detectar Shell Profiles e abrir PowerShell/CMD; exibir WSL se disponível.
- [x] Implementar session manager, commands e eventos tipados.
- [x] Integrar xterm, tab bar, status, resize, copiar/colar e fechamento.

## Fora do escopo

Hosts persistidos, SSH, split panes e perfis personalizados.

## Critérios de aceite

- [x] Usuário abre, alterna e fecha abas locais interativas.
- [x] Resize chega ao PTY e exit code é mostrado quando disponível.
- [x] Eventos atrasados não reabrem ou alteram aba encerrada.

## Testes

- [x] Integração PTY Windows e componentes de abas/status.

## Evidência

- `ownterm-terminal` detecta shells, mantém handles somente no backend e testa input, output binário, resize, close idempotente e exit code com PTY real.
- O job Windows executa o smoke PowerShell/CMD e o session manager produtivo com CMD/ConPTY.
- Os testes React cobrem abertura, troca, fechamento, exit code, eventos atrasados, batching, resize e clipboard.
- O IPC preserva bytes em arrays numéricos; entrada e saída usam batching e a fila de saída é limitada para aplicar backpressure.
