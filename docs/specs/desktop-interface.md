# Spec — Interface desktop terminal-first

## Status e rastreabilidade

- **Status:** proposed
- **Epic:** [E11 — Shell terminal-first](../backlog/epics/E11-terminal-first-shell.md)
- **Implementação:** [I21](https://github.com/zocacc/OwnTerm/issues/57)–[I26](https://github.com/zocacc/OwnTerm/issues/62)
- **Plataforma de referência:** Windows 11

## Contexto

O AppShell atual apresenta simultaneamente title bar, activity rail, sidebar de Hosts, cabeçalho da sessão e status bar. A composição expõe os recursos do produto, mas reduz a área útil e faz o OwnTerm parecer um gerenciador que contém um terminal.

O novo shell inverte essa prioridade: a sessão de terminal é a superfície principal e ocupa todo o espaço abaixo de uma única barra superior. Hosts, grupos, Quick Connect e portabilidade continuam disponíveis em uma gaveta temporária aberta sob demanda.

Esta spec substitui a composição visual anterior definida para I08. Os contratos de terminal, SSH, Hosts, segurança, persistência e IPC permanecem inalterados.

## Objetivo

Entregar uma interface compacta, dark-first e keyboard-first, inspirada na densidade operacional do Windows Terminal, sem reproduzir identidade visual ou código de terceiros.

O resultado deve:

- comunicar imediatamente que o OwnTerm é um terminal;
- manter apenas uma barra de chrome permanente;
- reservar todo o restante da janela para a sessão ativa;
- disponibilizar conexões em uma gaveta sobreposta, fechada por padrão;
- preservar sessões, buffers e handles durante mudanças puramente visuais;
- manter estados de conexão, falha e segurança claros e acessíveis.

## Princípios

1. **Terminal primeiro:** chrome permanente existe somente quando apoia a sessão ativa.
2. **Gerenciamento sob demanda:** Hosts e ações administrativas não consomem largura quando não estão em uso.
3. **Uma única hierarquia:** abas, criação de sessão e controles da janela coexistem na barra superior.
4. **Estado sem ruído:** status aparece na aba, em feedback temporário ou em diálogo quando requer decisão.
5. **Lifecycle independente do layout:** abrir gaveta, menus ou diálogos nunca desmonta `TerminalSurface` nem encerra PTY/SSH.
6. **Material progressivo:** O backdrop blur neutro melhora a aparência no Windows, mas o fallback opaco é funcional e legível.

## Arquitetura de informação

```text
AppShell
├── UnifiedTitleBar
│   ├── ConnectionsTrigger
│   ├── SessionTabs
│   ├── NewSessionLauncher
│   ├── DragRegion
│   └── WindowControls
├── TerminalWorkspace
│   ├── EmptyTerminalState
│   ├── TerminalSurface[]
│   └── TransientFeedback
├── ConnectionsDrawer
└── SecurityDialogs
```

`TerminalSurface[]` permanece montado enquanto sua sessão estiver aberta. Somente a sessão ativa fica visível e recebe foco. A ordem visual ou abertura de overlays não pode alterar a identidade do componente por `sessionId`.

## Layout

### Barra superior única

- Altura alvo: `40px`; tolerância máxima de `44px` para ajustes de hit target.
- Ocupa toda a largura da janela e substitui brand fixa, barra de abas separada e activity rail.
- Ordem: botão de conexões, abas, botão `+`, menu de perfis, região arrastável e controles da janela.
- O logotipo/nome não reserva uma coluna permanente. A identidade permanece no ícone da janela, tela vazia e About.
- Elementos interativos não recebem `data-tauri-drag-region`; somente áreas vazias e seus descendentes não interativos são arrastáveis.
- Os controles da janela preservam o fallback de title bar nativa quando custom chrome não puder ser preparado.

### Abas

- Exibem ícone/tipo, título truncado, estado e botão de fechar.
- A aba ativa usa superfície e indicador inferior; hover não pode parecer seleção.
- Estado não depende somente de cor. Nome acessível e tooltip incluem o texto de status.
- Largura alvo entre `144px` e `210px`; a área de abas usa overflow horizontal sem aumentar a altura do chrome.
- Selecionar uma aba foca seu terminal.
- Fechar a aba ativa seleciona a vizinha mais próxima, preservando o comportamento atual.
- Sessões aguardando trust/credencial continuam selecionáveis e abrem o diálogo seguro correspondente.

### Workspace de terminal

- Inicia imediatamente abaixo da barra superior.
- Não possui `session-info`, toolbar, moldura, margem externa ou status bar permanente.
- `TerminalSurface` ocupa `100%` da largura e altura disponíveis.
- Padding interno alvo: `8–12px`, pertencente à superfície do terminal, não a um cartão.
- O resize do container dispara `fitAddon.fit()` e `resizeSession` sem remount.
- O estado vazio oferece ações para abrir o perfil padrão e abrir conexões, sem simular uma sessão.

### Gaveta de conexões

- Fechada por padrão ao iniciar a aplicação.
- Abre pela esquerda sobre o terminal, sem alterar a largura do workspace.
- Largura alvo: `320px`; responsiva entre `280px` e `min(360px, 90vw)`.
- Reutiliza as funções existentes de Hosts: busca, recentes, grupos, CRUD, Quick Connect, importação/exportação e abertura local.
- Possui título acessível, botão fechar e backdrop independente dos diálogos críticos.
- Fecha ao pressionar `Escape`, clicar no backdrop ou concluir a abertura de uma sessão.
- Não fecha automaticamente durante edição, importação/exportação ou confirmação destrutiva.
- Ao fechar, o foco retorna ao botão que a abriu; ao abrir, o foco vai para a busca de Hosts.
- Em reduced motion, abre e fecha sem transição. A animação normal deve durar no máximo `180ms`.

### Launcher de nova sessão

- O botão `+` abre diretamente o perfil local padrão.
- A seta adjacente abre um menu navegável por teclado com todos os `ShellProfile` detectados.
- O menu oferece também “Connections…” e “Quick Connect…”, encaminhando à gaveta no contexto apropriado.
- O launcher não usa `select` transparente sobre um ícone.
- Perfis indisponíveis não aparecem. Durante preparação de eventos, ações ficam desabilitadas com nome acessível explicativo.

## Estado e responsabilidades

O estado do shell deve distinguir:

| Estado | Responsabilidade | Persistência |
| --- | --- | --- |
| `sessions` | descriptors e status das sessões abertas | runtime |
| `activeSessionId` | terminal/aba ativa | runtime |
| `connectionsDrawerOpen` | visibilidade da gaveta | runtime; inicia `false` |
| `newSessionMenuOpen` | visibilidade do launcher | runtime |
| `drawerIntent` | busca, Hosts ou Quick Connect | runtime |
| preferências de aparência | fonte, material e opacidade quando existirem | futura; fora desta entrega |

Hosts e terminal não devem ser duplicados em um novo store durante a refatoração. Extrações de componentes recebem callbacks e dados tipados do AppShell até existir motivação para introduzir um state manager.

## Estados operacionais e feedback

- `starting`, `awaiting_trust` e `awaiting_credential`: indicador de atenção na aba e texto acessível.
- `connected`: indicador discreto de sucesso na aba.
- `disconnected`: estado neutro; exit code é anunciado por feedback temporário.
- `failed`: indicador de erro na aba e toast persistente até ação/dispensa.
- Erros globais deixam de depender da status bar e aparecem em uma região `aria-live` como toast.
- Reconexão SSH fica disponível no toast de falha e/ou menu de contexto da aba.
- Copiar e colar continuam disponíveis por atalhos e menu de contexto do terminal; não exigem footer.
- Diálogos de trust e credencial continuam modais, com trap/restauração de foco e sem persistir segredos.

## Atalhos

| Atalho | Ação |
| --- | --- |
| `Ctrl+Shift+T` | abrir o perfil local padrão |
| `Ctrl+Shift+P` | abrir o menu de perfis/sessões |
| `Ctrl+B` | alternar a gaveta de conexões |
| `Ctrl+F` | abrir a gaveta e focar busca de Hosts |
| `Ctrl+Shift+C` | abrir a gaveta e focar Quick Connect |
| `Ctrl+Tab` | próxima aba |
| `Ctrl+Shift+Tab` | aba anterior |
| `Ctrl+W` | fechar a aba ativa, com política segura para sessão em execução |
| `Escape` | fechar o overlay não crítico mais recente |

Atalhos não devem capturar eventos destinados ao terminal quando a combinação tiver semântica esperada dentro do shell. `Ctrl+C` e `Ctrl+V` não são redefinidos globalmente.

## Aparência e materiais

- Terminal usa fundo mais sólido que a barra e a gaveta para preservar contraste.
- Barra superior e gaveta podem usar o backdrop blur neutro quando `prepare_window_chrome` confirmar suporte.
- Fallback opaco mantém mesma hierarquia, medidas e contraste.
- Não há cartões translúcidos aninhados no workspace do terminal.
- Verde representa somente conexão/sucesso; vermelho somente falha ou ação destrutiva; âmbar representa estados que aguardam interação.
- Componentes usam tokens semânticos. Cores literais são permitidas apenas para integração com chrome nativo ou contraste documentado.
- `prefers-reduced-transparency`, `prefers-reduced-motion` e forced colors devem produzir interface utilizável.

## Responsividade

- Janela mínima suportada permanece `800×600`.
- Abaixo de `900px`, as abas reduzem largura antes que ações essenciais desapareçam.
- A gaveta nunca deixa menos de `10vw` de backdrop clicável em larguras estreitas.
- Os controles nativos da janela nunca entram no overflow das abas.
- Zoom de texto a `200%` mantém acesso a abrir/fechar gaveta, trocar aba e controlar janela.

## Acessibilidade

- Todos os botões somente com ícone possuem `aria-label` e tooltip coerentes.
- Gaveta usa semântica de diálogo não modal ou região complementar conforme validação de implementação; não pode criar dois traps de foco simultâneos.
- Menus seguem roving focus/teclas de seta, `Home`, `End`, `Enter` e `Escape`.
- Abas adotam semântica consistente de `tablist`, `tab` e `tabpanel`, ou documentam alternativa equivalente testada.
- Status é anunciado por texto e `aria-live`, não somente por ponto colorido.
- Ordem de tabulação acompanha a ordem visual.

## Invariantes técnicos

- Alternar a gaveta não chama `closeSession`, `startLocalSession` ou `startSshSession`.
- Alternar overlays não recria instâncias de xterm nem perde seleção, scrollback ou buffer pendente.
- Cada sessão aberta possui no máximo um `TerminalSurface` e um handle registrado.
- A mudança não altera payloads ou nomes de eventos IPC.
- O backend não recebe estado visual da gaveta ou menus.
- Nenhum segredo passa a ser armazenado em state persistente, toast, log ou mensagem de erro.

## Fora do escopo

- Split panes.
- Reordenação e restauração persistente de abas.
- Temas, fonte e opacidade configuráveis pelo usuário.
- Command palette geral.
- Rename de abas.
- Menu global clássico (`File`, `Edit`, `View`).
- Mudanças no PTY, SSH, banco ou contratos Tauri.
- Reprodução pixel-perfect do Windows Terminal.

## Estratégia de migração

1. Extrair a barra superior mantendo callbacks e comportamento atuais.
2. Transformar `HostsWorkspace` em conteúdo de gaveta sem reescrever CRUD.
3. Introduzir launcher acessível e remover o `select` invisível.
4. Remover cabeçalho de sessão/status bar após realocar feedback e ações.
5. Consolidar materiais/tokens e validar fallback Windows.
6. Executar regressão completa e atualizar evidência visual.

A migração pode ocorrer em PRs separados, mas cada PR integrado deve deixar a aplicação utilizável e os testes verdes.

## Critérios de aceite globais

- [ ] Com a gaveta fechada, somente a barra superior ocupa espaço fora do terminal.
- [ ] A gaveta inicia fechada e sobrepõe o terminal sem redimensioná-lo.
- [ ] Abrir/fechar gaveta e menus não remonta `TerminalSurface` nem encerra sessões.
- [ ] O terminal começa imediatamente abaixo da barra e preenche a área restante.
- [ ] Não existem activity rail, `session-info` ou status bar permanentes.
- [ ] Sessões locais e SSH podem ser abertas, alternadas, fechadas e reconectadas.
- [ ] Busca, Quick Connect, CRUD, importação e exportação continuam alcançáveis.
- [ ] Todos os estados de sessão são identificáveis sem depender apenas de cor.
- [ ] Atalhos definidos nesta spec funcionam sem bloquear entrada normal do terminal.
- [ ] Backdrop blur neutro e fallback opaco são legíveis no Windows 11.
- [ ] A janela mínima `800×600` não sobrepõe abas, launcher e controles da janela.

## Testes e evidências

### Automatizados

- Componentes: barra, tabs, launcher, drawer, foco, fechamento e status.
- Integração React: sessão permanece montada ao alternar gaveta; abertura por Host e Quick Connect fecha a gaveta somente após sucesso.
- Regressão: trust, credencial, reconexão, exit code, copiar/colar e eventos tardios.
- Acessibilidade: nomes, roles, foco inicial/restaurado, teclado e região `aria-live`.

### Manuais no Windows 11

- Janela normal, maximizada, restaurada e tamanho mínimo.
- Backdrop blur neutro habilitado, reduced transparency e fallback opaco.
- PowerShell, CMD, WSL disponível e sessão SSH.
- Duas ou mais sessões com saída contínua durante abertura repetida da gaveta.
- DPI `100%`, `125%`, `150%` e zoom de texto relevante.
- Evidências: screenshots do estado vazio, terminal ativo, gaveta aberta, menu de perfis e falha SSH.
