# OwnTerm — Contexto Base, Arquitetura e Plano do MVP

> Documento de contexto para planejamento e implementação incremental com Codex.
>
> Status: proposta inicial do MVP
> Plataforma prioritária: Windows 11
> Estratégia: local-first, open source e preparada para evolução
> Stack principal: Rust + Tauri 2 + React + TypeScript

---

## 1. Finalidade deste documento

Este arquivo é a fonte inicial de verdade para o MVP do OwnTerm. Ele deve ser entregue ao Codex antes da criação do projeto ou no início do planejamento do repositório.

Antes de escrever código, o Codex deve:

1. Ler este documento por completo.
2. Inspecionar o repositório e todos os arquivos AGENTS.md aplicáveis.
3. Comparar o estado atual do projeto com esta proposta.
4. Registrar decisões importantes como ADRs curtos em docs/adr.
5. Transformar o plano em épicos, specs e issues pequenas, ordenadas por dependência.
6. Apresentar o planejamento antes de implementar várias fases.
7. Implementar uma issue por vez, sempre com testes e critérios de aceite.

Este documento define direção e escopo. Ele não autoriza publicação de pacotes, provisionamento de serviços externos, uso de credenciais reais, criação de infraestrutura em nuvem ou outras ações externas sem solicitação explícita.

### 1.1 Primeira entrega esperada do Codex

A primeira passagem do Codex deve produzir ou propor:

- docs/product/mvp-scope.md;
- docs/architecture/overview.md;
- docs/architecture/ipc-contract.md;
- docs/security/threat-model.md;
- uma spec por capacidade relevante em docs/specs;
- issues locais ou manifesto de backlog em docs/backlog;
- ADRs para decisões com alternativas relevantes;
- ordem de implementação e dependências;
- spikes para riscos técnicos antes de decisões difíceis de reverter.

O Codex não deve tentar implementar todo o MVP na primeira interação.

### 1.2 Como dividir o trabalho

Cada issue deve:

- gerar uma entrega observável;
- ser implementável e revisável isoladamente;
- declarar dependências;
- conter critérios de aceite objetivos;
- listar testes;
- indicar módulos provavelmente afetados;
- declarar o que está fora do escopo;
- evitar misturar refatoração ampla com funcionalidade nova.

Modelo:

~~~md
# Título

## Objetivo

## Contexto

## Escopo

## Fora do escopo

## Abordagem técnica

## Critérios de aceite

- [ ] Critério verificável

## Testes

- [ ] Teste esperado

## Dependências

## Riscos e observações
~~~

---

## 2. Visão do produto

O OwnTerm é um gerenciador de terminais e sessões SSH voltado inicialmente para Windows e para usuários técnicos que trabalham diariamente com muitos hosts, especialmente profissionais de DevOps, infraestrutura, redes e telecomunicações.

O produto deve combinar:

- a praticidade visual do Termius;
- a eficiência operacional do MobaXterm;
- a familiaridade do Windows Terminal;
- a portabilidade do OpenSSH;
- uma base local-first, aberta e extensível.

O OwnTerm não deve exigir conta. O usuário deve conseguir instalar o aplicativo, importar configurações SSH, cadastrar hosts, proteger credenciais e abrir múltiplas sessões rapidamente.

### 2.1 Proposta de valor

> Um terminal desktop bonito, rápido e local-first que centraliza shells locais e hosts SSH sem aprisionar configurações ou funções essenciais atrás de uma assinatura.

### 2.2 Público inicial

- profissionais de DevOps e SRE;
- administradores de sistemas;
- engenheiros de redes e telecomunicações;
- desenvolvedores que usam VPS e ambientes remotos;
- usuários de Windows que alternam entre PowerShell, CMD, WSL e SSH;
- usuários insatisfeitos com a lentidão, limitações ou modelo fechado das alternativas existentes.

### 2.3 Princípios do produto

1. **Local-first:** o essencial funciona sem internet ou login.
2. **Rápido para abrir e conectar:** poucos passos até uma sessão.
3. **Seguro por padrão:** credenciais nunca ficam em texto puro no banco, exportações ou logs.
4. **Formato aberto:** hosts e preferências podem ser exportados.
5. **Keyboard-first:** pesquisa, navegação e conexão funcionam bem pelo teclado.
6. **Visual premium e legível:** transparência é usada com moderação.
7. **Core independente:** GUI e CLI reutilizam regras e casos de uso.
8. **Evolução incremental:** cloud, plugins e equipes não complicam o MVP.

---

## 3. Escopo do MVP

### 3.1 Terminal local

Obrigatório:

- abrir PowerShell;
- abrir Prompt de Comando;
- detectar e abrir distribuições WSL quando possível;
- criar, fechar e alternar entre abas;
- redimensionar o PTY junto com o painel;
- copiar e colar;
- suportar cores ANSI e aplicações interativas;
- encerrar processos quando a sessão for fechada;
- informar exit code quando disponível.

### 3.2 SSH

Obrigatório:

