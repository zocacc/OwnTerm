# OwnTerm / Glass Terminal Pro — Figma Assets & Design System

Arquivos vetoriais (.SVG) otimizados para importação direta no **Figma**, Adobe XD, Penpot ou Sketch, com camadas agrupadas, semântica limpa e estilos fiéis ao tema Glassmorphism Dark do frontend.

---

## Arquivos Disponíveis

1. **`ownterm-full-ui-mockup.svg`** (1440 × 900 px)
   - Mockup completo de tela em alta fidelidade da aplicação desktop.
   - Inclui:
     - Header com Logo, Marca e Shell Selector (`PowerShell 7`, `WSL`, `CMD`).
     - Botão de ação primária "Nova aba" (`Ctrl+Shift+T`).
     - Barra de abas com abas ativas, inativas e status dinâmico.
     - Superfície xterm.js com prompt, comandos git e testes reais executados.
     - Barra de status inferior com PID, status de conexão, botões Copiar/Colar e atalhos.

2. **`ownterm-ui-components-kit.svg`** (1280 × 960 px)
   - Kit de componentes do Design System:
     - **Botões**: Primário (Default, Hover, Loading), Secundário, Ghost, Ícone.
     - **Abas**: Estados Ativo, Inativo, Hover com botão fechar (`×`).
     - **Dropdowns / Selects**: Menu fechado e menu aberto com lista de shells.
     - **Badges & Status**: Connected (verde), Starting (âmbar), Disconnected (cinza), Failed (vermelho), Awaiting Trust (roxo).
     - **Tokens de Cores**: Variáveis CSS mapeadas em paleta visual.

3. **`ownterm-app-icons.svg`** (960 × 640 px)
   - Grade vetorial completa de ícones e controles:
     - Shells: Terminal, PowerShell, CMD, WSL/Linux, SSH Host.
     - Ações: Nova Aba (`+`), Fechar (`×`), Copiar, Colar, Buscar, Reconectar, Configurações, Split Pane.
     - Controles de Janela: Estilo macOS (Traffic lights) e Windows (Minimizar, Maximizar, Fechar).

4. **`ownterm-logo.svg`** (512 × 512 px)
   - Logo vetorial oficial do OwnTerm em alta resolução com monograma "O" e prompt estilizado.

---

## Como Importar no Figma

1. Abra seu projeto no **Figma**.
2. Arraste e solte os arquivos `.svg` diretamente no canvas ou use o menu: **File → Place Image / Vector (Ctrl+Shift+K)**.
3. Como os SVGs possuem `<g id="...">` semânticos, o Figma converterá cada seção em Frames e Grupos editáveis automaticamente (ex: `#app-window`, `#header`, `#tab-bar`, `#terminal-canvas`, `#footer-status-bar`).
