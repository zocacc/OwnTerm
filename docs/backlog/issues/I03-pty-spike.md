# I03 — Validar PTY e shells Windows

**Status:** planned  
**Dependências:** I01

## Objetivo

Provar o comportamento de PTY necessário para sessões locais antes de acoplá-lo ao produto.

## Escopo

- [ ] Abrir PowerShell e CMD em PTY no Windows 11.
- [ ] Exercitar entrada, ANSI, resize, encerramento e exit code.
- [ ] Detectar WSL sem tratá-lo como obrigatório.
- [ ] Registrar limitações e decisão de adapter.

## Fora do escopo

Interface final de abas ou shells configuráveis.

## Critérios de aceite

- [ ] Evidência automatizada/manual reproduzível cobre o ciclo de vida do PTY.
- [ ] Falhas e limitações atualizam spec/ADR antes de I07.

## Testes

- [ ] Smoke Windows com PowerShell e CMD.