- conexão por hostname ou IP;
- porta configurável, padrão 22;
- autenticação por senha;
- autenticação por chave privada local;
- chave protegida por passphrase;
- validação da chave do servidor;
- armazenamento seguro de hosts conhecidos;
- terminal remoto interativo;
- resize remoto;
- estados conectando, aguardando confirmação, conectado, desconectado e erro;
- timeout, cancelamento e reconexão manual.

### 3.3 Hosts

Obrigatório:

- cadastrar, editar e excluir host;
- confirmar exclusões;
- organizar hosts em grupos;
- pesquisar por nome, endereço, usuário, grupo ou tag;
- armazenar hostname, porta, usuário, método de autenticação e referência da credencial;
- favoritos e recentes;
- abrir conexão por duplo clique, Enter ou Quick Connect.

### 3.4 Importação e portabilidade

Obrigatório:

- importar ~/.ssh/config;
- reconhecer Host, HostName, User, Port e IdentityFile;
- informar diretivas ignoradas;
- mostrar prévia antes da importação;
- exportar hosts, grupos e preferências em formato aberto e versionado;
- importar novamente uma exportação OwnTerm;
- nunca incluir senha, passphrase ou conteúdo de chave privada na exportação comum.

### 3.5 Interface

Obrigatório:

- tema escuro padrão;
- barra lateral;
- painel de hosts e grupos;
- busca;
- barra de abas;
- terminal;
- barra de status;
- formulário de host;
- Quick Connect ou command palette;
- configurações essenciais;
- estados vazios, carregamento, confirmação e erro;
- atalhos documentados.

### 3.6 Persistência e segurança

Obrigatório:

- SQLite local com migrations;
- credenciais no cofre do sistema;
- persistir caminho da chave, não seu conteúdo;
- logs estruturados e sanitizados;
- nenhuma telemetria;
- nenhuma conta;
- nenhuma transmissão para serviço externo.

### 3.7 Desejável, mas adiável

Só incluir depois do núcleo estável:

- split panes;
- duplicar sessão;
- atalhos configuráveis;
- temas adicionais;
- snippets simples;
- reconexão automática opcional;
- mais diretivas OpenSSH;
- backup local criptografado.

### 3.8 Fora do MVP

- sincronização em nuvem;
- conta OwnTerm;
- equipes e compartilhamento;
- mobile;
- servidor SSH;
- SFTP completo;
- port forwarding visual avançado;
- jump hosts complexos;
- gravação de sessões;
- colaboração;
- marketplace de plugins;
- integração profunda com tmux;
- chaves privadas na nuvem;
- RBAC, SSO ou gestão corporativa;
- suporte oficial completo a macOS e Linux.

A arquitetura pode deixar pontos de extensão reais, mas não deve criar abstrações especulativas extensas.

---

## 4. Jornadas principais

### 4.1 Primeira execução

1. O aplicativo cria o banco e aplica migrations.
2. Detecta shells disponíveis.
3. Oferece importar ~/.ssh/config ou cadastrar host.
4. O usuário pode ignorar tudo e abrir um shell local.

### 4.2 Cadastrar e conectar

1. Usuário escolhe “Novo host”.
2. Informa nome, endereço, porta e usuário.
3. Escolhe senha ou chave.
4. O segredo vai para o cofre do sistema.
5. O SQLite recebe somente a referência da credencial.
6. Na primeira conexão, o usuário confirma a fingerprint.
7. A sessão abre em nova aba.

### 4.3 Quick Connect

1. Usuário pressiona Ctrl+K ou atalho equivalente.
2. Pesquisa por nome, IP, grupo ou tag.
3. Seleciona o host.
4. A sessão abre.

### 4.4 Importar OpenSSH

1. OwnTerm localiza ou solicita o arquivo.
2. Exibe prévia das entradas reconhecidas.
3. Usuário escolhe quais importar.
4. Aplicativo cria hosts e relata campos ignorados.

### 4.5 Exportar workspace

1. Usuário solicita exportação.
2. OwnTerm gera JSON versionado.
3. O arquivo contém configurações permitidas.
4. Nenhum segredo é incluído.
5. A interface informa que credenciais precisam ser configuradas no destino.

---

## 5. Stack técnica

### 5.1 Desktop e frontend

| Responsabilidade | Escolha |
| --- | --- |
| Shell desktop | Tauri 2 |
| Interface | React + TypeScript |
| Bundler | Vite |
| CSS | Tailwind CSS 4 |
| Componentes | shadcn/ui |
| Primitivos acessíveis | Radix UI quando usado pelo shadcn |
| Ícones | Lucide React |
| Terminal | @xterm/xterm |
| Addons | fit, web-links e WebGL com fallback |
| Estado de UI | Zustand, restrito ao runtime da interface |
| Formulários | React Hook Form + Zod |
| Testes de componente | Vitest + Testing Library |
| E2E web mockado | Playwright |

### 5.2 Rust

