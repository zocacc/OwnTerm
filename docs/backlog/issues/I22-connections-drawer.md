# I22 — Converter Connections em gaveta acessível

- **Status:** planned
- **GitHub:** [#58](https://github.com/zocacc/OwnTerm/issues/58)
- **Dependências:** I21
**Epic:** [E11 — Shell terminal-first](../epics/E11-terminal-first-shell.md)

## Objetivo

Retirar activity rail e sidebar do fluxo permanente do layout, preservando todas as capacidades de `HostsWorkspace` em uma gaveta sobreposta e fechada por padrão.

## Escopo

- [ ] Criar `ConnectionsDrawer` com painel, backdrop, título e controle de fechar.
- [ ] Montar `HostsWorkspace` dentro da gaveta sem duplicar CRUD, busca ou portabilidade.
- [ ] Iniciar `connectionsDrawerOpen` como `false` a cada inicialização.
- [ ] Sobrepor o terminal com largura responsiva entre `280px` e `min(360px, 90vw)`.
- [ ] Abrir pelo trigger da title bar e por `Ctrl+B`.
- [ ] Fazer `Ctrl+F` abrir e focar busca; `Ctrl+Shift+C`, Quick Connect.
- [ ] Fechar por `Escape`, backdrop, botão e abertura bem-sucedida de sessão.
- [ ] Manter aberta durante formulários, import/export e confirmações destrutivas.
- [ ] Restaurar foco ao trigger ao fechar e definir foco inicial previsível.
- [ ] Remover `activity-rail` e a sidebar do flex layout principal.
- [ ] Respeitar reduced motion e limitar transição normal a `180ms`.

## Fora do escopo

Redesenhar o domínio de Hosts, grupos aninhados, novo state manager ou alterar contratos backend.

## Invariantes

- Alternar a gaveta não desmonta `TerminalSurface`.
- Alternar a gaveta não chama métodos de lifecycle de sessão.
- Um diálogo crítico aberto pela gaveta não pode coexistir com um segundo trap de foco.

## Critérios de aceite

- [ ] A gaveta está fechada na primeira renderização.
- [ ] Abrir a gaveta não muda largura/colunas do terminal ativo.
- [ ] Busca, Quick Connect, CRUD, recentes, grupos e import/export continuam acessíveis.
- [ ] Ao conectar com sucesso por Host/Quick Connect, a gaveta fecha e o terminal recebe foco.
- [ ] Falha de conexão mantém contexto suficiente para tentar novamente.
- [ ] Foco e teclado atendem a spec em mouse e teclado.

## Testes

- [ ] Estado inicial, trigger, backdrop, `Escape` e atalhos.
- [ ] Foco inicial/restaurado e interação com diálogos internos.
- [ ] Sessão/`TerminalSurface` mantém a mesma instância ao alternar a gaveta.
- [ ] Host salvo, Quick Connect e abrir shell local pela gaveta.

## Entrega observável

Terminal usa toda a largura por padrão; gerenciamento completo aparece somente ao abrir a gaveta.
