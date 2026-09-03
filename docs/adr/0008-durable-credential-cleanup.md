# Limpeza durável de referências de credencial

Status: accepted

Excluir ou alterar um Host agenda referências que deixaram de ser usadas na tabela `orphaned_credential_refs`, na mesma transação SQLite da mudança. Um serviço idempotente remove o item do cofre e conclui a fila; falhas do cofre preservam a pendência para retry e referências reutilizadas nunca são removidas.
