# Spec — Garantia de CI/CD

## Objetivo

Entregar feedback rápido e confiável para mudanças do OwnTerm, sem reduzir a cobertura dos caminhos Windows e sem confundir evidência de integração com publicação de produto.

## Modelo operacional

- Um **PR Gate** bloqueia a integração quando falha. Todo PR de código executa a mesma suíte obrigatória; a seleção por paths não é usada.
- Gates rápidos são frontend, qualidade Rust, testes Rust e validações de segurança. Eles começam em paralelo com os checks Windows.
- O build, instalação e inicialização do instalador NSIS no Windows são PR Gates.
- Uma **Integration Evidence** é criada somente para o commit integrado em `develop`, fica disponível por 14 dias e não é publicada como Release.
- Um novo commit no mesmo PR ou branch cancela a execução anterior ainda em andamento.

## Gates obrigatórios

| Check | Gatilho | Evidência |
| --- | --- | --- |
| Frontend quality | PR, `develop`, `main` | lint, tipos, testes, build e formatação |
| Rust quality | PR, `develop`, `main` | rustfmt e Clippy |
| Rust tests | PR, `develop`, `main` | testes workspace e check do desktop |
| Windows ConPTY smoke | PR, `develop`, `main` | PTY, adapters e fixture SSH local |
| Windows build | PR, `develop`, `main` | NSIS gerado, instalado e iniciado |
| Workflow lint | PR, `develop`, `main` | sintaxe dos workflows |
| Secret scan | PR, `develop`, `main` | ausência de segredos versionados |
| Dependency audit | PR, `develop`, `main`, agenda e manual | nenhuma vulnerabilidade alta; exceções explícitas e rastreadas |

## Governança

`develop` e `main` exigem Pull Request atualizada, uma aprovação e todos os PR Gates verdes; pushes diretos são bloqueados. PRs para `main` devem partir exclusivamente de `develop`.

A configuração remota é aplicada depois de os novos workflows existirem em `develop`; antecipá-la bloquearia PRs legítimos por contexts inexistentes. A execução usa os contexts estáveis definidos nesta spec.

## Fora do escopo

Assinatura de código, publicação de GitHub Release, E2E nativo da interface Windows, telemetria e suporte oficial multiplataforma.

## Critérios de aceite

- [ ] Gates rápidos terminam em até 5 minutos com cache quente, medidos pela duração do job.
- [ ] A suíte completa do PR termina em até 10 minutos com cache quente, sem considerar tempo de fila do GitHub-hosted runner.
- [ ] Um commit supersedido cancela sua execução anterior.
- [ ] Falhas de formato, testes, segredo, dependência vulnerável, workflow inválido e instalador que não inicia bloqueiam o gate correspondente.
- [ ] Apenas o build validado de `develop` produz Integration Evidence, com retenção de 14 dias.
- [ ] `develop` e `main` rejeitam push direto, merge sem aprovação ou sem todos os checks requeridos.
