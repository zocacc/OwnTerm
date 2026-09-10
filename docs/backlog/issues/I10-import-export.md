# I10 — Entregar importação e exportação

**Status:** done
**Dependências:** I06, I08

## Objetivo

Entregar portabilidade previsível para configurações OpenSSH e workspaces OwnTerm.

## Escopo

- [x] Parsear aliases concretos e campos permitidos de SSH config.
- [x] Exibir prévia com diretivas ignoradas, criações e conflitos.
- [x] Aplicar criar/atualizar/ignorar transacionalmente.
- [x] Exportar/reimportar JSON versionado sem segredo, referência de cofre ou Known Host.

## Fora do escopo

Padrões, Include, ProxyJump, merge automático e backup criptografado.

## Critérios de aceite

- [x] Falha não deixa importação parcial.
- [x] Exportação valida schemaVersion e não contém campos sensíveis.
- [x] Reimportação identifica que credenciais precisam ser configuradas no destino.

## Testes

- [x] Fixtures OpenSSH, conflito/rollback e inspeção de JSON seguro.