| Responsabilidade | Escolha inicial |
| --- | --- |
| Async | Tokio |
| Serialização | Serde |
| Erros de bibliotecas | thiserror |
| Erros na borda | anyhow quando apropriado |
| Logs | tracing |
| IDs | uuid |
| Datas | escolher time ou chrono por ADR |
| CLI | clap |
| SQLite | rusqlite |
| PTY | portable-pty |
| SSH | russh isolado atrás de trait |
| Cofre | keyring ou adapter validado no Windows |
| Testes | cargo test, fakes e testes de integração |

As versões exatas devem ser fixadas pelos lockfiles no scaffold. Antes de adicionar dependências, verificar compatibilidade, manutenção e advisories atuais.

### 5.3 Ferramentas

- Rust stable via rustup;
- Node.js LTS;
- pnpm;
- Cargo workspace;
- pnpm workspace;
- ESLint;
- Prettier;
- rustfmt;
- Clippy;
- GitHub Actions.

---

## 6. Direção visual

O OwnTerm deve ser técnico, premium e discreto. A intenção é transmitir acabamento nativo sem copiar macOS ou Termius.

Direção:

- dark-first;
- grafite com tendência azul/violeta;
- primária violeta ou azul elétrica;
- verde somente para conexão/sucesso;
- vermelho somente para erro/destrutivo;
- Inter na interface;
- JetBrains Mono no terminal;
- bordas brancas com baixa opacidade;
- raios entre 8 e 12 px;
- densidade compacta;
- animações entre 120 e 180 ms;
- transparência em title bar, sidebar e overlays;
- terminal mais sólido para manter contraste.

### 6.1 Transparência

Duas camadas distintas:

1. **Painéis internos:** CSS/Tailwind com fundos semitransparentes, backdrop-filter e bordas discretas.
2. **Janela:** Tauri window effects; Mica no Windows 11, Acrylic apenas como fallback avaliado e materiais nativos no macOS futuramente.

Acrylic não deve ser obrigatório porque pode prejudicar desempenho ao mover ou redimensionar a janela. A interface precisa ter fallback sólido.

Configuração conceitual:

~~~json
{
  "transparent": true,
  "windowEffects": {
    "effects": ["micaDark"]
  }
}
~~~

Painel conceitual:

~~~tsx
<aside className="border-r border-white/10 bg-zinc-950/65 backdrop-blur-xl backdrop-saturate-150">
  {/* hosts */}
</aside>
~~~

### 6.2 Design tokens

Usar nomes semânticos iguais no Figma e no código:

~~~css
:root {
  --background: oklch(0.13 0.01 270);
  --surface: oklch(0.18 0.015 270 / 72%);
  --surface-elevated: oklch(0.22 0.018 270 / 82%);
  --surface-hover: oklch(0.26 0.02 270 / 78%);
  --foreground: oklch(0.96 0.005 270);
  --muted-foreground: oklch(0.68 0.02 270);
  --primary: oklch(0.68 0.18 285);
  --success: oklch(0.72 0.16 150);
  --warning: oklch(0.79 0.16 80);
  --danger: oklch(0.64 0.22 25);
  --border: oklch(1 0 0 / 8%);
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
}
~~~

Validar os valores visualmente e por contraste. Evitar cores literais nos componentes quando existir token adequado.

### 6.3 Layout

| Região | Medida inicial | Função |
| --- | ---: | --- |
| Title bar | 36–40 px | Janela e controles |
| Activity bar | 48 px | Hosts e configurações |
| Sidebar | 240–300 px | Busca, grupos e hosts |
| Tab bar | 36–40 px | Sessões |
| Terminal | Flexível | xterm.js |
| Status bar | 24–28 px | Estado e destino |

### 6.4 Componentes React

- AppShell;
- TitleBar;
- WindowControls;
- ActivityBar;
- HostSidebar;
- HostSearch;
- HostTree;
- HostTreeItem;
- FavoriteHosts;
- RecentHosts;
- TerminalWorkspace;
- TerminalTabBar;
- TerminalTab;
- TerminalPane;
- ConnectionStatusBar;
- QuickConnectDialog;
- HostFormDialog;
- DeleteHostDialog;
- ImportSshConfigDialog;
- ExportWorkspaceDialog;
- SettingsDialog;
- EmptyState;
- ErrorBoundary;
- ToastProvider.

Classes Tailwind repetidas devem virar componente ou variant semântico.

### 6.5 Figma

Usar Figma para:

- fluxos;
- tela principal;
- estados;
- tokens;
- Quick Connect;
- formulário de host;
- comparação visual.

Não é necessário desenhar tudo antes. O primeiro frame de alta fidelidade deve conter sidebar, abas, terminal e status. O código é a fonte de verdade final dos componentes.

---

## 7. Arquitetura

~~~mermaid
flowchart TD
    UI["React + xterm.js"] --> Desktop["Adapter Tauri"]
    CLI["OwnTerm CLI"] --> App["Application Services"]
    Desktop --> App
    App --> Domain["Domain/Core"]
    App --> SSH["SSH Port"]
    App --> PTY["PTY Port"]
    App --> Repo["Repository Port"]
    App --> Secrets["Secrets Port"]
    SSH --> Russh["russh adapter"]
    PTY --> Portable["portable-pty adapter"]
    Repo --> SQLite["SQLite adapter"]
    Secrets --> Keychain["OS keychain adapter"]
