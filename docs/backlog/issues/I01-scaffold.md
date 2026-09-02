# I01 — Criar scaffold desktop e core mínimo

**Status:** done
**Dependências:** I00

## Objetivo

Criar o workspace compilável de Tauri 2, React/TypeScript e Rust com fronteiras mínimas de domínio/aplicação.

## Escopo

- [x] Inicializar app desktop, Vite, Tailwind, componentes base e xterm.
- [x] Criar módulos Rust de domínio/aplicação e adapter Tauri sem abstrações prematuras.
- [x] Fixar toolchain Rust, Node LTS e pnpm por lockfiles/configuração.
- [x] Adicionar `.gitignore`, editorconfig e comandos documentados.

## Fora do escopo

PTY, SSH, SQLite, cofre e fluxos de Host.

## Critérios de aceite

- [x] App desktop abre uma tela mínima e Rust compila.
- [x] Frontend não importa banco, cofre ou adapter de I/O.
- [x] Estrutura permite extrair adapters sem alterar o domínio.

## Testes

- [x] Build frontend e `cargo check` passam localmente e no CI inicial.

## Evidências

- Workspace React, Tauri e core Rust em apps/desktop e crates/.
- Toolchains e lockfiles: package.json, pnpm-lock.yaml, Cargo.lock e rust-toolchain.toml.
- Validação: pnpm lint, typecheck, test, build e cargo check.
