# I21 — Extrair barra superior unificada e abas compactas

- **Status:** in progress
- **GitHub:** [#57](https://github.com/zocacc/OwnTerm/issues/57)
- **Dependências:** I08
**Epic:** [E11 — Shell terminal-first](../epics/E11-terminal-first-shell.md)

## Objetivo

Transformar a title bar atual no único chrome permanente do OwnTerm, removendo a coluna reservada à marca e preparando pontos de integração para gaveta e launcher.

## Escopo

- [x] Extrair `UnifiedTitleBar` de `App.tsx` sem mover ownership de sessões para o componente.
- [x] Criar subcomponentes tipados para trigger de conexões, tabs, ações de nova sessão, drag region e controles da janela.
- [x] Posicionar o trigger da gaveta como primeiro controle à esquerda.
- [x] Remover a largura fixa da brand; manter identidade no ícone/tela vazia.
- [x] Preservar `WindowControls`, preparação segura do custom chrome e fallback nativo.
- [x] Aplicar semântica e navegação de tabs coerentes.
- [x] Exibir tipo/título/status/fechar em cada aba com nome acessível textual.
- [x] Garantir overflow horizontal de tabs sem cobrir launcher ou controles da janela.
- [x] Manter seleção/foco e política de aba vizinha após fechamento.

## Fora do escopo

Gaveta funcional, menu completo de perfis, remoção da status bar, reordenação e persistência de abas.

## Decisões de implementação

- `App` continua proprietário de `sessions`, `activeSessionId`, abertura e fechamento.
- `UnifiedTitleBar` recebe descriptors e callbacks; não chama backend diretamente.
- Chaves React permanecem `session.id` para impedir remount acidental.
- Somente regiões vazias recebem `data-tauri-drag-region`.

## Critérios de aceite

- [x] A barra mede entre `40px` e `44px` e é o topo único da aplicação.
- [ ] Trigger, tabs, ações, drag region e controles coexistem em `800px` de largura.
- [x] Cada status tem texto acessível além da cor.
- [x] Trocar/fechar aba preserva comportamento e foco atuais.
- [ ] Ausência de custom chrome mantém a title bar nativa utilizável.
- [x] Nenhuma ação visual cria ou encerra sessão.

## Testes

- [x] Renderização sem sessões, com uma sessão e com várias sessões.
- [ ] Seleção, fechamento da ativa/inativa e overflow.
- [x] Labels por status e navegação por teclado.
- [ ] Regressão de `WindowControls` e áreas arrastáveis em teste/manual Tauri.

## Entrega observável

Barra superior pronta para receber gaveta e launcher, com abas operáveis e sem coluna fixa de marca.
