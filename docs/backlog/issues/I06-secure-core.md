# I06 — Implementar domínio, persistência e segurança

**Status:** planned
**Dependências:** I02, I03, I04, I05

## Objetivo

Entregar entidades, migrations e adapters que persistem configuração sem persistir segredos.

## Escopo

- [ ] Implementar Host, Host Group, Session Descriptor, Shell Profile, Credential Ref e Known Host.
- [ ] Criar migrations SQLite e repositories de Hosts/grupos/tags/settings/recentes/Known Hosts.
- [ ] Implementar Secrets Store e limpeza de referências órfãs.
- [ ] Implementar trust store e logs sanitizados.

## Fora do escopo

Interface de Hosts, conexão SSH e importador.

## Critérios de aceite

- [ ] Banco novo e migrations aplicam schema esperado sem colunas de segredo.
- [ ] Grupo é de um nível e remoção exige regra explícita para Hosts associados.
- [ ] Fingerprint inédita/alterada segue o threat model.
- [ ] Falha de cofre não persiste valor alternativo.

## Testes

- [ ] Unidade de domínio, integração SQLite/migrations e fake de cofre.
- [ ] Snapshot de logs/erros sem segredos.
