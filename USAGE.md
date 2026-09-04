# Uso do OwnTerm

## Estado atual

E01 entrega o scaffold, E02 valida os riscos técnicos, E03 entrega o core seguro
e E04 entrega sessões locais reais em abas. No Windows, PowerShell e CMD são
detectados; distribuições WSL aparecem somente quando disponíveis. Hosts e SSH
ainda não estão expostos na interface.

## Validar pela VPS via SSH

Uma VPS acessada somente por SSH não consegue abrir a janela nativa do Tauri.
Ela pode instalar dependências, executar os testes, validar um PTY Linux e gerar
o frontend.

Na raiz do repositório:

```bash
git fetch origin
git checkout develop
corepack enable
pnpm install --frozen-lockfile

pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format:check
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
cargo check -p ownterm-desktop
```

Para validar somente E04, incluindo session manager, input/output binário,
resize, close e exit code:

```bash
cargo test -p ownterm-terminal -- --nocapture
cargo clippy -p ownterm-terminal --all-targets -- -D warnings
pnpm test
```

São necessários Node.js 20.20.2, pnpm 10.15.1 e Rust 1.94.1. Em Linux, o
`cargo check` do desktop também exige as bibliotecas de desenvolvimento do
WebKit/GTK usadas no workflow de CI.

## Ver o frontend pela VPS

Para ver a camada web, inicie o Vite na VPS sem expor uma porta pública:

```bash
pnpm dev
```

No computador local, crie um túnel SSH:

```bash
ssh -L 1420:127.0.0.1:1420 usuario@vps
```

Abra `http://localhost:1420`. Nesse modo o navegador usa um shell demonstrativo
mockado: abas, status e eco podem ser avaliados, mas não existe PTY real. O PTY
pertence ao processo nativo Tauri e precisa ser testado no desktop.

## Executar sessões locais reais

Em uma máquina com interface gráfica, preferencialmente Windows 11:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm tauri dev
```

Escolha PowerShell, Command Prompt ou uma distribuição WSL detectada e clique em
**Nova aba**. `Ctrl+Shift+T` abre outra sessão e `Ctrl+Tab` alterna as abas.
Copiar usa a seleção atual do terminal; colar envia os bytes diretamente ao PTY.

Para produzir o instalador Windows:

```bash
pnpm tauri build --bundles nsis
```

O arquivo gerado fica em `target/release/bundle/nsis/`. A pipeline também o
publica como o artefato `ownterm-windows-installer` no job **Windows build**.

## Limitação atual após E04

As sessões locais não persistem saída nem sobrevivem ao fechamento do
aplicativo. O desktop ainda não expõe CRUD de Hosts nem sessões SSH; o workspace
de Hosts entra em E05 e a conexão SSH em E06.
