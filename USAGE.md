# Uso do OwnTerm

## Estado atual

E01 entrega o scaffold desktop, E02 valida os riscos de PTY/SSH/cofre e E03
entrega domínio, SQLite, referências de credencial e trust store. Ainda não há
interface de Hosts, sessão de terminal ou conexão SSH real.

## Validar pela VPS via SSH

Uma VPS acessada somente por SSH nao consegue abrir a janela nativa do Tauri.
Ela pode instalar dependencias, executar os testes e gerar o frontend.

Na raiz do repositório:

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

Para validar somente E03, inclusive migrations em banco temporário, CRUD,
política de grupos, limpeza de referências de cofre e TOFU estrito:

```bash
cargo test -p ownterm-domain -p ownterm-application -p ownterm-storage-sqlite
cargo clippy -p ownterm-domain -p ownterm-application -p ownterm-storage-sqlite --all-targets -- -D warnings
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

## Limitação atual de E03

O adapter SQLite já aplica migrations ao abrir um arquivo e os ports estão
prontos para os próximos slices. O desktop ainda não expõe commands de CRUD nem
abre o banco na inicialização; essa integração entra com o workspace de Hosts.
