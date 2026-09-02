# I01 — Criar scaffold desktop e core mínimo

**Status:** planned  
**Dependências:** I00

## Objetivo

Criar o workspace compilável de Tauri 2, React/TypeScript e Rust com fronteiras mínimas de domínio/aplicação.

## Escopo

- [ ] Inicializar app desktop, Vite, Tailwind, componentes base e xterm.
- [ ] Criar módulos Rust de domínio/aplicação e adapter Tauri sem abstrações prematuras.
- [ ] Fixar toolchain Rust, Node LTS e pnpm por lockfiles/configuração.
- [ ] Adicionar `.gitignore`, editorconfig e comandos documentados.

## Fora do escopo

PTY, SSH, SQLite, cofre e fluxos de Host.

## Critérios de aceite

- [ ] App desktop abre uma tela mínima e Rust compila.
- [ ] Frontend não importa banco, cofre ou adapter de I/O.
- [ ] Estrutura permite extrair adapters sem alterar o domínio.

## Testes

- [ ] Build frontend e `cargo check` passam localmente e no CI inicial.
