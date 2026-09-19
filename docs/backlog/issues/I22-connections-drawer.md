# I22 — Converter Connections em gaveta acessível

- **Status:** in progress
- **GitHub:** [#58](https://github.com/zocacc/OwnTerm/issues/58)
- **Dependências:** I21
**Epic:** [E11 — Shell terminal-first](../epics/E11-terminal-first-shell.md)

## Objetivo

Retirar activity rail e sidebar do fluxo permanente do layout, preservando todas as capacidades de `HostsWorkspace` em uma gaveta sobreposta e fechada por padrão.

## Escopo

- [x] Criar `ConnectionsDrawer` com painel, backdrop, título e controle de fechar.
- [x] Montar `HostsWorkspace` dentro da gaveta sem duplicar CRUD, busca ou portabilidade.
- [x] Iniciar `connectionsDrawerOpen` como `false` a cada inicialização.
- [x] Sobrepor o terminal com largura responsiva entre `280px` e `min(360px, 90vw)`.
- [x] Abrir pelo trigger da title bar e por `Ctrl+B`.
- [x] Fazer `Ctrl+F` abrir e focar busca; `Ctrl+Shift+C`, Quick Connect.
- [x] Fechar por `Escape`, backdrop, botão e abertura bem-sucedida de sessão.
- [x] Manter aberta durante formulários, import/export e confirmações destrutivas.
- [x] Restaurar foco ao trigger ao fechar e definir foco inicial previsível.
- [x] Remover `activity-rail` e a sidebar do flex layout principal.
- [x] Respeitar reduced motion e limitar transição normal a `180ms`.

## Fora do escopo

Redesenhar o domínio de Hosts, grupos aninhados, novo state manager ou alterar contratos backend.

## Invariantes

- Alternar a gaveta não desmonta `TerminalSurface`.
- Alternar a gaveta não chama métodos de lifecycle de sessão.
- Um diálogo crítico aberto pela gaveta não pode coexistir com um segundo trap de foco.

## Critérios de aceite

- [x] A gaveta está fechada na primeira renderização.
- [ ] Abrir a gaveta não muda largura/colunas do terminal ativo.
- [x] Busca, Quick Connect, CRUD, recentes, grupos e import/export continuam acessíveis.
- [x] Ao conectar com sucesso por Host/Quick Connect, a gaveta fecha e o terminal recebe foco.
- [x] Falha de conexão mantém contexto suficiente para tentar novamente.
- [x] Foco e teclado atendem a spec em mouse e teclado.

## Testes

- [x] Estado inicial, trigger, backdrop, `Escape` e atalhos.
- [x] Foco inicial/restaurado e interação com diálogos internos.
- [x] Sessão/`TerminalSurface` mantém a mesma instância ao alternar a gaveta.
- [x] Host salvo, Quick Connect e abrir shell local pela gaveta.

## Entrega observável

Terminal usa toda a largura por padrão; gerenciamento completo aparece somente ao abrir a gaveta.
