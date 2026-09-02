# Spec — Hosts e grupos

## Objetivo

Permitir que o usuário mantenha uma lista local pesquisável de destinos SSH e abra conexões sem reconfigurar dados de acesso.

## Modelo

Um Host tem ID, nome, endereço, porta, usuário opcional, grupo opcional, tags, método de autenticação, favorito e timestamps. Um Host Group tem ID, nome e ordem; grupos não possuem pai no MVP. Senhas e passphrases são representadas por Credential References.

## Escopo

- Criar, editar e excluir Host com confirmação explícita.
- Criar, renomear, ordenar e remover grupos de primeiro nível.
- Pesquisar por nome, endereço, usuário, grupo e tag.
- Marcar favoritos, registrar recentes após abertura bem-sucedida e mostrar ambos na sidebar.
- Abrir Host por duplo clique, Enter ou Quick Connect.
- Salvar senha/passphrase no cofre após ação explícita durante o formulário.

## Fora do escopo

- Grupos aninhados, compartilhamento, sincronização, agentes SSH funcionais e credenciais em texto puro.

## Regras

- Excluir Host remove a configuração e sua referência de credencial quando não estiver em uso; não remove arquivo de chave local.
- Excluir grupo exige escolha explícita para mover Hosts para sem grupo ou cancelar; não há exclusão implícita de Hosts.
- Host sem usuário pode pedir usuário durante a conexão, mas não pode inventar um valor persistido.
- O método `Agent` pode existir no domínio para evolução, mas não aparece como opção funcional no MVP.

## Critérios de aceite

- [ ] CRUD de Host e grupo persiste entre reinicializações.
- [ ] Cada Host pertence a zero ou um grupo e tags não duplicam após normalização.
- [ ] Busca encontra cada campo prometido sem revelar segredo.
- [ ] Favoritos e recentes são atualizados por ações bem-sucedidas e não por tentativa falha.
- [ ] Quick Connect inicia a mesma jornada de conexão que abrir pelo Host Tree.
- [ ] Exclusões exigem confirmação e não deixam Credential References órfãs.

## Testes

- Unidade para validação, normalização, busca e regras de remoção de grupo.
- Integração SQLite para CRUD, favoritos/recentes e migrations.
- Componentes para formulário, confirmação, busca e Quick Connect.
