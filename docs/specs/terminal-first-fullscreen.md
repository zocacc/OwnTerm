# Spec — Shell terminal-first em tela cheia e opacidades isoladas

## Objetivo

O OwnTerm deve se comportar como um terminal nativo: a `UnifiedTitleBar` é o único chrome permanente e a sessão ativa ocupa integralmente toda a área abaixo dela. A gaveta de conexões é uma sobreposição temporária. As preferências `windowOpacity` e `terminalBackgroundOpacity` são independentes.

## Estrutura obrigatória

```text
AppShell (100dvh, overflow hidden)
├── UnifiedTitleBar (40px; SidebarToggle é o único controle da gaveta)
├── TerminalWorkspace (flex: 1; min-height: 0)
│   └── TerminalSurface (.xterm ocupa 100% da área)
└── ConnectionDrawer (overlay condicional)
```

`AppShell`, `TerminalWorkspace`, `TerminalSurface` e o contêiner de `.xterm` usam largura e altura disponíveis, `min-width: 0` e `min-height: 0`. Não há header secundário, statusbar, card, borda, margem ou padding estrutural entre titlebar e terminal.

## Gaveta

`SidebarToggle`, no canto superior esquerdo da titlebar, é a única fonte de verdade para `drawerOpen`. `Esc`, backdrop e seleção de conexão fecham a gaveta. A gaveta usa overlay absoluto/fixo acima do workspace e, fechada, não reserva largura nem deixa rail, label ou área clicável residual. O título interno da própria gaveta pode permanecer.

O `FitAddon.fit()` roda após montagem, troca de aba, resize da janela, troca de fonte e alteração de estado da gaveta. Abrir ou fechar a gaveta não recria xterm nem PTY.

## Opacidades

| Preferência | Intervalo | Responsabilidade | Não afeta |
| --- | --- | --- | --- |
| `windowOpacity` | 0–100 | composição CSS do chrome: titlebar, gaveta, menus, diálogos e feedback | `terminal.options.theme.background`, texto e cursor xterm |
| `terminalBackgroundOpacity` | 55–100 | alfa RGBA exclusivo de `terminal.options.theme.background` | chrome, controles e backdrop do shell |

A opacidade de janela não pode usar `opacity` em ancestral de `.xterm` nem alpha nativo em janela layered, pois ambos compõem o canvas, texto e cursor. Para compatibilidade com versões anteriores, a aplicação restaura alpha nativo a 100%; a preferência de janela é aplicada por `--window-opacity` exclusivamente aos elementos de chrome. O xterm recebe `background: rgba(...)` derivado apenas de `terminalBackgroundOpacity`.

As duas preferências são persistidas separadamente e devem atualizar sessões existentes e futuras sem reiniciar PTY ou perder scrollback.

## Aceite

1. Com a gaveta fechada, não há moldura visual entre titlebar e terminal.
2. Após abrir/fechar a gaveta dez vezes com SSH ativo, a sessão não reconecta e mantém a área útil.
3. Não existe `Connections` fora da gaveta nem segundo acionador dela.
4. Janela 100% e terminal 55% mantém o fundo do terminal a 55%.
5. Janela 55% e terminal 100% mantém o terminal sólido e legível.
6. Mudar um slider não muda o valor persistido nem o efeito do outro.
7. Alternar abas, redimensionar, maximizar e reiniciar preserva valores e preenchimento da área útil.
