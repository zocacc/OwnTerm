# I07 — Entregar sessões locais em abas

**Status:** planned  
**Dependências:** I06

## Objetivo

Entregar o primeiro fluxo vertical de terminal local operável pela interface.

## Escopo

- [ ] Detectar Shell Profiles e abrir PowerShell/CMD; exibir WSL se disponível.
- [ ] Implementar session manager, commands e eventos tipados.
- [ ] Integrar xterm, tab bar, status, resize, copiar/colar e fechamento.

## Fora do escopo

Hosts persistidos, SSH, split panes e perfis personalizados.

## Critérios de aceite

- [ ] Usuário abre, alterna e fecha abas locais interativas.
- [ ] Resize chega ao PTY e exit code é mostrado quando disponível.
- [ ] Eventos atrasados não reabrem ou alteram aba encerrada.

## Testes

- [ ] Integração PTY Windows e componentes de abas/status.
