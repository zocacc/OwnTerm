# Backlog do MVP

## Convenções

- Épicos usam `E##`; issues usam `I##`; sub-issues aparecem como checkboxes em cada issue.
- Uma issue só inicia quando suas dependências estiverem concluídas e seus spikes aplicáveis tiverem evidência registrada.
- Cada issue produz entrega observável, testes e atualização documental quando altera contrato ou decisão.
- Estados permitidos: `planned`, `ready`, `in progress`, `blocked`, `done`.

## Ordem de execução

| Etapa | Épico | Issues | Dependência |
| --- | --- | --- | --- |
| 0 | E00 Base documental | I00 | nenhuma |
| 1 | E01 Fundação | I01–I02 | I00 |
| 2 | E02 Spikes | I03–I05 | I01 |
| 3 | E03 Core seguro | I06 | I02, I03–I05 |
| 4 | E04 Terminal local | I07 | I06 |
| 4.5 | E09 Borda de plataforma | I12–I16 | I06–I07 |
| 5 | E05 Hosts e interface | I08 | I06–I07, I16 |
| 6 | E06 SSH | I09 | I06, I04, I08, I16 |
| 7 | E07 Portabilidade | I10 | I06, I08 |
| 8 | E08 Hardening/release | I11 | I07–I10 |

`I03`, `I04` e `I05` podem ocorrer em paralelo. Nenhuma integração em `main` deve ocorrer diretamente da feature: a sequência local é `feature → develop → main`.
