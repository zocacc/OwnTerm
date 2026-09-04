# I08 — Entregar Hosts, Quick Connect e AppShell

**Status:** completed
**Dependências:** I06, I07, I16

## Objetivo

Entregar a experiência de primeira execução e o gerenciamento pesquisável de Hosts.

## Escopo

- [x] Construir AppShell com tokens, sidebar, busca, tab bar e status.
- [x] Implementar CRUD de Host/grupo, tags, favoritos, recentes e confirmação de exclusão.
- [x] Salvar Credential References pelo formulário sem manter segredo no estado.
- [x] Implementar Quick Connect e onboarding de primeira execução.

## Fora do escopo

Conexão SSH real, grupos aninhados e temas configuráveis.

## Critérios de aceite

- [x] CRUD persiste e busca encontra todos os campos prometidos.
- [x] Exclusão não remove Hosts implicitamente ao remover grupo.
- [x] Quick Connect encaminha para o mesmo caso de uso de sessão futura.
- [x] Onboarding permite ignorar importação e abrir shell local.

## Testes

- [x] Componentes/formulários, repository e E2E mockado de primeira execução.
