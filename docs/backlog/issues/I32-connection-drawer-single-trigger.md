# I32 — ConnectionDrawer com acionador único

- Estado: `in progress`
- Épico: E13
- Dependências: I21, I22

## Escopo

Remover qualquer label, aba, listener ou estado redundante de `Connections` fora da gaveta. Fazer de `SidebarToggle` o único controlador de `drawerOpen` e manter a gaveta como overlay sem largura reservada.

## Aceite

- Botão da titlebar alterna a gaveta; `Esc` e backdrop fecham.
- Não há `Connections` visível ou clicável fora da gaveta.
- Fechar a gaveta não altera largura nem recria xterm/PTy.
