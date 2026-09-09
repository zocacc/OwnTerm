# I09 — Entregar sessões SSH seguras

**Status:** completed
**Dependências:** I04, I06, I08, I16

## Objetivo

Conectar um Host salvo em terminal SSH interativo com autenticação e confiança seguras.

## Escopo

- [x] Resolver Host, Credential Reference e chave local no application service.
- [x] Implementar estados, trust confirmation, senha/chave/passphrase e terminal remoto.
- [x] Implementar entrada, saída, resize, timeout, cancelamento e reconexão manual.
- [x] Atualizar recentes somente após conexão bem-sucedida.

## Fora do escopo

Agent funcional, SFTP, port forwarding, accept-once e reconexão automática.

## Critérios de aceite

- [x] Servidor local de teste valida ambos métodos de autenticação.
- [x] Fingerprint nova exige confirmação; alterada bloqueia a abertura.
- [x] Cancelamento e erro liberam recursos; reconexão não reutiliza handle anterior.

## Testes

- [x] Integração SSH local, transições de estado e E2E mockado de trust/reconnect.
