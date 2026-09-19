# E13 — Correções do shell terminal-first

- Estado: `in progress`
- Spec: [`terminal-first-fullscreen.md`](../../specs/terminal-first-fullscreen.md)
- Objetivo: eliminar chrome residual, manter a gaveta como overlay e isolar a composição do chrome da transparência do canvas xterm.

## Ordem

`I31 → I32 → I33 → I34`. I31, I32 e I33 podem ser analisadas em paralelo, mas I34 só encerra após a integração delas no mesmo branch.
