# OwnTerm

Terminal desktop local-first para shells locais e Hosts SSH. O MVP prioriza
Windows 11, Tauri 2, React, TypeScript e Rust.

## Estrutura

- apps/desktop: frontend React/Vite e adapter Tauri.
- crates/ownterm-domain: linguagem e regras independentes de infraestrutura.
- crates/ownterm-application: fachada de casos de uso compartilháveis.
- docs/: produto, arquitetura, segurança, specs, ADRs e backlog.

## Pré-requisitos

- Node.js 20.20.2 e pnpm 10.15.1.
- Rust 1.94.1 com clippy e rustfmt.
- Pré-requisitos de plataforma do Tauri para desenvolvimento local.

## Comandos

    pnpm install
    pnpm dev
    pnpm build
    pnpm lint
    pnpm typecheck
    pnpm test
    pnpm format:check
    cargo check --workspace

Para abrir o desktop Tauri:

    pnpm tauri dev
