# I02 — Configurar qualidade e CI incremental

**Status:** planned  
**Dependências:** I01

## Objetivo

Tornar formatação, testes e builds repetíveis desde a fundação.

## Escopo

- [ ] Configurar ESLint, Prettier, Vitest/Testing Library, rustfmt e Clippy.
- [ ] Criar workflows para typecheck, lint, testes e checks Rust.
- [ ] Incluir job Windows de build assim que o scaffold Tauri estiver disponível.

## Fora do escopo

Assinatura, publicação e smoke de funcionalidades ainda inexistentes.

## Critérios de aceite

- [ ] Checks falham para formato, lint, tipos ou testes inválidos.
- [ ] CI documenta versões e comandos equivalentes locais.

## Testes

- [ ] Executar cada comando de CI em checkout limpo.
