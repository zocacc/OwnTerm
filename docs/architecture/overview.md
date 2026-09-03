# Visão de arquitetura

## Forma inicial

O repositório começa com desktop Tauri 2 e uma camada Rust compartilhável de domínio e aplicação. Adaptadores são extraídos apenas quando um limite é comprovado pelo primeiro slice; a CLI reutilizará application services após o MVP, sem bloquear a entrega desktop.

```text
React + xterm.js
        │ comandos e eventos tipados
Tauri commands/events
        │
Application services
   ├── Domain
   ├── Host/known-host repository ports
   ├── Secrets port
   ├── PTY port
   └── SSH port
        │
SQLite | Windows credential vault | portable-pty | russh
```

## Regras de fronteira

- O domínio não depende de Tauri, React, SQLite, `russh` ou `portable-pty`.
- A interface nunca acessa banco, cofre, sockets, handles de PTY ou chaves privadas.
- Commands Tauri apenas adaptam entrada/saída e delegam para casos de uso.
- Uma Session é runtime: seu handle fica no backend e a interface recebe somente Session Descriptors e eventos.
- Segredos entram exclusivamente por command dedicado para o backend e não passam por eventos, stores, logs ou exportações.
- SQLite persiste configuração e confiança SSH; o cofre persiste apenas segredos; arquivos de chave permanecem no caminho informado pelo usuário.

## Estrutura evolutiva

O scaffold cria `apps/desktop` e módulos Rust de domínio/aplicação junto do adapter Tauri. E03 extraiu `ownterm-storage-sqlite` após os spikes confirmarem os limites de persistência e cofre; E04 extraiu `ownterm-terminal` para descoberta, lifecycle e streaming PTY; SSH e parser OpenSSH serão extraídos quando seus slices funcionais exigirem. Cada extração preserva os ports existentes e inclui testes de contrato.

## Dependências de risco

Os spikes de PTY, SSH, cofre Windows e window effects precedem seus slices funcionais. Uma limitação encontrada em spike atualiza a spec e seu ADR antes de a implementação de produto depender dela.