~~~

### 7.1 Regras

1. Domínio não depende de Tauri, React, SQLite ou russh.
2. Frontend não acessa banco, segredos ou sockets diretamente.
3. Comandos Tauri chamam casos de uso; não contêm regras complexas.
4. CLI e desktop reutilizam application services.
5. I/O fica atrás de ports quando a substituição ou o teste justificar.
6. Não criar uma interface para cada struct.
7. Sessões ativas são runtime; não representam conexões persistentes.
8. Segredos não passam por eventos genéricos ou estado persistido frontend.

### 7.2 Camadas

**Domain/Core**

- entidades;
- value objects;
- validações;
- métodos de autenticação sem segredo;
- erros;
- contratos essenciais.

**Application**

- CRUD e busca de hosts;
- importação/exportação;
- iniciar, redimensionar e encerrar sessão;
- preferências;
- coordenação de repositório, cofre, PTY e SSH.

**Infrastructure**

- SQLite;
- keychain;
- russh;
- portable-pty;
- filesystem;
- parser SSH;
- logs;
- Tauri;
- CLI.

---

## 8. Estrutura proposta

~~~text
ownterm/
├── AGENTS.md
├── README.md
├── LICENSE
├── Cargo.toml
├── Cargo.lock
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── rust-toolchain.toml
├── .editorconfig
├── .gitignore
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── build-windows.yml
├── apps/
│   ├── desktop/
│   │   ├── package.json
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   ├── components.json
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── components/
│   │   │   │   ├── ui/
│   │   │   │   ├── layout/
│   │   │   │   ├── hosts/
│   │   │   │   └── terminal/
│   │   │   ├── features/
│   │   │   │   ├── hosts/
│   │   │   │   ├── sessions/
│   │   │   │   ├── settings/
│   │   │   │   └── import-export/
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   ├── services/
│   │   │   │   ├── backend.ts
│   │   │   │   ├── tauri-backend.ts
│   │   │   │   └── mock-backend.ts
│   │   │   ├── stores/
│   │   │   ├── styles/
│   │   │   ├── test/
│   │   │   └── main.tsx
│   │   └── src-tauri/
│   │       ├── Cargo.toml
│   │       ├── capabilities/
│   │       ├── migrations/
│   │       ├── src/
│   │       │   ├── commands/
│   │       │   ├── events/
│   │       │   ├── state.rs
│   │       │   ├── lib.rs
│   │       │   └── main.rs
│   │       └── tauri.conf.json
│   └── cli/
│       ├── Cargo.toml
│       └── src/main.rs
├── crates/
│   ├── ownterm-domain/
│   ├── ownterm-application/
│   ├── ownterm-storage-sqlite/
│   ├── ownterm-secrets/
│   ├── ownterm-pty/
│   ├── ownterm-ssh/
│   └── ownterm-import-openssh/
├── docs/
│   ├── adr/
│   ├── architecture/
│   ├── product/
│   ├── security/
│   ├── specs/
│   └── backlog/
└── tests/
    ├── fixtures/
    └── smoke/
~~~

O Codex pode começar com menos crates e extrair limites confirmados depois. Evitar microestrutura prematura.

---

## 9. Domínio inicial

### 9.1 Host

~~~rust
pub struct Host {
    pub id: HostId,
    pub name: String,
    pub address: String,
    pub port: u16,
    pub username: Option<String>,
    pub group_id: Option<GroupId>,
    pub tags: Vec<String>,
    pub auth: AuthMethod,
    pub favorite: bool,
    pub created_at: Timestamp,
    pub updated_at: Timestamp,
}
~~~

### 9.2 Autenticação

~~~rust
pub enum AuthMethod {
    Password { credential_ref: CredentialRef },
    PrivateKey {
        path: PathBuf,
        passphrase_ref: Option<CredentialRef>,
    },
    Agent,
    None,
}
~~~

Agent pode existir no modelo, mas só deve aparecer na UI quando implementado.

### 9.3 Grupo

~~~rust
pub struct HostGroup {
    pub id: GroupId,
    pub name: String,
    pub parent_id: Option<GroupId>,
    pub sort_order: i32,
}
~~~

O MVP pode limitar a organização a um nível se árvores aninhadas ampliarem muito o escopo.

### 9.4 Sessão

~~~rust
pub struct SessionDescriptor {
    pub id: SessionId,
    pub kind: SessionKind,
    pub title: String,
    pub status: SessionStatus,
}

pub enum SessionKind {
    Local { shell: ShellProfileId },
    Ssh { host_id: HostId },
}

pub enum SessionStatus {
    Starting,
    AwaitingTrust,
    AwaitingCredential,
    Connected,
    Disconnected,
    Failed,
}
~~~

O frontend recebe descritores. Handles reais ficam no Rust.

---

