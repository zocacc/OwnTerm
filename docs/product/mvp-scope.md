# Escopo do MVP

## Objetivo

Entregar no Windows 11 um terminal desktop local-first para abrir shells locais e sessões SSH, organizar Hosts e portar configurações sem depender de conta, internet ou serviço externo.

## Resultado observável

Uma pessoa técnica instala o OwnTerm, abre PowerShell ou CMD, cadastra ou importa um Host SSH, armazena seu segredo no cofre do sistema, confirma uma fingerprint inédita e trabalha em abas de terminal interativas.

## Incluído

- Shells locais PowerShell e CMD; distribuições WSL detectadas quando disponíveis.
- Abas, terminal ANSI interativo, resize, copiar/colar, encerramento de processo e exit code quando disponível.
- SSH por hostname/IP, porta, senha ou chave local protegida por passphrase.
- Confirmação de fingerprint na primeira conexão, bloqueio de identidade alterada, timeout, cancelamento e reconexão manual.
- Hosts, grupos de um nível, tags, favoritos, recentes, busca, Quick Connect e confirmações destrutivas.
- Importação de aliases concretos de `~/.ssh/config`, prévia, relato de diretivas ignoradas e resolução de conflitos por entrada.
- Exportação e reimportação OwnTerm em JSON versionado sem segredos.
- SQLite com migrations, cofre do sistema, logs sanitizados, tema escuro e artefato instalável Windows via CI.

## Não incluído

- CLI de uso final, sincronização, contas, equipes, telemetria, plugins, SFTP, jump hosts, port forwarding, gravação de sessões e suporte oficial macOS/Linux.
- Grupos aninhados, shells arbitrários configuráveis, interpretação de padrões OpenSSH, `Include` ou `ProxyJump`.
- Alteração ou sincronização do `~/.ssh/known_hosts` do usuário.
- Assinatura de código, publicação de release ou provisionamento de serviços externos.

## Critério de conclusão

O MVP só está pronto quando os fluxos de primeira execução, shell local, cadastrar/conectar SSH, Quick Connect e importação/exportação funcionarem juntos em build Windows; nenhum segredo pode constar no SQLite, exportações, logs ou estado persistido da interface.
