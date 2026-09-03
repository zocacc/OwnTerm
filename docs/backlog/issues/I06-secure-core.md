# I06 — Implementar domínio, persistência e segurança

**Status:** completed
**Dependências:** I02, I03, I04, I05

## Objetivo

Entregar entidades, migrations e adapters que persistem configuração sem persistir segredos.

## Escopo

- [x] Implementar Host, Host Group, Session Descriptor, Shell Profile, Credential Ref e Known Host.
- [x] Criar migrations SQLite e repositories de Hosts/grupos/tags/settings/recentes/Known Hosts.
- [x] Implementar Secrets Store e limpeza de referências órfãs.
- [x] Implementar trust store e logs sanitizados.

## Fora do escopo

Interface de Hosts, conexão SSH e importador.

## Critérios de aceite

- [x] Banco novo e migrations aplicam schema esperado sem colunas de segredo.
- [x] Grupo é de um nível e remoção exige regra explícita para Hosts associados.
- [x] Fingerprint inédita/alterada segue o threat model.
- [x] Falha de cofre não persiste valor alternativo.

## Testes

- [x] Unidade de domínio, integração SQLite/migrations e fake de cofre.
- [x] Snapshot de logs/erros sem segredos.

## Evidência

- `cargo test -p ownterm-domain -p ownterm-application -p ownterm-storage-sqlite`
- `cargo clippy -p ownterm-domain -p ownterm-application -p ownterm-storage-sqlite --all-targets -- -D warnings`
- O desktop ainda não expõe CRUD; commands e interface pertencem a I08.