## 10. Persistência

### 10.1 SQLite

Tabelas sugeridas:

- hosts;
- host_groups;
- host_tags;
- settings;
- recent_hosts;
- known_hosts, ou formato compatível com OpenSSH;
- schema_migrations.

Nunca armazenar:

- senhas;
- passphrases;
- conteúdo de chave;
- tokens;
- conteúdo completo de sessões.

### 10.2 Migrations

- versionadas e imutáveis após release;
- aplicadas na inicialização;
- transacionais quando possível;
- testadas de banco vazio até versão atual;
- upgrades testados a partir de versões anteriores quando existirem.

### 10.3 Repositório

~~~rust
pub trait HostRepository {
    fn create(&self, host: &Host) -> Result<()>;
    fn update(&self, host: &Host) -> Result<()>;
    fn delete(&self, id: HostId) -> Result<()>;
    fn get(&self, id: HostId) -> Result<Option<Host>>;
    fn list(&self, query: HostQuery) -> Result<Vec<Host>>;
}
~~~

Usar async somente se o fluxo real justificar.

### 10.4 Exportação

JSON legível, versionado e sem segredos:

~~~json
{
  "schemaVersion": 1,
  "exportedAt": "2026-09-02T12:00:00Z",
  "groups": [],
  "hosts": [],
  "settings": {}
}
~~~

A spec deve definir validação, duplicidade, IDs e estratégia de merge antes de implementar importação.

---

## 11. Credenciais e segurança

### 11.1 Cofre

O banco guarda CredentialRef. O segredo fica no cofre do sistema.

~~~text
SQLite: ownterm/host/<uuid>/password
OS Vault: referência -> segredo
~~~

Requisitos:

- namespace OwnTerm;
- exclusão segura quando aplicável;
- atualização consistente;
- erro claro se o cofre falhar;
- nenhum segredo em Debug, Display, panic ou tracing;
- inputs mascarados;
- nenhum segredo em Zustand, Local Storage ou IndexedDB;
- teste manual do Credential Manager no Windows.

### 11.2 Host key

- primeira conexão mostra fingerprint;
- aceite explícito registra o host;
- alteração posterior bloqueia por padrão;
- mensagem explica mudança de identidade;
- testes cobrem host novo, conhecido e divergente.

### 11.3 Segurança Tauri

- capabilities mínimas;
- CSP restritiva;
- sem filesystem amplo no frontend;
- payloads IPC validados;
- canais associados a session_id;
- links externos validados;
- dependências auditadas;
- erros internos não expostos integralmente.

### 11.4 Threat model mínimo

Considerar:

- vazamento por logs;
- frontend comprometido acessando APIs Tauri;
- fingerprint alterada;
- arquivo importado malformado;
- path traversal;
- command injection;
- processo órfão;
- conteúdo terminal malicioso;
- exportação acidental de segredo.

---

## 12. Terminal local

### 12.1 Responsabilidades

**Frontend**

- renderizar xterm.js;
- capturar teclado;
- calcular cols/rows;
- solicitar resize;
- exibir status;
- destruir addons/listeners.

**Rust**

- criar PTY;
- iniciar shell sem interpolação insegura;
- enviar entrada;
- transmitir saída;
- redimensionar;
- acompanhar filho;
- limpar recursos;
- informar saída.

### 12.2 Fluxo

~~~mermaid
sequenceDiagram
    participant UI as xterm.js
    participant IPC as Tauri
    participant PTY as Rust PTY
    UI->>IPC: create local session
    IPC->>PTY: spawn shell
    PTY-->>UI: session started
    UI->>IPC: input bytes
    IPC->>PTY: write
    PTY-->>UI: output bytes
    UI->>IPC: resize
    UI->>IPC: close
    PTY-->>UI: exited
~~~

### 12.3 Requisitos

- preservar bytes; chunks não são necessariamente UTF-8 completos;
- não gerar uma chamada por caractere;
- usar batching/backpressure;
- debounce curto no resize;
- não recriar terminal a cada render;
- cleanup compatível com React Strict Mode;
- WebGL com fallback;
- efeitos visuais não podem afetar a funcionalidade.

---

## 13. SSH

### 13.1 Contrato conceitual

~~~rust
pub trait SshTransport {
    async fn connect(&self, request: ConnectRequest)
        -> Result<Box<dyn RemoteSession>>;
}

pub trait RemoteSession {
    async fn write(&mut self, data: &[u8]) -> Result<()>;
    async fn resize(&mut self, cols: u16, rows: u16) -> Result<()>;
    async fn close(&mut self) -> Result<()>;
}
~~~

A implementação final pode usar streams/channels. O objetivo é isolar russh.

### 13.2 Obrigatório

- timeout;
- cancelamento;
- senha;
- chave;
- passphrase;
- PTY remoto;
- resize;
- exit status;
- host key;
- erros úteis;
- cleanup.

### 13.3 Matriz mínima de teste

