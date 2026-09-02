# I08 — Entregar Hosts, Quick Connect e AppShell

**Status:** planned
**Dependências:** I06, I07

## Objetivo

Entregar a experiência de primeira execução e o gerenciamento pesquisável de Hosts.

## Escopo

- [ ] Construir AppShell com tokens, sidebar, busca, tab bar e status.
- [ ] Implementar CRUD de Host/grupo, tags, favoritos, recentes e confirmação de exclusão.
- [ ] Salvar Credential References pelo formulário sem manter segredo no estado.
- [ ] Implementar Quick Connect e onboarding de primeira execução.

## Fora do escopo

Conexão SSH real, grupos aninhados e temas configuráveis.

## Critérios de aceite

- [ ] CRUD persiste e busca encontra todos os campos prometidos.
- [ ] Exclusão não remove Hosts implicitamente ao remover grupo.
- [ ] Quick Connect encaminha para o mesmo caso de uso de sessão futura.
- [ ] Onboarding permite ignorar importação e abrir shell local.

## Testes

- [ ] Componentes/formulários, repository e E2E mockado de primeira execução.
