# I13 — Definir ports de plataforma na application

**Status:** in progress
**Dependências:** I12

## Objetivo

Fazer a application possuir os contratos de terminal, eventos e diretórios independentes de SO.

## Escopo

- [ ] Definir `TerminalBackend`, `TerminalEventSink`, eventos, erros e parsing de IDs.
- [ ] Definir `AppDirectoriesProvider`, `AppDirectories` e erro de plataforma.
- [ ] Registrar a decisão na ADR 0010 e na spec de borda.

## Fora do escopo

Implementações nativas, commands novos ou alterações no frontend.

## Critérios de aceite

- [ ] Application não depende de Tauri, `portable-pty`, keyring ou APIs nativas.
- [ ] Os contratos usam modelos de domínio e não expõem handles.
- [ ] Erros de tamanho, perfil/sessão ausentes e plataforma são tipados.

## Testes

- [ ] Unit tests cobrem parsing e contratos de erro.