- Ed25519;
- RSA moderna;
- chave sem passphrase;
- chave com passphrase;
- senha correta/incorreta;
- host inacessível;
- timeout;
- encerramento remoto;
- resize;
- fingerprint divergente.

Compatibilidade deve ser comprovada, não presumida.

---

## 14. IPC React–Rust

Todo comando/evento deve ter payload tipado, validado e documentado. Tipos podem ser gerados se a solução for simples; caso contrário, manter contratos explícitos e testes.

### 14.1 Capacidades de comando

- hosts.list;
- hosts.get;
- hosts.create;
- hosts.update;
- hosts.delete;
- hosts.import_openssh;
- workspace.export;
- workspace.import;
- shells.list;
- sessions.create_local;
- sessions.create_ssh;
- sessions.write;
- sessions.resize;
- sessions.close;
- settings.get;
- settings.update.

Os nomes são conceituais e devem seguir as convenções reais do Tauri.

### 14.2 Eventos/canais

- session.started;
- session.output;
- session.status_changed;
- session.trust_required;
- session.credential_required;
- session.exited;
- session.error.

### 14.3 Erro público

~~~ts
type AppError = {
  code: string;
  message: string;
  recoverable: boolean;
  details?: Record<string, unknown>;
};
~~~

A UI reage ao code, não compara mensagens. Stack traces não aparecem em produção.

---

## 15. Frontend

### 15.1 Organização por feature

Agrupar componentes, hooks, schemas e testes por feature. Componentes genéricos ficam em components/ui. Evitar pasta utils sem propósito claro.

### 15.2 Backend intercambiável

~~~ts
export interface BackendClient {
  listHosts(): Promise<Host[]>;
  createHost(input: CreateHostInput): Promise<Host>;
  createLocalSession(input: LocalSessionInput): Promise<SessionDescriptor>;
  createSshSession(input: SshSessionInput): Promise<SessionDescriptor>;
  writeSession(sessionId: string, data: Uint8Array): Promise<void>;
  resizeSession(sessionId: string, cols: number, rows: number): Promise<void>;
  closeSession(sessionId: string): Promise<void>;
}
~~~

Implementações:

- TauriBackendClient;
- MockBackendClient para navegador, testes e Figma-to-code.

O mock imita estados essenciais, mas não vira uma segunda aplicação.

### 15.3 Zustand

Pode armazenar:

- abas;
- aba ativa;
- sidebar;
- filtros;
- SessionDescriptors;
- preferências carregadas.

Não pode armazenar:

- passwords;
- passphrases;
- buffers extensos;
- handles Tauri;
- cópias indefinidas de entidades persistentes.

### 15.4 Acessibilidade

- teclado;
- foco visível;
- labels em ícones;
- contraste;
- prefers-reduced-motion;
- focus trap;
- atalhos que não prejudiquem o terminal;
- menus e tooltips acessíveis.

---

## 16. Testes

### 16.1 Estratégia

1. Muitos testes unitários.
2. Integração de adapters Rust.
3. Componentes React.
4. Poucos E2E estáveis.
5. Smoke manual nativo.

### 16.2 Rust unitário

- validação de host/porta;
- entidades;
- busca/tags;
- parser OpenSSH;
- exportação;
- schemaVersion;
- erros públicos;
- política de fingerprint.

### 16.3 Rust integração

- SQLite temporário;
- migrations;
- CRUD;
- rollback;
- round-trip export/import;
- fake keychain em CI;
- PTY controlado;
- SSH controlado;
- cleanup.

### 16.4 Frontend

- formulário;
- busca;
- grupos;
- abas;
- confirmação de fechamento;
- estados de conexão;
- Quick Connect;
- import/export;
- erro do backend;
- atalhos fora do terminal.

### 16.5 Playwright com mock

- primeira execução;
- cadastrar host;
- pesquisar e abrir;
- shell simulado;
- abas;
- importar fixture;
- exportar;
- navegação por teclado.

### 16.6 Checklist Windows

- instalação limpa;
- startup;
- PowerShell;
- CMD;
- WSL;
- resize;
- copiar/colar;
- SSH senha;
- SSH chave;
- persistência;
- Credential Manager;
- Mica e fallback;
- DPI e múltiplos monitores;
- minimizar/maximizar/fechar;
- ausência de processos órfãos conhecidos.

---

## 17. Logs e diagnóstico

Logs:

- tracing;
- timestamp, nível, módulo e session ID;
- rotação;
- debug opcional;
- sanitização central;
- não registrar I/O do terminal por padrão;
- nunca registrar credenciais ou chaves.

Diagnóstico opcional pode conter:

- versão;
- sistema;
- WebView;
- configuração não sensível;
- logs sanitizados.

Nunca incluir credenciais ou conteúdo da sessão.

---

## 18. CI e release

### 18.1 Pull request

- rustfmt;
- Clippy;
- cargo test;
- Prettier;
- ESLint;
- TypeScript typecheck;
- Vitest;
- build frontend;
- check/build Tauri;
- Playwright mockado;
- auditoria de dependências em job separado ou agendado.

### 18.2 Release

