# I19 — Aplicar governança e evidência de integração

**Status:** planned
**Dependências:** I17, I18

## Objetivo

Fazer com que somente integrações verificadas avancem entre `develop` e `main`, preservando o instalador de `develop` para triagem.

## Escopo

- Exigir PR atualizada, uma aprovação e todos os PR Gates em `develop` e `main`.
- Bloquear push direto e exigir `develop` como origem de PRs para `main`.
- Reter exclusivamente o instalador validado de `develop` por 14 dias.

## Critérios de aceite

- [ ] Push direto, merge sem aprovação ou sem check verde são rejeitados.
- [ ] PR de feature para `main` falha pela política de integração.
- [ ] A Integration Evidence de `develop` fica disponível por 14 dias e nenhum artefato de PR é publicado.

## Testes

- [ ] Verificação remota das regras de branch e dos required checks.
- [ ] Run integrado confirma nome, origem e retenção do artefato.
