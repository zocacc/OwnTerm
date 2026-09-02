# I10 — Entregar importação e exportação

**Status:** planned  
**Dependências:** I06, I08

## Objetivo

Entregar portabilidade previsível para configurações OpenSSH e workspaces OwnTerm.

## Escopo

- [ ] Parsear aliases concretos e campos permitidos de SSH config.
- [ ] Exibir prévia com diretivas ignoradas, criações e conflitos.
- [ ] Aplicar criar/atualizar/ignorar transacionalmente.
- [ ] Exportar/reimportar JSON versionado sem segredo, referência de cofre ou Known Host.

## Fora do escopo

Padrões, Include, ProxyJump, merge automático e backup criptografado.

## Critérios de aceite

- [ ] Falha não deixa importação parcial.
- [ ] Exportação valida schemaVersion e não contém campos sensíveis.
- [ ] Reimportação identifica que credenciais precisam ser configuradas no destino.

## Testes

- [ ] Fixtures OpenSSH, conflito/rollback e inspeção de JSON seguro.
