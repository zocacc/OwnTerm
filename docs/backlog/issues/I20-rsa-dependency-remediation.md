# I20 — Remediar dependência RSA auditada

**Status:** ready
**GitHub:** [#44](https://github.com/zocacc/OwnTerm/issues/44)
**Dependências:** I18

## Objetivo

Eliminar a exceção temporária para RUSTSEC-2023-0071 sem degradar silenciosamente a autenticação SSH por chave privada.

## Contexto

`russh 0.63.2` e `ssh-key` trazem `rsa 0.10.0-rc.18`, alvo da advisory de timing Marvin. Não há atualização corretiva disponível na cadeia atual.

## Escopo

- Avaliar atualização de `russh`/`ssh-key` que remova a advisory.
- Se não houver atualização, decidir explicitamente entre retirar RSA do MVP ou manter uma mitigação aceita e documentada.
- Remover a exceção do workflow quando houver correção e executar os testes SSH relevantes.

## Critérios de aceite

- [ ] `cargo audit` passa sem ignorar RUSTSEC-2023-0071, ou a decisão de produto para suporte RSA é aceita e testada.
- [ ] A exceção não vence sem issue aberta e data de revisão.
- [ ] Autenticação por chave privada suportada pelo MVP continua coberta por fixture local.
