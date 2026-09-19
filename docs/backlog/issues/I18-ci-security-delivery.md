# I18 — Validar segurança e entrega

**Status:** planned
**GitHub:** [#41](https://github.com/zocacc/OwnTerm/issues/41)
**Dependências:** I11

## Objetivo

Bloquear mudanças inseguras e provar que o instalador Windows pode ser instalado e iniciado.

## Escopo

- Validar sintaxe de workflows e segredos versionados.
- Auditar dependências de severidade alta em PRs, integrações, agenda e execução manual.
- Gerar NSIS, instalar silenciosamente, localizar o executável, iniciá-lo e encerrá-lo no smoke Windows.

## Fora do escopo

Assinatura, publicação, varredura de infraestrutura e E2E nativo da interface.

## Critérios de aceite

- [ ] Workflow inválido, segredo detectado e dependência vulnerável falham no PR.
- [ ] Auditoria de dependências roda em `develop`, `main`, agenda e sob demanda; exceções temporárias são documentadas e rastreadas.
- [ ] Executável ausente ou que encerra antes do timeout falha no smoke NSIS.

## Testes

- [ ] Fixtures de falha controlada para cada gate de segurança.
- [ ] Run Windows verde registra instalação e inicialização do executável.
