# Borda de plataforma

## Objetivo

Manter o OwnTerm Windows-first sem espalhar APIs de Windows, Linux, ConPTY, PTY, cofre ou paths para React, commands Tauri, domínio e casos de uso.

## Contratos internos

- `ownterm-application::terminal::TerminalBackend` lista Shell Profiles e inicia, escreve, redimensiona e encerra Sessions locais.
- `TerminalEventSink` transporta saída em bytes, status e exit code sem handles nativos.
- `ownterm-application::platform::AppDirectoriesProvider` resolve diretórios de dados e configuração sem criar diretórios.
- `SecretVault` continua sendo o port de segredos já existente na application.

## Adapters

- `ownterm-terminal::NativeTerminalBackend` implementa terminal e descoberta de shells. Módulos internos isolam Windows/ConPTY/WSL e Unix/PTY.
- `ownterm-platform::SystemVault` usa o cofre Windows; em Linux retorna `UnsupportedPlatform`.
- `ownterm-platform::SystemDirectories` resolve `LOCALAPPDATA/OwnTerm` no Windows e XDG data/config no Linux.

## Fora do escopo

- Registro de backends em runtime, plugins, abstração para macOS, cofre Linux funcional, escolha de diretório pelo usuário, abertura de URLs/arquivos e notificações.
- Alterações no IPC React/Tauri, schema SQLite ou persistência de saída.

## Critérios de aceite

- [ ] React e commands Tauri não importam APIs nativas, `portable-pty`, keyring ou paths específicos.
- [ ] O application depende apenas de domínio e seus ports; adapters dependem da application, nunca o inverso.
- [ ] PowerShell, CMD, WSL detectado e lifecycle ConPTY continuam cobertos no Windows.
- [ ] Shell Unix e PTY local permanecem funcionais no Linux.
- [ ] O cofre Linux falha explicitamente sem persistir segredo fora do cofre.
- [ ] Diretórios seguem LocalAppData/XDG e sua resolução não cria arquivos.
- [ ] CI compila e testa os caminhos Linux e Windows.
