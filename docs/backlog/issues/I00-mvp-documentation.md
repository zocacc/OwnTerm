# I00 — Consolidar documentação do MVP

**Status:** done
**Dependências:** nenhuma

## Objetivo

Versionar o contexto, o glossário, as specs, ADRs e o backlog que definem o MVP.

## Escopo

- [x] Registrar linguagem canônica em `CONTEXT.md`.
- [x] Criar escopo, arquitetura, IPC, segurança e specs de capacidade.
- [x] Criar ADRs para limites difíceis de reverter.
- [x] Criar épicos, issues e sub-issues ordenados.

## Fora do escopo

Scaffold, código de produto e publicação remota de issues.

## Critérios de aceite

- [x] Toda capacidade obrigatória do contexto possui spec e issue rastreável.
- [x] Decisões aceitas não conflitam com o glossário ou com o threat model.
- [x] Backlog explicita dependências e testes.

## Testes

- [x] Links Markdown internos e referências de IDs validados.

## Evidências

- Glossário: [`CONTEXT.md`](../../../CONTEXT.md).
- Escopo, arquitetura, IPC e segurança: [`docs/`](../../).
- Decisões: [`docs/adr/`](../../adr/).
- Specs, épicos, issues e dependências: [`docs/backlog/README.md`](../README.md).
