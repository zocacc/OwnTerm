# I09 — Entregar sessões SSH seguras

**Status:** planned
**Dependências:** I04, I06, I08

## Objetivo

Conectar um Host salvo em terminal SSH interativo com autenticação e confiança seguras.

## Escopo

- [ ] Resolver Host, Credential Reference e chave local no application service.
- [ ] Implementar estados, trust confirmation, senha/chave/passphrase e terminal remoto.
- [ ] Implementar entrada, saída, resize, timeout, cancelamento e reconexão manual.
- [ ] Atualizar recentes somente após conexão bem-sucedida.

## Fora do escopo

Agent funcional, SFTP, port forwarding, accept-once e reconexão automática.

## Critérios de aceite

- [ ] Servidor local de teste valida ambos métodos de autenticação.
- [ ] Fingerprint nova exige confirmação; alterada bloqueia a abertura.
- [ ] Cancelamento e erro liberam recursos; reconexão não reutiliza handle anterior.

## Testes

- [ ] Integração SSH local, transições de estado e E2E mockado de trust/reconnect.
