# I02 — Configurar qualidade e CI incremental

**Status:** done
**Dependências:** I01

## Objetivo

Tornar formatação, testes e builds repetíveis desde a fundação.

## Escopo

- [x] Configurar ESLint, Prettier, Vitest/Testing Library, rustfmt e Clippy.
- [x] Criar workflows para typecheck, lint, testes e checks Rust.
- [x] Incluir job Windows de build assim que o scaffold Tauri estiver disponível.

## Fora do escopo

Assinatura, publicação e smoke de funcionalidades ainda inexistentes.

## Critérios de aceite

- [x] Checks falham para formato, lint, tipos ou testes inválidos.
- [x] CI documenta versões e comandos equivalentes locais.

## Testes

- [x] Executar cada comando de CI em checkout limpo.

## Evidências

- ESLint, Prettier, Vitest e rustfmt/Clippy configurados.
- Workflow GitHub Actions cobre qualidade Linux e build Windows.
- Comandos locais documentados em README.md.
