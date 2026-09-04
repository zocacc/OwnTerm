# I15 — Extrair cofre e diretórios do sistema

**Status:** in progress
**Dependências:** I13

## Objetivo

Entregar adapters nativos de cofre e diretórios sem acoplar o app Tauri a APIs de SO.

## Escopo

- [ ] Criar `ownterm-platform`.
- [ ] Mover `SystemVault` para o crate e preservar Credential Manager no Windows.
- [ ] Implementar diretórios LocalAppData no Windows e XDG data/config no Linux.
- [ ] Retornar `UnsupportedPlatform` para cofre Linux.

## Fora do escopo

Fallback de segredo em arquivo, criação de diretórios, migração de banco ou seleção de path pelo usuário.

## Critérios de aceite

- [ ] Segredo não possui fallback em texto puro.
- [ ] Resolução de diretórios é determinística e não escreve no filesystem.
- [ ] Linux reporta suporte de cofre ausente de forma explícita.

## Testes

- [ ] Unit tests cobrem XDG e fallback HOME.
- [ ] Teste Linux confirma `UnsupportedPlatform` no cofre.
