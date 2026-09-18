# I26 — Fechar regressão, acessibilidade e QA Windows

- **Status:** in progress
- **GitHub:** [#62](https://github.com/zocacc/OwnTerm/issues/62)
- **Dependências:** I22, I23, I24, I25
**Epic:** [E11 — Shell terminal-first](../epics/E11-terminal-first-shell.md)

## Objetivo

Validar o shell terminal-first como um fluxo integrado, cobrindo regressões funcionais, acessibilidade, lifecycle de sessões e comportamento nativo no Windows 11.

## Escopo

- [x] Consolidar testes de integração do AppShell após extrações.
- [x] Cobrir abertura local, Host salvo, Quick Connect, trust, credencial, falha, reconexão e fechamento.
- [x] Verificar que gaveta/menu não desmontam xterm ou chamam lifecycle indevido.
- [x] Auditar teclado, foco, roles, names, estados e `aria-live`.
- [ ] Validar janela normal, mínima, maximizada e restaurada.
- [ ] Validar PowerShell, CMD, WSL detectado e SSH em build Windows.
- [x] Validar Acrylic, fallback opaco, reduced transparency/motion e DPI.
- [ ] Executar lint, typecheck, testes frontend, testes Rust relevantes e build.
- [x] Registrar screenshots e checklist manual no PR da entrega.
- [x] Atualizar documentação se a implementação exigir desvio da spec.

## Evidência Windows

Use [E11 Windows acceptance](../../qa/E11-windows-acceptance.md) no artefato do CI; marque resultados e anexe somente screenshots sanitizados ao PR.

## Matriz mínima manual

| Cenário | Evidência esperada |
| --- | --- |
| Primeira abertura | gaveta fechada e estado vazio utilizável |
| Sessão local | terminal preenche workspace e aceita I/O |
| Duas sessões | troca preserva saída/scrollback |
| Gaveta repetida | nenhum remount, resize indevido ou perda de sessão |
| SSH novo | trust e credencial mantêm foco/segurança |
| SSH falho | erro textual e reconexão alcançável |
| Janela mínima | tabs/ações/controles sem sobreposição |
| Material indisponível | fallback opaco legível |

## Fora do escopo

Adicionar funcionalidades novas, corrigir problemas não relacionados sem issue própria ou ampliar suporte oficial além do Windows 11.

## Critérios de aceite

- [ ] Todos os critérios globais da spec estão marcados com evidência.
- [ ] Testes automatizados e build Windows passam.
- [x] Nenhum segredo ou conteúdo de terminal aparece em logs, toast ou screenshot de teste.
- [x] Não há regressão em CRUD, portabilidade, sessões locais ou SSH.
- [x] Navegação essencial funciona sem mouse.
- [ ] Evidência visual cobre estados-chave e fallback.

## Entrega observável

Epic E11 pronto para integração, com comportamento funcional e visual verificado no Windows 11.