- Windows x64 obrigatório;
- instalador;
- checksums;
- versionamento semântico;
- changelog;
- code signing planejado;
- updater não obrigatório, mas decisão registrada.

### 18.3 Qualidade

- sem warnings Clippy no código próprio;
- typecheck limpo;
- sem segredos em fixtures;
- migrations testadas;
- erros possuem ações claras;
- sem processo órfão conhecido;
- build reproduzível pelo README.

---

## 19. Plano incremental

### Fase 0 — Fundação

- ADR de arquitetura;
- Cargo + pnpm workspaces;
- Tauri + React + Vite;
- Tailwind + shadcn;
- lint, format, testes;
- CI;
- README;
- backend client mockável;
- tela mínima.

**Saída:** clone limpo instala, testa, abre frontend web e inicia Tauri no Windows.

### Fase 1 — Shell visual

- tokens;
- tema dark;
- AppShell;
- title/activity bar;
- sidebar;
- hosts mockados;
- tabs;
- status;
- Quick Connect;
- estados;
- testes;
- frame Figma quando disponível.

**Saída:** interface navegável com dados fictícios e layout estável.

### Fase 2 — Hosts persistentes

- domínio;
- SQLite;
- repository;
- services;
- comandos Tauri;
- formulário;
- grupos;
- favoritos/recentes;
- busca;
- testes.

**Saída:** CRUD e pesquisa persistem após reinício.

### Fase 3 — Terminal local

- shells;
- portable-pty;
- lifecycle;
- xterm.js;
- streaming;
- resize;
- cleanup;
- múltiplas abas;
- testes.

**Saída:** sessões locais reais sem travar UI ou deixar processos órfãos conhecidos.

### Fase 4 — SSH

- trait;
- spike russh;
- keychain;
- PTY remoto;
- senha;
- chave/passphrase;
- known hosts;
- estados;
- cancelamento/timeout;
- integração controlada.

**Saída:** SSH seguro por senha e chave, com bloqueio para fingerprint alterada.

### Fase 5 — Portabilidade

- parser OpenSSH;
- prévia;
- relatório de diretivas;
- JSON versionado;
- import;
- conflitos;
- fixtures.

**Saída:** importação comum e round-trip OwnTerm sem segredos.

### Fase 6 — Polimento

- atalhos;
- acessibilidade;
- Mica/fallback;
- Error Boundary;
- logs;
- E2E;
- smoke Windows;
- segurança;
- empacotamento;
- documentação;
- release candidate.

**Saída:** critérios globais atendidos e instalador reproduzível.

---

## 20. Backlog recomendado

### Epic A — Foundation

1. ADR e workspaces.
2. Scaffold Tauri/React/Cargo.
3. Lint, format, typecheck e testes.
4. CI.
5. BackendClient mockável.

### Epic B — Design System

1. Tokens e dark theme.
2. shadcn adaptado.
3. AppShell/title bar.
4. Activity bar/sidebar.
5. Tabs/status.
6. Quick Connect.
7. Teclado e tamanhos de janela.

### Epic C — Hosts

1. Modelos.
2. SQLite/migrations.
3. Repository.
4. Services.
5. Tauri CRUD.
6. Formulário.
7. Grupos/favoritos/recentes.
8. Busca.

### Epic D — Local Terminal

1. Contratos.
2. Detecção de shells.
3. Adapter PTY.
4. Lifecycle.
5. xterm.js.
6. Streaming/batching.
7. Resize/cleanup.
8. Múltiplas abas.

### Epic E — SSH

1. Trait e fake.
2. Cofre.
3. russh e PTY remoto.
4. Senha.
5. Chave/passphrase.
6. Known hosts.
7. Estado/cancelamento/timeout.
8. Suíte controlada.

### Epic F — Import and Release

1. Parser OpenSSH.
2. Prévia/importação.
3. Schema de exportação.
4. Import/export/conflitos.
5. E2E.
6. Mica/fallback.
7. Segurança/logs.
8. Release candidate.

---

## 21. Critérios globais do MVP

- [ ] Instala e inicia no Windows 11.
- [ ] Funciona sem login e internet.
- [ ] Abre PowerShell e CMD.
- [ ] Abre WSL quando disponível.
- [ ] Mantém múltiplas abas.
- [ ] Gerencia e pesquisa hosts.
- [ ] Conecta SSH por senha.
- [ ] Conecta SSH por chave/passphrase.
- [ ] Protege credenciais no cofre.
- [ ] Valida fingerprint.
- [ ] Persiste SQLite.
- [ ] Importa OpenSSH comum.
- [ ] Importa/exporta workspace sem segredos.
- [ ] Quick Connect funciona pelo teclado.
- [ ] Erros são compreensíveis.
- [ ] Sessões encerram previsivelmente.
- [ ] Fluxos críticos possuem testes.
- [ ] Checklist Windows executado.
- [ ] Instalação, uso e limitações documentados.
- [ ] Não possui telemetria/cloud.
- [ ] Não registra segredos.

---

## 22. Definition of Done

