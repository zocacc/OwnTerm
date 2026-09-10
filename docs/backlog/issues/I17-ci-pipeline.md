# I17 — Paralelizar e acelerar os PR Gates

**Status:** planned
**GitHub:** [#40](https://github.com/zocacc/OwnTerm/issues/40)
**Dependências:** I11

## Objetivo

Reduzir o tempo de feedback sem pular validações de código.

## Escopo

- Dividir a qualidade Linux em frontend, qualidade Rust e testes Rust independentes.
- Adicionar cache Rust por SO, toolchain e lockfile.
- Cancelar runs supersedidos por PR ou branch.
- Preservar execução integral da suíte para todo PR de código.

## Critérios de aceite

- [ ] Contexts dos PR Gates são estáveis e executam em paralelo.
- [ ] Cache quente é observado em Linux e Windows.
- [ ] Um novo commit cancela a execução em andamento do mesmo PR.
- [ ] Gates rápidos ficam em até 5 minutos e a suíte completa em até 10 minutos, excluindo fila.

## Testes

- [ ] Medição documentada de cache miss e cache hit.
- [ ] Execução supersedida observada como cancelada.
- [ ] Falhas de frontend, Rust lint e Rust tests bloqueiam separadamente.
