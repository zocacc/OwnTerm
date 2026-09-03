# Spec — Persistência e segredos

## Objetivo

Persistir configuração local e confiança SSH com migrations seguras, mantendo credenciais fora do banco e fora de qualquer artefato exportável.

## Dados persistidos

- `hosts`, `host_groups`, `host_tags`, `settings`, `recent_hosts`, `known_hosts` e `schema_migrations` no SQLite.
- Credential References opacas associadas a Hosts; o valor correspondente fica apenas no cofre do sistema.
- Caminho de chave privada, nunca conteúdo de chave.

O schema inicial representa autenticação por `auth_kind` e permite somente `credential_ref`, `private_key_path` e `passphrase_ref` conforme o método. Não existem colunas para senha, passphrase, token, conteúdo de chave ou saída de terminal.

## Migrations

Migrations são ordenadas, imutáveis após release, transacionais quando possível e testadas do banco vazio até a versão atual. Quando houver releases anteriores, upgrades devem ser cobertos por fixtures de banco compatíveis.

A migration `0001_initial.sql` cria o schema versão 1. Aplicá-la novamente não altera um banco já migrado.

## Limpeza de credenciais

Remover um Host ou substituir seu método de autenticação agenda referências sem outro uso em `orphaned_credential_refs`, na mesma transação. A limpeza do cofre é idempotente e retentável: sucesso ou item já ausente conclui a pendência; falha de plataforma mantém a fila; referência novamente em uso é retirada da fila sem apagar o segredo.

## Known Hosts

Um registro representa a identidade criptográfica confiada para um destino normalizado e porta. A primeira confirmação grava o registro; identidade divergente bloqueia a conexão. A revisão/remover o registro é uma ação explícita e auditável por log sanitizado.

## Segredos e logs

Salvar senha ou passphrase é ação explícita de formulário para command de cofre. Falha do cofre deixa o Host sem segredo utilizável e retorna erro acionável. Logs estruturados podem ter IDs, tipo de operação e códigos de erro, mas não valores de formulário, saída de terminal, caminhos sensíveis além do estritamente necessário ou materiais criptográficos.

## Critérios de aceite

- [ ] Banco novo aplica todas as migrations e abre com schema esperado.
- [ ] Não existe coluna para senha, passphrase, token ou conteúdo de chave.
- [ ] Credential Reference sem valor acessível no cofre não permite autenticação silenciosa.
- [ ] Identidade SSH inédita e alterada seguem as regras do trust model.
- [ ] Logs, erros e exportações passam por testes de ausência de segredo.

## Testes

- Integração de migrations, repositories e rollback.
- Fake de cofre para sucesso, item ausente e falha de plataforma.
- Inspeção do schema SQLite e snapshots sanitizados de logs/erros.
