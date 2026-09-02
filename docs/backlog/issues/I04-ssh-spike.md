# I04 — Validar SSH interativo e trust

**Status:** planned  
**Dependências:** I01

## Objetivo

Provar handshake SSH, autenticação, host key e terminal interativo contra servidor local determinístico.

## Escopo

- [ ] Criar fixture/servidor SSH local de teste.
- [ ] Validar senha, chave, fingerprint inédita/alterada, I/O, resize e cancelamento.
- [ ] Registrar limites de `russh` e contrato de eventos.

## Fora do escopo

Host real, credenciais reais, SFTP e ProxyJump.

## Critérios de aceite

- [ ] Teste reproduzível cobre handshake e trust sem rede externa.
- [ ] Limitações bloqueadoras são resolvidas ou atualizam ADR/spec antes de I09.

## Testes

- [ ] Integração local com identidade conhecida e identidade alterada.
