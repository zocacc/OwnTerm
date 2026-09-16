# I23 — Implementar launcher de novas sessões

- **Status:** planned
- **GitHub:** [#59](https://github.com/zocacc/OwnTerm/issues/59)
- **Dependências:** I21
**Epic:** [E11 — Shell terminal-first](../epics/E11-terminal-first-shell.md)

## Objetivo

Substituir o `select` invisível de Shell Profile por um launcher explícito, acessível e rápido para perfis locais e jornadas de conexão.

## Escopo

- [ ] Manter o botão `+` como abertura direta do perfil padrão selecionado.
- [ ] Criar botão adjacente para abrir menu de sessões.
- [ ] Listar dinamicamente todos os `ShellProfile` disponíveis com nome e tipo.
- [ ] Incluir “Connections…” e “Quick Connect…” como intenções para a gaveta.
- [ ] Suportar setas, `Home`, `End`, `Enter`, `Space` e `Escape`.
- [ ] Fechar menu após seleção e devolver foco de modo previsível.
- [ ] Implementar `Ctrl+Shift+P` para abrir o launcher.
- [ ] Preservar `Ctrl+Shift+T` para abrir o perfil padrão.
- [ ] Comunicar loading/indisponibilidade sem opção fantasma.
- [ ] Eliminar `.shell-picker select` e estilos associados.

## Fora do escopo

Command palette geral, perfis personalizados, editar shell, rename de aba ou persistência do perfil padrão.

## Decisões de implementação

- A seleção do perfil encaminha ao mesmo caso de uso existente de `startLocalSession`.
- O componente emite intenção; `App` continua chamando o backend e tratando erros.
- Se só existir um perfil, o menu ainda oferece Connections e Quick Connect.

## Critérios de aceite

- [ ] `+` abre o perfil padrão em um clique.
- [ ] Qualquer perfil detectado pode ser aberto pelo menu.
- [ ] Connections e Quick Connect abrem a gaveta no contexto correto.
- [ ] O menu funciona integralmente por teclado e expõe roles/names apropriados.
- [ ] Cliques repetidos durante `opening` não criam sessões duplicadas.

## Testes

- [ ] Zero, um e múltiplos perfis.
- [ ] Abertura por botão e atalhos.
- [ ] Navegação/seleção/fechamento por teclado.
- [ ] Bloqueio durante preparação de eventos e durante abertura.
- [ ] Integração com callback local e intenções da gaveta.

## Entrega observável

Usuário abre o perfil padrão em um clique ou escolhe qualquer shell/conexão em menu compacto na title bar.
