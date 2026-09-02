# Uso do OwnTerm

## Escopo do E01

O E01 entrega a fundacao do aplicativo: frontend React/Vite, shell desktop
Tauri e crates Rust. Ainda nao ha sessao de terminal ou conexao SSH real.

## Validar pela VPS via SSH

Uma VPS acessada somente por SSH nao consegue abrir a janela nativa do Tauri.
Ela pode instalar dependencias, executar os testes e gerar o frontend.

Na raiz do repositorio, na branch da E01:

```bash
git fetch origin
git checkout feat/e01-foundation
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

Sao necessarios Node.js 20.20.2, pnpm 10.15.1 e Rust 1.94.1. Em Linux, o
`cargo check` do desktop tambem exige as bibliotecas de desenvolvimento do
WebKit/GTK usadas no workflow de CI.

## Ver o frontend pela VPS

Para ver apenas a camada web, inicie o Vite na VPS sem expor uma porta publica:

```bash
pnpm dev
```

No computador local, crie um tunel SSH:

```bash
ssh -L 1420:127.0.0.1:1420 usuario@vps
```

Abra `http://localhost:1420`. Nesse modo o navegador usa o adaptador mockado;
nao existe janela Tauri, PTY ou SSH real.

## Executar o aplicativo desktop

Em uma maquina com interface grafica, preferencialmente Windows 11:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm tauri dev
```

Para produzir o instalador Windows:

```bash
pnpm tauri build --bundles nsis
```

O arquivo gerado fica em `target/release/bundle/nsis/`. A pipeline tambem o
publica como o artefato `ownterm-windows-installer` no job **Windows build**.