Uma issue só está concluída quando:

- respeita spec e escopo;
- atende critérios;
- possui testes relevantes;
- lint/typecheck/testes passam;
- considera erros e vazios;
- não contém segredo real;
- atualiza documentação;
- justifica dependências;
- não mistura mudanças não relacionadas;
- registra validação manual quando depende do SO;
- documenta limitações.

---

## 23. Riscos e spikes

### 23.1 russh

Criar spike cobrindo autenticação, terminal interativo, resize, fingerprints e chaves. Se houver lacunas, comparar libssh2 ou OpenSSH mantendo a interface.

### 23.2 Streaming Tauri

Medir batching, latência, CPU e saída intensa. Nunca serializar cada caractere como chamada independente.

### 23.3 xterm/WebView

Validar WebGL/fallback, WebView2, DPI, resize e múltiplos monitores.

### 23.4 Transparência

Preferir Mica no Windows 11. Efeitos são opcionais e não podem prejudicar leitura ou desempenho.

### 23.5 Keychain

Fake em CI não substitui teste real no Credential Manager.

### 23.6 Escopo

O maior risco é competir com todo o Termius antes de entregar conexão rápida e confiável. Cloud, SFTP, plugins, equipes e mobile permanecem fora.

---

## 24. Metas não funcionais

Metas para validação, não promessas públicas:

- startup percebido próximo de 2 segundos em máquina moderna;
- digitação sem atraso perceptível;
- UI responsiva sob saída intensa;
- cinco sessões simultâneas como smoke mínimo;
- I/O nunca bloqueia a UI;
- escala 100%, 125%, 150% e 200%;
- fluxos principais sem mouse;
- fallback para transparência e WebGL;
- logs limitados;
- recuperação clara de erro.

---

## 25. Documentação esperada

- visão e escopo;
- requisitos;
- setup Windows;
- frontend mockado;
- Tauri dev;
- testes/lint/build;
- arquitetura;
- segurança;
- export format;
- atalhos;
- troubleshooting;
- roadmap separado de recursos existentes.

Comandos desejados, ajustados ao scaffold real:

~~~bash
pnpm install
pnpm dev
pnpm tauri dev
pnpm test
pnpm lint
cargo test --workspace
cargo clippy --workspace --all-targets --all-features
~~~

O README não pode anunciar como pronto algo apenas planejado.

---

## 26. Depois do MVP

### Produto

- split panes;
- snippets;
- port forwarding;
- SSH agent;
- temas;
- tmux;
- SFTP enxuto;
- plugin API.

### Cloud opcional

- Rust/Axum;
- PostgreSQL;
- autenticação;
- sync de configuração;
- criptografia ponta a ponta;
- conflitos;
- dispositivos confiáveis.

O core não depende da nuvem. Sync será adapter sobre dados versionados.

### Enterprise

- equipes;
- políticas;
- SSO;
- RBAC;
- auditoria;
- distribuição de configurações;
- cofres corporativos.

---

## 27. Referências

- Tauri 2: https://v2.tauri.app/
- Tauri window effects: https://v2.tauri.app/reference/config/
- React: https://react.dev/
- Vite: https://vite.dev/
- Tailwind: https://tailwindcss.com/docs
- shadcn/ui: https://ui.shadcn.com/docs
- xterm.js: https://xtermjs.org/docs/
- Tokio: https://tokio.rs/
- russh: https://github.com/Eugeny/russh
- portable-pty: https://docs.rs/portable-pty
- SQLite: https://www.sqlite.org/docs.html

---

## 28. Prompt para acompanhar este arquivo

~~~text
Leia integralmente OWNTERM_MVP_CONTEXT.md e todos os AGENTS.md aplicáveis.

Primeiro, inspecione o repositório e apresente:
1. diferenças entre o estado atual e a arquitetura proposta;
2. decisões que precisam de ADR;
3. épicos, specs e issues pequenas ordenadas por dependência;
4. critérios de aceite e testes para cada issue;
5. riscos que merecem spike.

Não implemente o MVP inteiro. Não inclua cloud sync, SFTP, plugins, mobile
ou enterprise. Priorize:
scaffold -> shell visual mockado -> hosts persistentes -> terminal local -> SSH.

Depois do plano aprovado, implemente apenas a primeira issue desbloqueada,
execute as validações e entregue resumo de mudanças, testes e limitações.
~~~

---

## 29. Resumo executivo

O OwnTerm MVP será uma aplicação desktop Windows-first construída com Rust, Tauri 2, React, TypeScript, Tailwind CSS 4, shadcn/ui e xterm.js. Funcionará sem conta, armazenará hosts em SQLite, protegerá credenciais no cofre do sistema, abrirá terminais locais e SSH e permitirá importar/exportar configurações sem segredos.

A implementação deve avançar em fatias pequenas, com contratos claros, testes e validação nativa. O sucesso do MVP não será medido pela quantidade de recursos, mas pela capacidade de o usuário abrir o aplicativo, encontrar um host e iniciar uma sessão confiável em poucos segundos.
