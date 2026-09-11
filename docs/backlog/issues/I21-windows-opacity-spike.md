# I21 — Validar composição e opacidade de janela no Windows

**Status:** planned
**GitHub:** [#49](https://github.com/zocacc/OwnTerm/issues/49)
**Dependências:** I16

## Objetivo

Descobrir e validar o adapter nativo necessário para Window Opacity em Windows 10 e 11, sem acoplar React ou o domínio a APIs de sistema.

## Escopo

- [ ] Provar aplicação, atualização, restauração e detecção de capacidade da opacidade nativa.
- [ ] Registrar matriz Windows 10/11, comportamento de erro e impacto de decorations/window effects.
- [ ] Definir o contrato que retorna capacidade indisponível e mantém fallback sólido.
- [ ] Atualizar a spec e criar ADR somente se a decisão tiver trade-off duradouro.

## Fora do escopo

Persistência, diálogo Appearance, opacidade do canvas xterm e publicação de Release.

## Critérios de aceite

- [ ] Evidência reproduzível identifica o mecanismo escolhido ou confirma fallback por plataforma.
- [ ] Falha nativa não encerra o app nem deixa a janela ilegível.

## Testes

- [ ] Harness/fixture de sucesso e falha do adapter.
- [ ] Verificação manual em Windows 10 e 11.
